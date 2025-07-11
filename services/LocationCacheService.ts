import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { AppState, AppStateStatus } from 'react-native';

export interface CachedLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
  source: 'gps' | 'network' | 'cached';
}

export interface LocationCacheConfig {
  staleThresholdMs: number; // When to consider location stale
  maxAgeMs: number; // Maximum age before location is considered invalid
  updateIntervalMs: number; // Minimum time between background updates
  minAccuracyMeters: number; // Minimum accuracy to accept
}

class LocationCacheService {
  private static instance: LocationCacheService;
  private watchSubscription: Location.LocationSubscription | null = null;
  private appStateSubscription: any = null;
  private lastUpdateTime: number = 0;
  private isUpdating: boolean = false;
  private cachedLocation: CachedLocation | null = null;
  private lastSavedLocation: { lat: number; lon: number } | null = null;
  private manualUpdateTimer: any = null; // Add manual timer for testing

  // Configuration with fast updates for testing
  private config: LocationCacheConfig = {
    staleThresholdMs: 5 * 60 * 1000, // 5 minutes
    maxAgeMs: 24 * 60 * 60 * 1000, // 24 hours
    updateIntervalMs: 20 * 1000, // 20 seconds for testing
    minAccuracyMeters: 100, // Accept locations within 100m accuracy
  };

  private constructor() {
    this.initialize();
  }

  static getInstance(): LocationCacheService {
    if (!LocationCacheService.instance) {
      LocationCacheService.instance = new LocationCacheService();
    }
    return LocationCacheService.instance;
  }

  private async initialize() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 LocationCacheService: Starting initialization...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Load cached location on startup
    await this.loadCachedLocation();
    
    // Listen to app state changes
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
    console.log('📱 LocationCacheService: AppState listener added');
    
    // Start location tracking if app is active
    if (AppState.currentState === 'active') {
      console.log('✅ LocationCacheService: App is active, starting location tracking');
      this.startLocationTracking();
    } else {
      console.log('⏸️ LocationCacheService: App is not active, waiting for foreground');
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  private handleAppStateChange = (nextAppState: AppStateStatus) => {
    console.log('');
    console.log('┌─────────────────────────────────────────────────────────────────────────────────────────┐');
    console.log(`│ 📱 LocationCacheService: App state changed to '${nextAppState}'${' '.repeat(30 - nextAppState.length)}│`);
    console.log('└─────────────────────────────────────────────────────────────────────────────────────────┘');
    
    if (nextAppState === 'active') {
      // App came to foreground - update location if stale
      console.log('🔄 LocationCacheService: App active - checking if location needs update');
      this.updateLocationIfStale();
      this.startLocationTracking();
    } else if (nextAppState === 'background') {
      // App went to background - stop tracking to save battery
      console.log('🛑 LocationCacheService: App backgrounded - stopping location tracking');
      this.stopLocationTracking();
    }
    console.log('');
  };

  private async loadCachedLocation() {
    console.log('💾 LocationCacheService: Loading cached location from storage...');
    try {
      const locationData = await SecureStore.getItemAsync('cachedLocation');
      if (locationData) {
        const parsed: CachedLocation = JSON.parse(locationData);
        
        // Only use if not too old
        if (Date.now() - parsed.timestamp < this.config.maxAgeMs) {
          this.cachedLocation = parsed;
          // Initialize lastSavedLocation for distance calculations
          this.lastSavedLocation = {
            lat: parsed.latitude,
            lon: parsed.longitude
          };
          const ageMinutes = Math.floor((Date.now() - parsed.timestamp) / (60 * 1000));
          console.log(`✅ LocationCacheService: Loaded cached location (${ageMinutes} minutes old):`, parsed);
        } else {
          console.log('❌ LocationCacheService: Cached location too old, discarding');
        }
      } else {
        console.log('📍 LocationCacheService: No cached location found');
      }
    } catch (error) {
      console.error('💥 LocationCacheService: Failed to load cached location:', error);
    }
  }

  private async saveCachedLocation(location: CachedLocation) {
    try {
      await SecureStore.setItemAsync('cachedLocation', JSON.stringify(location));
      this.cachedLocation = location;
      console.log(`💾 LocationCacheService: Saved location (${location.source}):`, {
        lat: location.latitude.toFixed(6),
        lon: location.longitude.toFixed(6),
        accuracy: location.accuracy ? `${location.accuracy}m` : 'unknown'
      });
    } catch (error) {
      console.error('💥 LocationCacheService: Failed to save cached location:', error);
    }
  }

  private async startLocationTracking() {
    if (this.watchSubscription) {
      console.log('⚠️ LocationCacheService: Location tracking already active');
      return; // Already tracking
    }

    console.log('🛰️ LocationCacheService: Starting location tracking...');
    
    // NEVER REQUEST PERMISSIONS - only check existing permissions silently
    const { status } = await Location.getForegroundPermissionsAsync();
    const isLocationServicesEnabled = await Location.hasServicesEnabledAsync();
    
    console.log(`📡 LocationCacheService: Location services enabled: ${isLocationServicesEnabled}`);
    console.log(`🔐 LocationCacheService: Permission status: ${status}`);

    // Determine the best location method available
    let useGPS = false;
    let useNetwork = false;
    
    if (status === 'granted' && isLocationServicesEnabled) {
      useGPS = true;
      console.log('✅ LocationCacheService: Using GPS location (permission granted + services enabled)');
    } else {
      useNetwork = true;
      console.log('📶 LocationCacheService: Using network location (GPS not available)');
    }

    try {
      // Configure location options - NEVER show user dialogs
      const locationOptions = {
        accuracy: useGPS ? Location.Accuracy.High : Location.Accuracy.Lowest,
        timeInterval: 20000, // 20 seconds - matches config
        distanceInterval: 50, // Update every 50 meters (reasonable default)
        mayShowUserSettingsDialog: false, // NEVER show user dialogs
      };

      console.log('⚙️ LocationCacheService: Using location options:', locationOptions);

      // TEMPORARILY DISABLED: Use only manual timer for cleaner testing
      // this.watchSubscription = await Location.watchPositionAsync(
      //   locationOptions,
      //   this.handleLocationUpdate
      // );

      console.log(`🚀 LocationCacheService: GPS tracking configured (using manual timer only for testing)`);
      
      // BACKUP: Start a manual timer as fallback to ensure we get updates
      this.startManualLocationUpdates();
      
      // Set up a test timer to see if we're getting any callbacks at all
      setTimeout(() => {
        console.log('⏰ LocationCacheService: 10 second test - checking if any location updates received...');
        if (this.lastUpdateTime === 0) {
          console.log('❌ LocationCacheService: NO location updates received after 10 seconds - possible issue!');
        } else {
          console.log('✅ LocationCacheService: Location updates are working!');
        }
      }, 10000);

    } catch (error) {
      console.error('💥 LocationCacheService: Failed to start location tracking:', error);
      console.error('💥 LocationCacheService: Error details:', JSON.stringify(error, null, 2));
    }
  }

  private stopLocationTracking() {
    if (this.watchSubscription) {
      this.watchSubscription.remove();
      this.watchSubscription = null;
      console.log('🛑 LocationCacheService: GPS tracking stopped');
    } else {
      console.log('⚠️ LocationCacheService: GPS tracking was not active');
    }
    
    // Also stop manual updates
    this.stopManualLocationUpdates();
  }

  private handleLocationUpdate = (location: Location.LocationObject) => {
    const now = Date.now();
    
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                                🛰️ GPS LOCATION UPDATE                                    ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════════════════════╝');
    console.log(`📍 LocationCacheService: GPS update received at ${new Date().toLocaleTimeString()}`);
    console.log(`📍 LocationCacheService: GPS data - Lat: ${location.coords.latitude.toFixed(6)}, Lon: ${location.coords.longitude.toFixed(6)}, Accuracy: ${location.coords.accuracy}m`);
    
    // Determine what triggered this update
    let triggerReason = '';
    const timeSinceLastUpdate = now - this.lastUpdateTime;
    
    console.log(`⏱️ LocationCacheService: Time since last update: ${Math.floor(timeSinceLastUpdate/1000)}s (threshold: ${this.config.updateIntervalMs/1000}s)`);
    
    if (this.lastSavedLocation) {
      // Calculate distance from last saved location
      const distance = this.calculateDistance(
        this.lastSavedLocation.lat,
        this.lastSavedLocation.lon,
        location.coords.latitude,
        location.coords.longitude
      );
      
      console.log(`📏 LocationCacheService: Distance from last location: ${distance.toFixed(1)}m (threshold: 50m)`);
      
      if (distance >= 50) { // distanceInterval threshold - back to reasonable default
        triggerReason = `📏 DISTANCE (moved ${distance.toFixed(1)}m)`;
      } else if (timeSinceLastUpdate >= this.config.updateIntervalMs) {
        triggerReason = `⏰ TIME (${Math.floor(timeSinceLastUpdate/1000)}s elapsed)`;
      } else {
        triggerReason = `🎯 ACCURACY (GPS improved)`;
      }
    } else {
      triggerReason = `🚀 INITIAL (first location)`;
    }
    
    console.log(`🔔 LocationCacheService: Update triggered by ${triggerReason}`);
    
    // Enhanced trigger information
    console.log('┌─ UPDATE TRIGGER ANALYSIS ─────────────────────────────────────────────────────────────┐');
    const timeSinceLastSave = Math.floor((now - this.lastUpdateTime) / 1000);
    console.log(`│ ⏱️  Time since last save: ${timeSinceLastSave}s (threshold: ${this.config.updateIntervalMs/1000}s)`);
    console.log(`│ � Trigger reason: ${triggerReason}`);
    console.log(`│ 🎯 Update source: Manual Timer (every 20s)`);
    console.log(`│ ✅ Decision: ACCEPT UPDATE`);
    console.log('└───────────────────────────────────────────────────────────────────────────────────────┘');
    
    // SIMPLIFIED: Accept all updates for now to test if Expo is calling every 10s
    // TODO: Add back filtering logic once we confirm timing works

    // Skip if accuracy is too poor
    if (location.coords.accuracy && location.coords.accuracy > this.config.minAccuracyMeters) {
      console.log(`❌ LocationCacheService: Skipping update - poor accuracy: ${location.coords.accuracy}m (need < ${this.config.minAccuracyMeters}m)`);
      console.log('╚═══════════════════════════════════════════════════════════════════════════════════════════╝');
      console.log('');
      return;
    }

    console.log(`✅ LocationCacheService: GPS update accepted - saving to cache (${triggerReason})`);

    const cachedLocation: CachedLocation = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy || undefined,
      timestamp: now,
      source: 'gps',
    };

    this.saveCachedLocation(cachedLocation);
    this.lastUpdateTime = now;
    
    // Store this location for distance calculation next time
    this.lastSavedLocation = {
      lat: location.coords.latitude,
      lon: location.coords.longitude
    };
    
    console.log(`🎯 LocationCacheService: Location cache updated successfully at ${new Date().toLocaleTimeString()} (${triggerReason})`);
    console.log('╚═══════════════════════════════════════════════════════════════════════════════════════════╝');
    console.log('');
  };

  // Calculate distance between two coordinates using Haversine formula
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  }

  /**
   * Get location using smart fallback chain:
   * 1. Fresh cached location (if recent)
   * 2. Fresh GPS location (if permissions granted)
   * 3. Network location (if GPS fails)
   * 4. Stale cached location (if available)
   * 5. null (no location available)
   */
  async getLocation(): Promise<CachedLocation | null> {
    const now = Date.now();

    console.log('🔍 LocationCacheService: getLocation() called');

    // 1. Return fresh cached location if available
    if (this.cachedLocation && (now - this.cachedLocation.timestamp) < this.config.staleThresholdMs) {
      const ageMinutes = Math.floor((now - this.cachedLocation.timestamp) / (60 * 1000));
      console.log(`✅ LocationCacheService: Using fresh cached location (${ageMinutes} minutes old)`);
      return this.cachedLocation;
    }

    // 2. Try to get fresh location if not already updating
    if (!this.isUpdating) {
      console.log('🔄 LocationCacheService: Cached location is stale, getting fresh location...');
      const freshLocation = await this.getFreshLocation();
      if (freshLocation) {
        console.log('✅ LocationCacheService: Got fresh location successfully');
        return freshLocation;
      }
    }

    // 3. Fallback to stale cached location if available
    if (this.cachedLocation && (now - this.cachedLocation.timestamp) < this.config.maxAgeMs) {
      const ageHours = Math.floor((now - this.cachedLocation.timestamp) / (60 * 60 * 1000));
      console.log(`⚠️ LocationCacheService: Using stale cached location as fallback (${ageHours} hours old)`);
      return { ...this.cachedLocation, source: 'cached' };
    }

    // 4. Final fallback: Bacolod City center (if absolutely no location available)
    console.log('🏙️ LocationCacheService: Using Bacolod City as final fallback location');
    const bacolodFallback: CachedLocation = {
      latitude: 10.6772,
      longitude: 122.9547,
      timestamp: Date.now(),
      source: 'network', // Mark as network since it's a fallback
    };
    
    // Save this fallback so we have something cached
    await this.saveCachedLocation(bacolodFallback);
    return bacolodFallback;
  }

  /**
   * Force update location from GPS/network - NEVER prompts user
   */
  async getFreshLocation(): Promise<CachedLocation | null> {
    if (this.isUpdating) {
      console.log('Location update already in progress');
      return this.cachedLocation;
    }

    this.isUpdating = true;

    try {
      // NEVER REQUEST PERMISSIONS - only check existing permissions silently
      const { status } = await Location.getForegroundPermissionsAsync();
      const isLocationServicesEnabled = await Location.hasServicesEnabledAsync();
      
      console.log(`📡 LocationCacheService: Checking location availability - Permission: ${status}, Services: ${isLocationServicesEnabled}`);

      // Determine best location method
      const canUseGPS = status === 'granted' && isLocationServicesEnabled;
      
      if (canUseGPS) {
        console.log('🛰️ LocationCacheService: Attempting GPS location...');
        // Try GPS first with timeout
        try {
          const locationPromise = Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
            mayShowUserSettingsDialog: false, // NEVER show dialogs
          });

          const timeoutPromise = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('GPS timeout')), 5000)
          );

          const location = await Promise.race([locationPromise, timeoutPromise]);
          
          const cachedLocation: CachedLocation = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy || undefined,
            timestamp: Date.now(),
            source: 'gps',
          };

          await this.saveCachedLocation(cachedLocation);
          console.log('✅ LocationCacheService: Got fresh GPS location');
          return cachedLocation;

        } catch (gpsError) {
          console.log('⚠️ LocationCacheService: GPS failed, trying network location');
        }
      } else {
        console.log('📶 LocationCacheService: GPS not available, using network location');
      }

      // Try network location (works without GPS enabled or permissions)
      try {
        const networkLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Lowest, // Network/WiFi based
          mayShowUserSettingsDialog: false, // NEVER show dialogs
        });

        const cachedLocation: CachedLocation = {
          latitude: networkLocation.coords.latitude,
          longitude: networkLocation.coords.longitude,
          accuracy: networkLocation.coords.accuracy || undefined,
          timestamp: Date.now(),
          source: 'network',
        };

        await this.saveCachedLocation(cachedLocation);
        console.log('✅ LocationCacheService: Got fresh network location');
        return cachedLocation;

      } catch (networkError) {
        console.log('❌ LocationCacheService: Network location also failed:', networkError);
        
        // Final fallback: If we have a cached location (even old), return it
        if (this.cachedLocation) {
          console.log('🔄 LocationCacheService: Falling back to existing cached location');
          return { ...this.cachedLocation, source: 'cached' };
        }
      }

    } catch (error) {
      console.error('Failed to get fresh location:', error);
    } finally {
      this.isUpdating = false;
    }

    return this.cachedLocation;
  }

  /**
   * Update location if current cached location is stale
   */
  async updateLocationIfStale(): Promise<void> {
    if (!this.cachedLocation) {
      // No cached location, try to get one
      await this.getFreshLocation();
      return;
    }

    const now = Date.now();
    const isStale = (now - this.cachedLocation.timestamp) > this.config.staleThresholdMs;
    
    if (isStale) {
      console.log('Cached location is stale, updating...');
      await this.getFreshLocation();
    } else {
      console.log('Cached location is still fresh');
    }
  }

  /**
   * Check if current cached location is stale
   */
  isLocationStale(): boolean {
    if (!this.cachedLocation) return true;
    
    const now = Date.now();
    return (now - this.cachedLocation.timestamp) > this.config.staleThresholdMs;
  }

  /**
   * Get location age in minutes
   */
  getLocationAge(): number | null {
    if (!this.cachedLocation) return null;
    
    const ageMs = Date.now() - this.cachedLocation.timestamp;
    return Math.floor(ageMs / (60 * 1000)); // Convert to minutes
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<LocationCacheConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Cleanup resources
   */
  dispose() {
    this.stopLocationTracking();
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
  }

  private startManualLocationUpdates() {
    console.log('🔄 LocationCacheService: Starting manual location updates as backup (every 20s)');
    
    this.manualUpdateTimer = setInterval(async () => {
      console.log('🕐 LocationCacheService: Manual timer triggered - getting current location...');
      
      try {
        // NEVER REQUEST PERMISSIONS - only check existing permissions silently
        const { status } = await Location.getForegroundPermissionsAsync();
        const isLocationServicesEnabled = await Location.hasServicesEnabledAsync();
        
        const canUseGPS = status === 'granted' && isLocationServicesEnabled;
        
        const location = await Location.getCurrentPositionAsync({
          accuracy: canUseGPS ? Location.Accuracy.Balanced : Location.Accuracy.Lowest,
          mayShowUserSettingsDialog: false, // NEVER show dialogs
        });
        
        console.log('📍 LocationCacheService: Manual location obtained, calling handler...');
        this.handleLocationUpdate(location);
        
      } catch (error) {
        console.error('💥 LocationCacheService: Manual location update failed:', error);
      }
    }, 20000); // Every 20 seconds
  }

  private stopManualLocationUpdates() {
    if (this.manualUpdateTimer) {
      clearInterval(this.manualUpdateTimer);
      this.manualUpdateTimer = null;
      console.log('🛑 LocationCacheService: Manual location updates stopped');
    }
  }
}

// Export singleton instance
export const locationCacheService = LocationCacheService.getInstance();
