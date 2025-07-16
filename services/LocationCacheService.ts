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
  private appStateSubscription: any = null;
  private lastUpdateTime: number = 0;
  private isUpdating: boolean = false;
  private cachedLocation: CachedLocation | null = null;
  private lastSavedLocation: { lat: number; lon: number } | null = null;
  private manualUpdateTimer: any = null;

  private config: LocationCacheConfig = {
    staleThresholdMs: 5 * 60 * 1000,
    maxAgeMs: 24 * 60 * 60 * 1000,
    updateIntervalMs: 2 * 60 * 1000,
    minAccuracyMeters: 100,
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
    await this.loadCachedLocation();
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
    
    if (AppState.currentState === 'active') {
      this.startLocationTracking();
    }
  }

  private handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active') {
      this.updateLocationIfStale();
      this.startLocationTracking();
    } else if (nextAppState === 'background') {
      this.stopLocationTracking();
    }
  };

  private async loadCachedLocation() {
    try {
      const locationData = await SecureStore.getItemAsync('cachedLocation');
      if (locationData) {
        const parsed: CachedLocation = JSON.parse(locationData);
        
        if (Date.now() - parsed.timestamp < this.config.maxAgeMs) {
          this.cachedLocation = parsed;
          this.lastSavedLocation = {
            lat: parsed.latitude,
            lon: parsed.longitude
          };
        }
      }
    } catch (error) {
      // Failed to load cached location
    }
  }

  private async saveCachedLocation(location: CachedLocation) {
    try {
      await SecureStore.setItemAsync('cachedLocation', JSON.stringify(location));
      this.cachedLocation = location;
    } catch (error) {
      // Failed to save cached location
    }
  }

  private async startLocationTracking() {
    if (this.manualUpdateTimer) {
      return;
    }

    const { status } = await Location.getForegroundPermissionsAsync();
    const isLocationServicesEnabled = await Location.hasServicesEnabledAsync();
    
    if (status === 'granted' && isLocationServicesEnabled) {
      this.startManualLocationUpdates();
    }
  }

  private stopLocationTracking() {
    this.stopManualLocationUpdates();
  }

  private handleLocationUpdate = (location: Location.LocationObject) => {
    const now = Date.now();
    
    let triggerReason = '';
    const timeSinceLastUpdate = now - this.lastUpdateTime;
    
    if (this.lastSavedLocation) {
      const distance = this.calculateDistance(
        this.lastSavedLocation.lat,
        this.lastSavedLocation.lon,
        location.coords.latitude,
        location.coords.longitude
      );
      
      if (distance >= 50) {
        triggerReason = `DISTANCE (${distance.toFixed(1)}m)`;
      } else if (timeSinceLastUpdate >= this.config.updateIntervalMs) {
        triggerReason = `TIME (${Math.floor(timeSinceLastUpdate/1000)}s)`;
      } else {
        triggerReason = `ACCURACY`;
      }
    } else {
      triggerReason = `INITIAL`;
    }
    
    console.log(`� Manual trigger: ${triggerReason}`);
    
    if (location.coords.accuracy && location.coords.accuracy > this.config.minAccuracyMeters) {
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
    
    this.lastSavedLocation = {
      lat: location.coords.latitude,
      lon: location.coords.longitude
    };
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

  async getLocation(): Promise<CachedLocation | null> {
    const now = Date.now();

    if (this.cachedLocation && (now - this.cachedLocation.timestamp) < this.config.staleThresholdMs) {
      return this.cachedLocation;
    }

    if (!this.isUpdating) {
      const freshLocation = await this.getFreshLocation();
      if (freshLocation) {
        return freshLocation;
      }
    }

    if (this.cachedLocation && (now - this.cachedLocation.timestamp) < this.config.maxAgeMs) {
      return { ...this.cachedLocation, source: 'cached' };
    }

    const bacolodFallback: CachedLocation = {
      latitude: 10.6772,
      longitude: 122.9547,
      timestamp: Date.now(),
      source: 'network',
    };
    
    await this.saveCachedLocation(bacolodFallback);
    return bacolodFallback;
  }

  async getFreshLocation(): Promise<CachedLocation | null> {
    if (this.isUpdating) {
      return this.cachedLocation;
    }

    this.isUpdating = true;

    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      const isLocationServicesEnabled = await Location.hasServicesEnabledAsync();
      
      if (status === 'granted' && isLocationServicesEnabled) {
        try {
          const locationPromise = Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
            mayShowUserSettingsDialog: false,
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
          return cachedLocation;

        } catch (gpsError) {
          if (this.cachedLocation) {
            return { ...this.cachedLocation, source: 'cached' };
          }
        }
      }

    } catch (error) {
      // Failed to get fresh location
    } finally {
      this.isUpdating = false;
    }

    return this.cachedLocation;
  }

  async updateLocationIfStale(): Promise<void> {
    if (!this.cachedLocation) {
      await this.getFreshLocation();
      return;
    }

    const now = Date.now();
    const isStale = (now - this.cachedLocation.timestamp) > this.config.staleThresholdMs;
    
    if (isStale) {
      await this.getFreshLocation();
    }
  }

  isLocationStale(): boolean {
    if (!this.cachedLocation) return true;
    
    const now = Date.now();
    return (now - this.cachedLocation.timestamp) > this.config.staleThresholdMs;
  }

  getLocationAge(): number | null {
    if (!this.cachedLocation) return null;
    
    const ageMs = Date.now() - this.cachedLocation.timestamp;
    return Math.floor(ageMs / (60 * 1000));
  }

  updateConfig(newConfig: Partial<LocationCacheConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  dispose() {
    this.stopLocationTracking();
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
  }

  private startManualLocationUpdates() {
    this.manualUpdateTimer = setInterval(async () => {
      console.log('🕐 Manual location trigger');
      
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        const isLocationServicesEnabled = await Location.hasServicesEnabledAsync();
        
        if (status === 'granted' && isLocationServicesEnabled) {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
            mayShowUserSettingsDialog: false,
          });
          
          this.handleLocationUpdate(location);
        }
        
      } catch (error) {
        console.log('❌ Manual location failed');
      }
    }, 120000);
  }

  private stopManualLocationUpdates() {
    if (this.manualUpdateTimer) {
      clearInterval(this.manualUpdateTimer);
      this.manualUpdateTimer = null;
    }
  }

  async clearCachedLocation(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync('cachedLocation');
      this.cachedLocation = null;
      this.lastSavedLocation = null;
      this.lastUpdateTime = 0;
    } catch (error) {
      // Failed to clear cached location
    }
  }
}

// Export singleton instance
export const locationCacheService = LocationCacheService.getInstance();
