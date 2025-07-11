# Location Cache System - Hybrid Approach

## Overview

The new location cache system implements a **smart hybrid approach** that provides instant load times while keeping location data fresh in the background. This eliminates the need for users to wait for GPS every time they open the location selector.

## Key Features

### 🚀 **Instant Load Times**
- Location selector opens immediately with cached location
- No visible transition from Bacolod to user location
- Map appears instantly with correct region

### 🔋 **Battery Efficient**
- Location tracking only when app is active
- Stops tracking when app goes to background
- Smart update intervals (2-5 minutes)
- Distance-based updates (50m minimum movement)

### 📍 **Smart Location Strategy**
1. **Stored pickup/dropoff location** (if available)
2. **Fresh cached location** (if < 5 minutes old)
3. **Background GPS update** (if cached location is stale)
4. **Network location fallback** (if GPS fails)
5. **Stale cached location** (if < 24 hours old)
6. **Bacolod fallback** (last resort)

### 🎯 **Automatic Background Updates**
- Updates location when app comes to foreground
- Triggers fresh GPS if cached location is stale
- Updates location every 2 minutes when app is active
- Updates when user moves more than 50 meters

## How It Works

### System Components

#### 1. **LocationCacheService**
- Singleton service that manages location caching
- Handles GPS/network location fetching
- Manages background location tracking
- Provides smart fallback chain

#### 2. **Smart Initialization**
```typescript
// Priority order:
1. Stored pickup/dropoff → Use immediately
2. Fresh cache (< 5min) → Use immediately  
3. Stale cache (< 24h) → Use + trigger background update
4. No cache → Fetch fresh + show loading
5. GPS fails → Use Bacolod fallback
```

#### 3. **Background Tracking**
- Starts when app becomes active
- Stops when app goes to background
- Updates every 2 minutes OR 50 meters movement
- Only accepts locations with < 100m accuracy

### Usage Flow

#### **First Time User**
1. Opens location-selector
2. Shows loading screen
3. Requests GPS permission
4. Gets location → saves to cache
5. Shows map with user location

#### **Returning User**
1. Opens location-selector
2. **Instantly** shows map with cached location
3. If cache is stale (> 5min), triggers background GPS update
4. Updates map smoothly when fresh location arrives

#### **User with Stored Pickup/Dropoff**
1. Opens location-selector
2. **Instantly** shows map with stored location
3. No GPS request needed
4. No loading screen

## Configuration

### Default Settings
```typescript
{
  staleThresholdMs: 5 * 60 * 1000,    // 5 minutes
  maxAgeMs: 24 * 60 * 60 * 1000,     // 24 hours  
  updateIntervalMs: 2 * 60 * 1000,   // 2 minutes
  minAccuracyMeters: 100              // 100 meters
}
```

### Customizable Options
- **Stale Threshold**: When to consider location outdated
- **Max Age**: When to discard location completely
- **Update Interval**: How often to update in background
- **Min Accuracy**: Minimum GPS accuracy to accept

## Performance Benefits

### Before (Old System)
- ❌ 3-8 second loading time every time
- ❌ Visible transition from Bacolod → User location
- ❌ GPS request on every screen open
- ❌ No location caching between sessions

### After (Hybrid System)
- ✅ **Instant** map display (0ms loading)
- ✅ No visible transitions
- ✅ Smart background location updates
- ✅ Persistent location cache
- ✅ Battery-efficient tracking

## Implementation Details

### Service Lifecycle
```typescript
// App startup
LocationCacheService.getInstance() → Auto-initializes

// App foreground
AppState: 'active' → Start location tracking + update if stale

// App background  
AppState: 'background' → Stop location tracking (save battery)

// Location selector open
getLocation() → Return cached location immediately
```

### Error Handling
- GPS timeout (5 seconds) → Try network location
- Network timeout → Use cached location
- No permissions → Use cached location
- No cache available → Use Bacolod fallback

### Memory Management
- Single cached location object
- Automatic cleanup on app close
- No memory leaks from location subscriptions

## API Reference

### LocationCacheService Methods

```typescript
// Get location using smart fallback chain
getLocation(): Promise<CachedLocation | null>

// Force fresh GPS/network location
getFreshLocation(): Promise<CachedLocation | null>

// Update location if current cache is stale
updateLocationIfStale(): Promise<void>

// Check if cached location is stale
isLocationStale(): boolean

// Get age of cached location in minutes
getLocationAge(): number | null
```

### Location Data Structure
```typescript
interface CachedLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;        // GPS accuracy in meters
  timestamp: number;        // When location was obtained
  source: 'gps' | 'network' | 'cached';
}
```

## Best Practices

### When to Use Each Method

#### `getLocation()`
- **Use for**: Initial map display
- **Behavior**: Returns cached location instantly, no GPS request
- **Perfect for**: Fast UI rendering

#### `getFreshLocation()`  
- **Use for**: "Current Location" button, manual refresh
- **Behavior**: Always requests fresh GPS/network location
- **Perfect for**: User-triggered location updates

#### `updateLocationIfStale()`
- **Use for**: Background updates, app foreground
- **Behavior**: Only updates if cache is old
- **Perfect for**: Automatic maintenance

## Troubleshooting

### Common Issues

#### Map shows old location
- Check if `updateLocationIfStale()` is being called
- Verify app foreground/background detection
- Check location permissions

#### Battery drain
- Verify location tracking stops on app background
- Check update intervals aren't too frequent
- Ensure distance threshold is appropriate

#### Location not updating
- Check AppState listener is working
- Verify GPS permissions are granted
- Check network connectivity for network location

## Future Enhancements

### Possible Improvements
1. **Geofencing**: Update location when entering/leaving delivery zones
2. **Route-based updates**: More frequent updates during active deliveries
3. **Location history**: Track user's common locations for faster suggestions
4. **Predictive caching**: Pre-cache locations for upcoming deliveries
5. **Offline maps**: Cache map tiles for common areas

### Analytics Integration
- Track location update frequency
- Monitor GPS vs network location usage
- Measure impact on battery life
- Track user satisfaction with location accuracy
