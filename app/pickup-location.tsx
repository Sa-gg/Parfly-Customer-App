import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
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
import { useLocationStore } from '../store/useLocationStore';


const { width, height } = Dimensions.get('window');

const DEFAULT_REGION = {
  latitude: 10.6765,       // Near Bacolod City
  longitude: 122.9511,
  latitudeDelta: 0.001,      // Zoom level: adjust as needed
  longitudeDelta: 0.001,
};


export default function PickupLocationScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const {
    mode
  } = useLocalSearchParams();



  React.useEffect(() => {
    console.log("choose mode: ", mode, "from pickuplocation location run");
  }, []);


  const [search, setSearch] = useState('');
  const [address, setAddress] = useState('Fetching address...');
  const [city, setCity] = useState(''); 
  const [loading, setLoading] = useState(true);
  const [showUI, setShowUI] = useState(false);
  const [fetchingAddress, setFetchingAddress] = useState(false);
  const [currentCoords, setCurrentCoords] = useState<Region>({
    latitude: 10.6765,       // Near Bacolod City
    longitude: 122.9511,
    latitudeDelta: 0.3,      // Zoom level: adjust as needed
    longitudeDelta: 0.3,
  });


  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const moveTimeout = useRef<NodeJS.Timeout | number | null>(null);
  const mapReady = useRef(false);
  const isManualDrag = useRef(true);

  const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

  const skipSearchRef = useRef(false);

  const animationTime = useRef(500); // Animation time for map region change


  // useEffect(() => {
  //   console.log("Current coordinates updated:", currentCoords);
  // },
  //   [currentCoords]);




  useEffect(() => {
    (async () => {
      const { pickup, dropoff } = useLocationStore.getState();

      const storedLocation = mode === 'pickup' ? pickup : dropoff;

      if (storedLocation?.lat && storedLocation?.lon && storedLocation?.address) {
        const initialRegion = {
          latitude: storedLocation.lat,
          longitude: storedLocation.lon,
          latitudeDelta: 0.001,
          longitudeDelta: 0.001,
        };



        onRegionChangeComplete(initialRegion);
        // console.log("FETCHED FROM STORE");

        if (mapRef.current) {
          isManualDrag.current = false;
          mapRef.current.animateToRegion(initialRegion, animationTime.current);
        }

        setLoading(false);
        mapReady.current = true;
        return;
      }

      // Otherwise, fetch live location
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert('Permission to access location was denied');
        setLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;

      const initialRegion = {
        latitude,
        longitude,
        latitudeDelta: 0.001,
        longitudeDelta: 0.001,
      };


      // fetchAddress(latitude, longitude);
      onRegionChangeComplete(initialRegion);
      // console.log("FETCHED FROM GPS");

      if (mapRef.current) {
        isManualDrag.current = false;
        mapRef.current.animateToRegion(initialRegion, animationTime.current);
      }

      setLoading(false);
      mapReady.current = true;
    })();
  }, []);


  const fetchAddress = async (lat: number, lon: number) => {
    try {
      setFetchingAddress(true);
      const res = await fetch(`${API_URL}/api/reverse-geocode?lat=${lat}&lon=${lon}`);
      const data = await res.json();
      // console.log("==========================================================================================")
      // console.log('Fetching address for coordinates:', lat, lon);

      // console.log('Reverse geocode data:', data);

      // Check for nested structure first, fallback to top-level
      let newAddress = 'Unknown address';

      if (data?.poi?.name) {
        const poiName = data.poi.name;
        const streetName = data.address?.streetName || '';
        newAddress = streetName ? `${poiName}, ${streetName}` : poiName;
      } else if (data?.address?.freeformAddress || data?.freeformAddress) {
        newAddress = data.address?.freeformAddress || data.freeformAddress;
      }

      setAddress(newAddress);
      setCity(data.address?.municipality);

      skipSearchRef.current = true;
      // console.log('Fetched address:', newAddress);
    } catch (err) {
      setAddress('Failed to get address');
    } finally {
      setFetchingAddress(false);
    }
  };


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

        // Get current coordinates (if available)
        const lat = currentCoords?.latitude;
        const lon = currentCoords?.longitude;

        // Build query string with optional lat/lon
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
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [search, currentCoords]); // Make sure to include currentCoords in deps


  const onSelectSearchResult = (item: any) => {
    skipSearchRef.current = true;

    const lat = item.position.lat;
    const lon = item.position.lon;

    const region = {
      latitude: lat,
      longitude: lon,
      latitudeDelta: 0.001,
      longitudeDelta: 0.001,
    };

    setCurrentCoords(region);
    // setSearch(item.address.freeformAddress || item.address.street || item.address.municipality || '');
    setSearch("");
    Keyboard.dismiss();
    setSearchResults([]);
    // fetchAddress(lat, lon);
    setShowUI(false);

    if (mapRef.current) {
      isManualDrag.current = false;
      mapRef.current.animateToRegion(region, animationTime.current);
    }
  };

  // Handle pan drag events
  const onPanDrag = () => {
    isManualDrag.current = true;
  };


  // Handle region change events
  const onRegionChange = () => {
    if (!mapReady.current) return;

    if (isManualDrag.current && showUI) {
      setShowUI(false);
    }

    if (moveTimeout.current) clearTimeout(moveTimeout.current);
  };

  const numberOfTimes = useRef(0);


  // Handle region change complete events
  const onRegionChangeComplete = (region: Region) => {
    // console.log("==========================================================================================")
    // console.log(numberOfTimes.current++);
    // console.log("FIRED: onRegionChangeComplete fired:",);
    // console.log("map ready: ", mapReady.current);


    if (!mapReady.current) {
      // Retry after short delay
      setTimeout(() => {
        onRegionChangeComplete(region);
      }, 100); // retry after 100msc
      // console.log("RETRY: onRegionChangeComplete retrying:");
      return;
    }

    setCurrentCoords(region);
    fetchAddress(region.latitude, region.longitude);
    isManualDrag.current = false;
    setShowUI(true);
    // console.log("DONE: onRegionChangeComplete fired:");

    // if (moveTimeout.current) clearTimeout(moveTimeout.current);
    // // Proceed once map is ready
    // moveTimeout.current = setTimeout(() => {

    // }, 50);
  };





  // Custom function to move map to current user location
  const goToCurrentLocation = async () => {
    setShowUI(false);
    try {
      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;

      const region = {
        latitude,
        longitude,
        latitudeDelta: 0.001,
        longitudeDelta: 0.001,
      };

      setCurrentCoords(region);
      // fetchAddress(latitude, longitude);
      if (mapRef.current) {
        isManualDrag.current = false;
        mapRef.current.animateToRegion(region, animationTime.current);
      }
    } catch (error) {
      alert('Failed to get current location.');
    }
  };

  // CENTER PIN ANIMATION
  const floatAnim = useRef(new Animated.Value(0)).current;
  const shadowScale = useRef(new Animated.Value(1)).current;
  const shadowOpacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // Animate pin float
    Animated.timing(floatAnim, {
      toValue: showUI && !fetchingAddress ? 0 : -5,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Animate shadow separately
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

  const isZooming = useRef(false);
  const MIN_DELTA = 0.001;
  const MAX_DELTA = 0.3;
  const ZOOM_STEP = 0.05; // change this for faster/slower zoom

  const zoomIn = () => {
    isZooming.current = true;

    setCurrentCoords(prev => ({
      ...prev,
      latitudeDelta: Math.max(prev.latitudeDelta - ZOOM_STEP, MIN_DELTA),
      longitudeDelta: Math.max(prev.longitudeDelta - ZOOM_STEP, MIN_DELTA),
    }));

    // Reset flag after short delay (allow region update to finish)
    setTimeout(() => {
      isZooming.current = false;
    }, 500);
  };

  const zoomOut = () => {
    isZooming.current = true;

    setCurrentCoords(prev => ({
      ...prev,
      latitudeDelta: Math.min(prev.latitudeDelta + ZOOM_STEP, MAX_DELTA),
      longitudeDelta: Math.min(prev.longitudeDelta + ZOOM_STEP, MAX_DELTA),
    }));

    setTimeout(() => {
      isZooming.current = false;
    }, 500);
  };







  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        {/* Search bar */}
        {showUI && !fetchingAddress && (
          <View style={styles.searchBarContainer}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={28} color="black" />
            </TouchableOpacity>
            <TextInput
              style={styles.searchInput}
              placeholder="Enter an address to search"
              value={search}
              onChangeText={setSearch}
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
        )}

        {/* Search results dropdown */}
        {showUI && !fetchingAddress && searchResults.length > 0 && (
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

        {/* Map */}
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          initialRegion={DEFAULT_REGION}
          showsUserLocation={true}
          showsMyLocationButton={false} // Hide default button
          onPanDrag={onPanDrag}
          onRegionChange={onRegionChange}
          onRegionChangeComplete={onRegionChangeComplete}
        // region={currentCoords}

        //  mapType="satellite" // 👈 Add this line
        />

        {/* Center Pin */}
        <View style={styles.pinWrapper}>
          {/* Shadow stays fixed */}
          <Animated.View
            style={[
              styles.shadowCircle,
              {
                transform: [{ scale: shadowScale }],
                opacity: shadowOpacity,
              },
            ]}
          />

          {/* Pin floats up/down */}
          <Animated.View style={{ transform: [{ translateY: floatAnim }] }}>
            <Ionicons name="location-sharp" size={50} color="#FF6600" />
          </Animated.View>
        </View>


        {/* Custom current location button */}
        <TouchableOpacity style={styles.zoomIn} onPress={zoomIn}>
          <Ionicons name="add" size={20} color="black" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.zoomOut} onPress={zoomOut}>
          <Ionicons name="remove" size={20} color="black" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.currentLocationButton} onPress={goToCurrentLocation}>
          <Ionicons name="navigate" size={20} color="black" />
        </TouchableOpacity>



        {/* Bottom container */}
        {showUI && !fetchingAddress && (
          <View style={styles.bottomContainer}>
            <View style={styles.pickupInfo}>
              <Text style={styles.pickupLabel}>Pick-up point</Text>
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
                    city: city, // Pass city if available
                  });
                } else {
                  setDropoff({
                    address,
                    lat: currentCoords.latitude,
                    lon: currentCoords.longitude,
                    city: city, // Pass city if available
                  });
                }

                router.push('/home'); // No need to pass any params now
              }}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>



          </View>
        )}

        {/* Loading indicator */}
        {loading && (
          <ActivityIndicator
            size="large"
            color="#FF6600"
            style={{ position: 'absolute', top: '50%', alignSelf: 'center' }}
          />
        )}
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}
const BUTTON_SIZE = 40;
const SPACING = 10;  // space between buttons
const HALF_BUTTON = BUTTON_SIZE / 2;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
    paddingRight: 8, // Space between text and close icon
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
  pinWrapper: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -25, // half the icon width
    marginTop: -50,  // full icon height
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  centerPin: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -18,
    marginTop: -36,
    shadowColor: '#000',
    zIndex: 100,
    backgroundColor: 'transparent',
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



  zoomIn: {
    position: 'absolute',
    top: height / 2 - HALF_BUTTON - (BUTTON_SIZE + SPACING) * 1, // top button (plus)
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
    top: height / 2 - HALF_BUTTON, // middle button (minus)
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
    top: height / 2 - HALF_BUTTON + (BUTTON_SIZE + SPACING), // bottom button (current location)
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
    // Elevation for Android
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
