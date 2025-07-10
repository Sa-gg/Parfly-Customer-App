import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import MapView, { Region } from 'react-native-maps';
import { CachedLocation, locationCacheService } from '../services/LocationCacheService';
import { useLocationStore } from '../store/useLocationStore';

const { width, height } = Dimensions.get('window');

// ============ LOCATION UTILITIES ============

/** Convert CachedLocation to Region */
const cachedLocationToRegion = (location: CachedLocation): Region => ({
  latitude: location.latitude,
  longitude: location.longitude,
  latitudeDelta: 0.008,
  longitudeDelta: 0.008,
});

/** Get the appropriate default region using hybrid approach */
const getSmartInitialRegion = async (storedLocation: any): Promise<Region> => {
  // 1. Use stored pickup/dropoff location if available
  if (storedLocation?.lat && storedLocation?.lon) {
    return {
      latitude: storedLocation.lat,
      longitude: storedLocation.lon,
      latitudeDelta: 0.008,
      longitudeDelta: 0.008,
    };
  }

  // 2. Try to get cached location from service
  try {
    const cachedLocation = await locationCacheService.getLocation();
    if (cachedLocation) {
      console.log(`Using cached location (${cachedLocation.source}, age: ${locationCacheService.getLocationAge()}min)`);
      return cachedLocationToRegion(cachedLocation);
    }
  } catch (error) {
    console.warn('Failed to get cached location:', error);
  }

  // 3. Fallback to Bacolod City
  console.log('Using Bacolod fallback location');
  return {
    latitude: 10.6765,
    longitude: 122.9511,
    latitudeDelta: 0.008,
    longitudeDelta: 0.008,
  };
};

export default function LocationSelectorScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams(); // 'pickup' or 'dropoff'

  // Get stored location immediately and synchronously
  const { pickup, dropoff } = useLocationStore.getState();
  const storedLocation = mode === 'pickup' ? pickup : dropoff;

  // Initialize with Bacolod fallback (will be updated immediately by useEffect)
  const getInitialRegion = (): Region => ({
    latitude: 10.6765,
    longitude: 122.9511,
    latitudeDelta: 0.008,
    longitudeDelta: 0.008,
  });

  // State management
  const [search, setSearch] = useState('');
  const [address, setAddress] = useState(storedLocation?.address || 'Select location');
  const [city, setCity] = useState(storedLocation?.city || '');
  const [loading, setLoading] = useState(!storedLocation?.address); // Show loading if no stored address
  const [mapVisible, setMapVisible] = useState(!!storedLocation?.address); // Hide map if no stored address
  const [showUI, setShowUI] = useState(false);
  const [fetchingAddress, setFetchingAddress] = useState(false);
  const [initialRegion, setInitialRegion] = useState<Region>(getInitialRegion());
  const [currentCoords, setCurrentCoords] = useState<Region>(getInitialRegion());
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Refs for map interactions and animations
  const mapRef = useRef<MapView>(null);
  const moveTimeout = useRef<NodeJS.Timeout | number | null>(null);
  const mapReady = useRef(false);
  const isManualDrag = useRef(false); // Start as false - will be set to true on pan drag
  const skipSearchRef = useRef(false);
  const animationTime = useRef(500);
  const isInitialLoad = useRef(true); // Track if this is the initial load
  const lastFetchTime = useRef(0); // Throttle address fetching

  const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

  // ============ SMART INITIALIZATION WITH HYBRID APPROACH ============

  // ============ SMART INITIALIZATION WITH HYBRID APPROACH ============

  // Initialize screen with smart location selection
  useEffect(() => {
    (async () => {
      console.log("============ Location Selector Initialization ============");
      
      // If we already have stored location with address, use it immediately
      if (storedLocation?.lat && storedLocation?.lon && storedLocation?.address) {
        console.log('Using stored pickup/dropoff location, no need to fetch');
        const storedRegion = {
          latitude: storedLocation.lat,
          longitude: storedLocation.lon,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        };
        setInitialRegion(storedRegion);
        setCurrentCoords(storedRegion);
        mapReady.current = true;
        setShowUI(true);
        setLoading(false);
        setMapVisible(true);
        return;
      }

      // Show loading while getting smart location
      setLoading(true);
      setMapVisible(false);

      // Get smart initial region using hybrid approach
      const smartRegion = await getSmartInitialRegion(storedLocation);
      setInitialRegion(smartRegion);
      setCurrentCoords(smartRegion);

      // If location came from cache service, trigger background update if stale
      if (!storedLocation?.lat && locationCacheService.isLocationStale()) {
        console.log('Triggering background location update...');
        locationCacheService.getFreshLocation().then((freshLocation) => {
          if (freshLocation) {
            const freshRegion = cachedLocationToRegion(freshLocation);
            console.log('Got fresh location in background, updating map');
            setCurrentCoords(freshRegion);
            if (mapRef.current && mapReady.current) {
              mapRef.current.animateToRegion(freshRegion, 1000);
            }
          }
        });
      }

      mapReady.current = true;
      setLoading(false);
      setMapVisible(true);
    })();
  }, []);

  // Ensure map shows correct region after initialization - ONE TIME ONLY
  useEffect(() => {
    const animateToCorrectRegion = () => {
      if (mapRef.current && mapReady.current && isInitialLoad.current && mapVisible) {
        console.log('Animating map to correct region:', currentCoords);
        mapRef.current.animateToRegion(currentCoords, 0); // Immediate animation (0ms)
        isInitialLoad.current = false; // Prevent this from running again
        
        // Small delay before showing UI to ensure smooth transition
        setTimeout(() => {
          if (!storedLocation?.address) {
            // Only fetch address if we don't have stored address
            fetchAddress(currentCoords.latitude, currentCoords.longitude);
          }
        }, 200);
      }
    };

    // Small delay to ensure map is fully loaded, but only run once
    const timeoutId = setTimeout(animateToCorrectRegion, 200);
    return () => clearTimeout(timeoutId);
  }, [mapVisible]); // Depend on mapVisible to ensure map is shown before animating

  // Fetch address from coordinates using reverse geocoding
  const fetchAddress = async (lat: number, lon: number) => {
    console.log('fetchAddress called with:', lat, lon);
    
    // Throttle to prevent excessive API calls
    const now = Date.now();
    if (now - lastFetchTime.current < 1000) { // 1 second throttle
      console.log('Throttling fetchAddress call');
      return;
    }
    lastFetchTime.current = now;

    try {
      setFetchingAddress(true);
      
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const res = await fetch(`${API_URL}/api/reverse-geocode?lat=${lat}&lon=${lon}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      const data = await res.json();

      let newAddress = 'Unknown address';

      // Parse response with fallback options
      if (data?.poi?.name) {
        const poiName = data.poi.name;
        const streetName = data.address?.streetName || '';
        newAddress = streetName ? `${poiName}, ${streetName}` : poiName;
      } else if (data?.address?.freeformAddress || data?.freeformAddress) {
        newAddress = data.address?.freeformAddress || data.freeformAddress;
      }

      console.log('Fetched address:', newAddress);
      setAddress(newAddress);
      setCity(data.address?.municipality);
      skipSearchRef.current = true;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setAddress('Address lookup timed out');
      } else {
        setAddress('Failed to get address');
      }
    } finally {
      setFetchingAddress(false);
      setLoading(false); // Hide loading when address fetch completes
      // Always show UI after address fetching
      setShowUI(true);
    }
  };


  // Search for locations based on user input with debouncing
  useEffect(() => {
    if (skipSearchRef.current) {
      skipSearchRef.current = false;
      return;
    }

    if (search.trim().length === 0) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        setSearchLoading(true);

        const lat = currentCoords?.latitude;
        const lon = currentCoords?.longitude;

        const queryParams = new URLSearchParams({
          q: search.trim(),
        });

        if (lat && lon) {
          queryParams.append('lat', lat.toString());
          queryParams.append('lon', lon.toString());
        }

        const res = await fetch(`${API_URL}/api/search-location?${queryParams.toString()}`);
        const data = await res.json();
        setSearchResults(data.results || []);
      } catch (err) {
        console.error('Search failed:', err);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [search, currentCoords]);


  // Handle search result selection
  const onSelectSearchResult = (item: any) => {
    skipSearchRef.current = true;

    const region = {
      latitude: item.position.lat,
      longitude: item.position.lon,
      latitudeDelta: 0.008,
      longitudeDelta: 0.008,
    };

    setCurrentCoords(region);
    setSearch("");
    Keyboard.dismiss();
    setSearchResults([]);

    // Update location cache service with selected location
    locationCacheService.getFreshLocation();

    if (mapRef.current) {
      isManualDrag.current = false;
      mapRef.current.animateToRegion(region, animationTime.current);
    }

    // Fetch address for the selected location
    fetchAddress(item.position.lat, item.position.lon);
  };

  // Map interaction handlers
  const onPanDrag = () => {
    isManualDrag.current = true;
    // Hide search field when dragging
    setSearch('');
    setSearchResults([]);
    Keyboard.dismiss();
    if (showUI) {
      setShowUI(false);
    }
  };

  const onRegionChange = () => {
    if (!mapReady.current) return;

    if (isManualDrag.current && showUI) {
      setShowUI(false);
    }

    if (moveTimeout.current) clearTimeout(moveTimeout.current);
  };

  // Handle when user stops moving the map
  const onRegionChangeComplete = (region: Region) => {
    console.log('onRegionChangeComplete called - mapReady:', mapReady.current, 'isInitialLoad:', isInitialLoad.current, 'isZooming:', isZooming.current, 'isManualDrag:', isManualDrag.current);
    
    if (!mapReady.current) {
      console.log('Map not ready, ignoring region change');
      return; // Don't retry if map not ready, just ignore
    }

    // Skip address fetching if this is a zoom operation
    if (isZooming.current) {
      console.log('Zooming operation, skipping address fetch');
      setCurrentCoords(region);
      return;
    }

    // Skip address fetching if this is during initial load
    if (isInitialLoad.current) {
      console.log('Initial load, skipping address fetch');
      setCurrentCoords(region);
      return;
    }

    // Only fetch address if this is a manual drag by the user
    if (isManualDrag.current) {
      console.log('Manual drag detected, fetching address');
      setCurrentCoords(region);
      fetchAddress(region.latitude, region.longitude);
      
      // Update location cache when user manually selects a location
      locationCacheService.updateLocationIfStale();
      
      isManualDrag.current = false;
      setShowUI(true);
    } else {
      console.log('Not a manual drag, just updating coordinates');
      // Just update coordinates without fetching address
      setCurrentCoords(region);
    }
  };

  // Navigate to current GPS location
  const goToCurrentLocation = async () => {
    setShowUI(false);
    setLoading(true); // Show loading while getting GPS location
    
    try {
      // Use location cache service to get fresh location
      const freshLocation = await locationCacheService.getFreshLocation();
      
      if (freshLocation) {
        const region = cachedLocationToRegion(freshLocation);
        setCurrentCoords(region);
        
        if (mapRef.current) {
          isManualDrag.current = false;
          mapRef.current.animateToRegion(region, animationTime.current);
        }
        
        // Fetch address for the new location
        fetchAddress(freshLocation.latitude, freshLocation.longitude);
      } else {
        alert('Failed to get current location. Please try again.');
      }
    } catch (error) {
      console.error('Failed to get current location:', error);
      alert('Failed to get current location. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Pin animation setup
  const floatAnim = useRef(new Animated.Value(0)).current;
  const shadowScale = useRef(new Animated.Value(1)).current;
  const shadowOpacity = useRef(new Animated.Value(0.3)).current;

  // Animate pin based on UI state
  useEffect(() => {
    Animated.timing(floatAnim, {
      toValue: showUI && !fetchingAddress ? 0 : -5,
      duration: 300,
      useNativeDriver: true,
    }).start();

    Animated.parallel([
      Animated.timing(shadowScale, {
        toValue: showUI && !fetchingAddress ? 1 : 1.3,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(shadowOpacity, {
        toValue: showUI && !fetchingAddress ? 0.15 : 0.4,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [showUI, fetchingAddress]);

  // Zoom controls with adaptive step sizing
  const isZooming = useRef(false);
  const MIN_DELTA = 0.001;
  const MAX_DELTA = 0.1;

  // Calculate smart zoom step based on current zoom level
  const getZoomStep = (currentDelta: number) => {
    // Adaptive zoom: larger steps for larger deltas (zoomed out), smaller steps for smaller deltas (zoomed in)
    if (currentDelta > 0.1) {
      return currentDelta * 0.4; // 40% step when very zoomed out
    } else if (currentDelta > 0.05) {
      return currentDelta * 0.3; // 30% step when moderately zoomed out
    } else if (currentDelta > 0.008) {
      return currentDelta * 0.25; // 25% step when moderately zoomed in
    } else {
      return currentDelta * 0.2; // 20% step when very zoomed in
    }
  };

  const zoomIn = () => {
    if (!mapRef.current) return;
    
    isZooming.current = true;
    
    const zoomStep = getZoomStep(currentCoords.latitudeDelta);
    
    const newRegion = {
      ...currentCoords,
      latitudeDelta: Math.max(currentCoords.latitudeDelta - zoomStep, MIN_DELTA),
      longitudeDelta: Math.max(currentCoords.latitudeDelta - zoomStep, MIN_DELTA), // Use latitudeDelta for both
    };

    // Directly animate map without triggering address fetch
    mapRef.current.animateToRegion(newRegion, 200);
    
    setTimeout(() => { 
      isZooming.current = false; 
      setCurrentCoords(newRegion); // Update state after animation
    }, 300);
  };

  const zoomOut = () => {
    if (!mapRef.current) return;
    
    isZooming.current = true;
    
    const zoomStep = getZoomStep(currentCoords.latitudeDelta);
    
    const newRegion = {
      ...currentCoords,
      latitudeDelta: Math.min(currentCoords.latitudeDelta + zoomStep, MAX_DELTA),
      longitudeDelta: Math.min(currentCoords.latitudeDelta + zoomStep, MAX_DELTA), // Use latitudeDelta for both
    };

    // Directly animate map without triggering address fetch
    mapRef.current.animateToRegion(newRegion, 200);
    
    setTimeout(() => { 
      isZooming.current = false; 
      setCurrentCoords(newRegion); // Update state after animation
    }, 300);
  };


  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        {/* Search bar - Always show and always editable */}
        <View style={styles.searchBarContainer}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={28} color="black" />
          </TouchableOpacity>
          <TextInput
            style={styles.searchInput}
            placeholder="Enter an address to search"
            value={search}
            onChangeText={setSearch}
            editable={true} // Always editable
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => {
              setSearch('');
              setSearchResults([]);
            }}>
              <Ionicons name="close" size={22} color="gray" />
            </TouchableOpacity>
          )}
        </View>

        {/* Search results dropdown */}
        {searchResults.length > 0 && (
          <View style={styles.searchResultsContainer}>
            {searchLoading && <ActivityIndicator size="small" color="#FF6600" />}
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.searchResultItem}
                  onPress={() => onSelectSearchResult(item)}
                >
                  <Text style={styles.searchResultText}>
                    {item.poi?.name
                      ? `${item.poi.name}${item.address?.streetName ? `, ${item.address.streetName}` : ''}`
                      : item.address?.freeformAddress || 'No address available'}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* Loading Screen */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF6600" />
            <Text style={styles.loadingText}>Getting your location...</Text>
          </View>
        )}

        {/* Map Container */}
        {mapVisible && (
          <MapView
            ref={mapRef}
            key={`${initialRegion.latitude}-${initialRegion.longitude}`} // Force remount when region changes
            style={StyleSheet.absoluteFillObject}
            initialRegion={initialRegion}
            showsUserLocation={true}
            showsMyLocationButton={false}
            onPanDrag={onPanDrag}
            onRegionChange={onRegionChange}
            onRegionChangeComplete={onRegionChangeComplete}
          />
        )}

        {/* Center Pin with Animation */}
        {mapVisible && (
          <View style={styles.pinWrapper}>
            <Animated.View
              style={[
                styles.shadowCircle,
                {
                  transform: [{ scale: shadowScale }],
                  opacity: shadowOpacity,
                },
              ]}
            />
            <Animated.View style={{ transform: [{ translateY: floatAnim }] }}>
              <Ionicons name="location-sharp" size={50} color="#FF6600" />
            </Animated.View>
          </View>
        )}

        {/* Map Control Buttons */}
        {mapVisible && (
          <>
            <TouchableOpacity style={styles.zoomIn} onPress={zoomIn}>
              <Ionicons name="add" size={20} color="black" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.zoomOut} onPress={zoomOut}>
              <Ionicons name="remove" size={20} color="black" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.currentLocationButton} onPress={goToCurrentLocation}>
              <Ionicons name="navigate" size={20} color="black" />
            </TouchableOpacity>
          </>
        )}



        {/* Bottom UI Container */}
        {showUI && !fetchingAddress && (
          <View style={styles.bottomContainer}>
            <View style={styles.pickupInfo}>
              <Text style={styles.pickupLabel}>
                {mode == 'pickup' ? 'Pick-up point' : 'Drop-off point'}
              </Text>
              <Text style={styles.pickupAddress}>
                {fetchingAddress ? 'Fetching address...' : address}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => {
                const { setPickup, setDropoff } = useLocationStore.getState();

                if (mode === 'pickup') {
                  setPickup({
                    address,
                    lat: currentCoords.latitude,
                    lon: currentCoords.longitude,
                    city: city,
                  });
                } else {
                  setDropoff({
                    address,
                    lat: currentCoords.latitude,
                    lon: currentCoords.longitude,
                    city: city,
                  });
                }

                router.push('/home');
              }}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

// Styling constants for button positioning
const BUTTON_SIZE = 40;
const SPACING = 10;
const HALF_BUTTON = BUTTON_SIZE / 2;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Loading state
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  
  // Search UI Components
  searchBarContainer: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    paddingHorizontal: 12,
    paddingVertical: 6,
    elevation: 4,
  },
  backButton: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    paddingRight: 8,
  },
  searchResultsContainer: {
    position: 'absolute',
    top: 120,
    left: 16,
    right: 16,
    maxHeight: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 4,
    zIndex: 200,
  },
  searchResultItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomColor: '#eee',
    borderBottomWidth: 1,
  },
  searchResultText: {
    fontSize: 16,
    color: '#333',
  },

  // Map Pin Components
  pinWrapper: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -25,
    marginTop: -50,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  shadowCircle: {
    position: 'absolute',
    bottom: -4,
    width: 8,
    height: 8,
    backgroundColor: '#000',
    borderRadius: 50,
    opacity: 0.3,
  },

  // Map Control Buttons
  zoomIn: {
    position: 'absolute',
    top: height / 2 - HALF_BUTTON - (BUTTON_SIZE + SPACING),
    right: 10,
    backgroundColor: 'white',
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    zIndex: 50,
  },
  zoomOut: {
    position: 'absolute',
    top: height / 2 - HALF_BUTTON,
    right: 10,
    backgroundColor: 'white',
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    zIndex: 50,
  },
  currentLocationButton: {
    position: 'absolute',
    top: height / 2 - HALF_BUTTON + (BUTTON_SIZE + SPACING),
    right: 10,
    backgroundColor: 'white',
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    zIndex: 50,
  },

  // Bottom UI Components
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    paddingBottom: 60,
    backgroundColor: 'white',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 16,
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    zIndex: 20,
    width: '100%',
    elevation: 10,
  },
  pickupInfo: {
    width: '100%',
    marginBottom: 20,
  },
  pickupLabel: {
    fontSize: 14,
    color: '#666',
  },
  pickupAddress: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
    marginTop: 20,
  },
  doneButton: {
    alignSelf: 'stretch',
    backgroundColor: '#FF6600',
    borderRadius: 12,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  doneButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
});
