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

  // Configuration with sensible defaults for delivery app
  private config: LocationCacheConfig = {
    staleThresholdMs: 5 * 60 * 1000, // 5 minutes
    maxAgeMs: 24 * 60 * 60 * 1000, // 24 hours
    updateIntervalMs: 2 * 60 * 1000, // 2 minutes minimum between updates
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
    // Load cached location on startup
    await this.loadCachedLocation();
    
    // Listen to app state changes
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
    
    // Start location tracking if app is active
    if (AppState.currentState === 'active') {
      this.startLocationTracking();
    }
  }

  private handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active') {
      // App came to foreground - update location if stale
      this.updateLocationIfStale();
      this.startLocationTracking();
    } else if (nextAppState === 'background') {
      // App went to background - stop tracking to save battery
      this.stopLocationTracking();
    }
  };

  private async loadCachedLocation() {
    try {
      const locationData = await SecureStore.getItemAsync('cachedLocation');
      if (locationData) {
        const parsed: CachedLocation = JSON.parse(locationData);
        
        // Only use if not too old
        if (Date.now() - parsed.timestamp < this.config.maxAgeMs) {
          this.cachedLocation = parsed;
          console.log('Loaded cached location:', parsed);
        } else {
          console.log('Cached location too old, discarding');
        }
      }
    } catch (error) {
      console.error('Failed to load cached location:', error);
    }
  }

  private async saveCachedLocation(location: CachedLocation) {
    try {
      await SecureStore.setItemAsync('cachedLocation', JSON.stringify(location));
      this.cachedLocation = location;
      console.log('Saved cached location:', location);
    } catch (error) {
      console.error('Failed to save cached location:', error);
    }
  }

  private async startLocationTracking() {
    if (this.watchSubscription) return; // Already tracking

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Location permission not granted');
        return;
      }

      // Use efficient background tracking
      this.watchSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: this.config.updateIntervalMs,
          distanceInterval: 50, // Update every 50 meters
        },
        this.handleLocationUpdate
      );

      console.log('Started location tracking');
    } catch (error) {
      console.error('Failed to start location tracking:', error);
    }
  }

  private stopLocationTracking() {
    if (this.watchSubscription) {
      this.watchSubscription.remove();
      this.watchSubscription = null;
      console.log('Stopped location tracking');
    }
  }

  private handleLocationUpdate = (location: Location.LocationObject) => {
    const now = Date.now();
    
    // Skip if updated too recently
    if (now - this.lastUpdateTime < this.config.updateIntervalMs) {
      return;
    }

    // Skip if accuracy is too poor
    if (location.coords.accuracy && location.coords.accuracy > this.config.minAccuracyMeters) {
      console.log(`Skipping location update due to poor accuracy: ${location.coords.accuracy}m`);
      return;
    }

    const cachedLocation: CachedLocation = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy || undefined,
      timestamp: now,
      source: 'gps',
    };

    this.saveCachedLocation(cachedLocation);
    this.lastUpdateTime = now;
  };

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

    // 1. Return fresh cached location if available
    if (this.cachedLocation && (now - this.cachedLocation.timestamp) < this.config.staleThresholdMs) {
      console.log('Using fresh cached location');
      return this.cachedLocation;
    }

    // 2. Try to get fresh location if not already updating
    if (!this.isUpdating) {
      const freshLocation = await this.getFreshLocation();
      if (freshLocation) {
        return freshLocation;
      }
    }

    // 3. Fallback to stale cached location if available
    if (this.cachedLocation && (now - this.cachedLocation.timestamp) < this.config.maxAgeMs) {
      console.log('Using stale cached location as fallback');
      return { ...this.cachedLocation, source: 'cached' };
    }

    // 4. No location available
    console.log('No location available');
    return null;
  }

  /**
   * Force update location from GPS/network
   */
  async getFreshLocation(): Promise<CachedLocation | null> {
    if (this.isUpdating) {
      console.log('Location update already in progress');
      return this.cachedLocation;
    }

    this.isUpdating = true;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Location permission not granted');
        return this.cachedLocation;
      }

      // Try GPS first with timeout
      try {
        const locationPromise = Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
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
        console.log('Got fresh GPS location');
        return cachedLocation;

      } catch (gpsError) {
        console.log('GPS failed, trying network location');

        // Fallback to network location
        try {
          const networkLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Lowest,
          });

          const cachedLocation: CachedLocation = {
            latitude: networkLocation.coords.latitude,
            longitude: networkLocation.coords.longitude,
            accuracy: networkLocation.coords.accuracy || undefined,
            timestamp: Date.now(),
            source: 'network',
          };

          await this.saveCachedLocation(cachedLocation);
          console.log('Got fresh network location');
          return cachedLocation;

        } catch (networkError) {
          console.log('Network location also failed');
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
}

// Export singleton instance
export const locationCacheService = LocationCacheService.getInstance();
