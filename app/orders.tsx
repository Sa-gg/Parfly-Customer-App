import { Ionicons } from '@expo/vector-icons';
import AntDesign from '@expo/vector-icons/AntDesign';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import axios from 'axios';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Dimensions,
    PanResponder,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { default as Icon } from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDeliveryStore } from '../store/useDeliveryStore';
import { useLocationStore } from '../store/useLocationStore';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
const TOMTOM_API_KEY = 'ZCWImM26K0V0vE9FKdpmR2wPf0VJL5jH';

export default function OrderDetails() {
    const router = useRouter();
    const { delivery_id: deliveryId } = useLocalSearchParams();
    const mapRef = useRef<MapView>(null);
    const [delivery, setDelivery] = useState<any>(null);
    const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [currentZoom, setCurrentZoom] = useState(0.003);
    const [isMapReady, setIsMapReady] = useState(false);


    const bottomSheetHeightCollapsed = SCREEN_HEIGHT * 0.15;
    const bottomSheetHeightExpanded = SCREEN_HEIGHT * 0.55;
    const animation = useRef(new Animated.Value(bottomSheetHeightExpanded)).current;
    const [expanded, setExpanded] = useState(true);

    const fetchRoute = async (deliveryData: any) => {
        try {
            const { pickup_lat, pickup_long, dropoff_lat, dropoff_long } = deliveryData;
            const url = `https://api.tomtom.com/routing/1/calculateRoute/${pickup_lat},${pickup_long}:${dropoff_lat},${dropoff_long}/json?key=${TOMTOM_API_KEY}&instructionsType=text`;
            const res = await axios.get(url);
            const points = res.data.routes[0].legs[0].points;
            const coords = points.map((point: any) => ({
                latitude: point.latitude,
                longitude: point.longitude,
            }));
            setRouteCoords(coords);
        } catch (err) {
            console.error('Error fetching route:', err);
        }
    };

    useEffect(() => {
        const fetchDeliveryDetails = async () => {
            try {
                const userDataString = await SecureStore.getItemAsync('userData');
                if (!userDataString) {
                    setError('User not authenticated.');
                    setLoading(false);
                    return;
                }
                const userData = JSON.parse(userDataString);
                const res = await axios.get(`${API_URL}/api/client/deliveries/${userData.userId}/${deliveryId}`);
                setDelivery(res.data);
                fetchRoute(res.data);
            } catch (err) {
                setError('Failed to load delivery details.');
            } finally {
                setLoading(false);
            }
        };

        const getInitialLocation = async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;
            // Location permission granted, user location will be shown via showsUserLocation
        };


        if (deliveryId) fetchDeliveryDetails();
        getInitialLocation();
    }, [deliveryId]);

    // 🛠️ Add this useEffect to focus on dropoff location only after map is ready and delivery is loaded
    useEffect(() => {
        if (isMapReady && delivery && isValidCoordinates) {
            mapRef.current?.animateToRegion({
                latitude: parseFloat(delivery.dropoff_lat),
                longitude: parseFloat(delivery.dropoff_long),
                latitudeDelta: currentZoom,
                longitudeDelta: currentZoom,
            }, 300);

        }
    }, [isMapReady, delivery]);

    // ✅ Modify zoomIn and zoomOut to ensure map is ready before executing
    const zoomIn = async () => {
        if (isMapReady && mapRef.current) {
            const camera = await mapRef.current.getCamera();
            const newZoom = Math.max(currentZoom / 2, 0.002);
            setCurrentZoom(newZoom);
            mapRef.current.animateToRegion({
                latitude: camera.center.latitude,
                longitude: camera.center.longitude,
                latitudeDelta: newZoom,
                longitudeDelta: newZoom,
            }, 300);
        }
    };

    const zoomOut = async () => {
        if (isMapReady && mapRef.current) {
            const camera = await mapRef.current.getCamera();
            const newZoom = Math.min(currentZoom * 2, 1);
            setCurrentZoom(newZoom);
            mapRef.current.animateToRegion({
                latitude: camera.center.latitude,
                longitude: camera.center.longitude,
                latitudeDelta: newZoom,
                longitudeDelta: newZoom,
            }, 300);
        }
    };

    const goToCurrentLocation = async () => {
        if (!isMapReady || !mapRef.current) return;

        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;
            
            const location = await Location.getCurrentPositionAsync({});
            const { latitude, longitude } = location.coords;

            mapRef.current.animateToRegion({
                latitude,
                longitude,
                latitudeDelta: currentZoom,
                longitudeDelta: currentZoom,
            }, 300);
        } catch (error) {
            console.error('Failed to get current location:', error);
        }
    };

    const getStatusHeader = () => {
        switch (delivery?.status) {
            case 'cancelled': return 'Your order was canceled';
            case 'pending': return "We're looking for drivers near you";
            case 'accepted': return 'A driver has accepted your order';
            case 'in_transit': return 'Your order is on the way!';
            case 'completed': return 'Your order has been delivered!';
            default: return 'Delivery Status';
        }
    };

    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 10,
            onPanResponderMove: (_, gestureState) => {
                let newHeight = (expanded ? bottomSheetHeightExpanded : bottomSheetHeightCollapsed) - gestureState.dy;
                newHeight = Math.min(bottomSheetHeightExpanded, Math.max(bottomSheetHeightCollapsed, newHeight));
                animation.setValue(newHeight);
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dy > 50) collapsePanel();
                else if (gestureState.dy < -50) expandPanel();
                else expanded ? expandPanel() : collapsePanel();
            },
        })
    ).current;

    const expandPanel = () => {
        setExpanded(true);
        Animated.timing(animation, { toValue: bottomSheetHeightExpanded, duration: 300, useNativeDriver: false }).start();
    };

    const collapsePanel = () => {
        setExpanded(false);
        Animated.timing(animation, { toValue: bottomSheetHeightCollapsed, duration: 300, useNativeDriver: false }).start();
    };

    if (loading) return <View style={styles.center}><Text>Loading delivery...</Text></View>;
    if (error || !delivery) return <View style={styles.center}><Text style={styles.error}>{error || 'No delivery found.'}</Text></View>;

    const isValidCoordinates =
        !isNaN(parseFloat(delivery.pickup_lat)) &&
        !isNaN(parseFloat(delivery.pickup_long)) &&
        !isNaN(parseFloat(delivery.dropoff_lat)) &&
        !isNaN(parseFloat(delivery.dropoff_long));




    const handleCancelOrder = async () => {
        try {
            const response = await axios.patch(`${API_URL}/api/client/deliveries/${deliveryId}`, {
                status: 'cancelled',
                
            });

            if (response.status === 200) {
                Alert.alert('Success', 'Delivery has been cancelled.');
                router.back(); // Navigate back after cancellation
            } else {
                Alert.alert('Failed', 'Could not cancel delivery.');
            }
        } catch (error) {
            console.error('Cancel order failed:', error);
            Alert.alert('Error', 'Something went wrong while cancelling.');
        }
    };

    const { setPickup, setDropoff } = useLocationStore.getState();


    const handleReturnRoute = () => {
        router.push(`/home`);
        setPickup({
            address: delivery.pickup_address,
            lat: delivery.pickup_lat,
            lon: delivery.pickup_long,
            city: delivery.pickup_city, // Pass city if available
        });
        setDropoff({
            address: delivery.dropoff_address,
            lat: delivery.dropoff_lat,
            lon: delivery.dropoff_long,
            city: delivery.dropoff_city, // Pass city if available
        });

    }
    const { setDeliveryField } = useDeliveryStore.getState();


    const handleRepeatOrder = () => {

        setPickup({
            address: delivery.pickup_address,
            lat: delivery.pickup_lat,
            lon: delivery.pickup_long,
            city: delivery.pickup_city, // Pass city if available
        });
        setDropoff({
            address: delivery.dropoff_address,
            lat: delivery.dropoff_lat,
            lon: delivery.dropoff_long,
            city: delivery.dropoff_city, // Pass city if available
        });

        setDeliveryField('sender_id', delivery.sender_id);
        setDeliveryField('receiver_id', delivery.receiver_id);
        setDeliveryField('driver_id', delivery.driver_id);

        setDeliveryField('pickup_address', delivery.pickup_address);
        setDeliveryField('dropoff_address', delivery.dropoff_address);
        setDeliveryField('pickup_lat', Number(delivery.pickup_lat));
        setDeliveryField('pickup_long', Number(delivery.pickup_long));
        setDeliveryField('dropoff_lat', Number(delivery.dropoff_lat));
        setDeliveryField('dropoff_long', Number(delivery.dropoff_long));

        setDeliveryField('pickup_city', delivery.pickup_city);
        setDeliveryField('dropoff_city', delivery.dropoff_city);

        setDeliveryField('parcel_amount', delivery.parcel_amount);
        setDeliveryField('payer', delivery.payer);
        setDeliveryField('add_info', delivery.add_info || '');
        setDeliveryField('status', 'pending'); // Reset to 'pending'

        setDeliveryField('receiver_name', delivery.receiver_name || '');
        setDeliveryField('receiver_contact', delivery.receiver_contact || '');

        setDeliveryField('delivery_fee', Number(delivery.delivery_fee));
        setDeliveryField('commission_amount', Number(delivery.commission_amount));
        setDeliveryField('driver_earnings', Number(delivery.driver_earnings));
        setDeliveryField('commission_deducted', delivery.commission_deducted);
        setDeliveryField('additional_compensation', Number(delivery.additional_compensation));
        setDeliveryField('tip', Number(delivery.tip));

        setDeliveryField('distance_km', Number(delivery.distance_km));
        setDeliveryField('duration_minutes', Number(delivery.duration_minutes));

        setDeliveryField('accepted_at', null);
        setDeliveryField('received_at', null);

        router.push('/home'); // Navigate to home to start a new order
    };




    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.header}>
                <Pressable onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="black" />
                </Pressable>
                <Text style={styles.logo}>PARFLY</Text>
                <View style={{ width: 24 }} />
            </SafeAreaView>

            {isValidCoordinates && (
                <MapView
                    ref={mapRef}
                    provider={PROVIDER_GOOGLE}
                    style={StyleSheet.absoluteFill}
                    initialRegion={{
                        latitude: parseFloat(delivery.dropoff_lat),
                        longitude: parseFloat(delivery.dropoff_long),
                        latitudeDelta: currentZoom,
                        longitudeDelta: currentZoom,
                    }}
                    showsUserLocation={true}
                    showsMyLocationButton={false}
                    onMapReady={() => setIsMapReady(true)} // 🛠️ wait for map to be ready
                >
                    {/* Pickup Marker */}
                    <Marker 
                        coordinate={{ 
                            latitude: parseFloat(delivery.pickup_lat), 
                            longitude: parseFloat(delivery.pickup_long) 
                        }} 
                        title="Pickup Location"
                        description={delivery.pickup_address}
                    >
                        <Icon name="record-circle-outline" size={30} color="#FF6600" />
                    </Marker>

                    {/* Dropoff Marker */}
                    <Marker 
                        coordinate={{ 
                            latitude: parseFloat(delivery.dropoff_lat), 
                            longitude: parseFloat(delivery.dropoff_long) 
                        }} 
                        title="Dropoff Location"
                        description={delivery.dropoff_address}
                    >
                        <Icon name="map-marker" size={36} color="#FF6600" />
                    </Marker>

                    {routeCoords.length > 0 && (
                        <Polyline coordinates={routeCoords} strokeColor="#FF6600" strokeWidth={4} />
                    )}
                </MapView>
            )}

            <TouchableOpacity style={styles.zoomIn} onPress={zoomIn}>
                <Ionicons name="add" size={22} color="black" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.zoomOut} onPress={zoomOut}>
                <Ionicons name="remove" size={22} color="black" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.currentLocationButton} onPress={goToCurrentLocation}>
                <Ionicons name="navigate" size={22} color="black" />
            </TouchableOpacity>

            {expanded && <Pressable style={styles.overlay} onPress={() => collapsePanel()} />}

            <Animated.View style={[styles.bottomSheet, { height: animation }]} {...panResponder.panHandlers}>
                <Pressable style={styles.dragHandle} onPress={() => (expanded ? collapsePanel() : expandPanel())}>
                    <View style={styles.dragBar} />
                    <Text style={styles.statusText}>{getStatusHeader()}</Text>
                </Pressable>

                {expanded && (
                    <View style={styles.sheetContent}>
                        {!['in_transit', 'completed', 'cancelled'].includes(delivery.status) && (
                            <View style={styles.actions}>
                                <View style={styles.actionItem}>
                                    <Pressable style={styles.iconButton}>
                                        <Ionicons name="create-outline" size={35} color="#FF6600" />
                                    </Pressable>
                                    <Text style={styles.actionLabel}>Edit</Text>
                                </View>
                                <View style={styles.actionItem}>
                                    <Pressable style={styles.iconButton}>
                                        <MaterialIcons name="electric-bolt" size={35} color="#FF6600" />
                                    </Pressable>
                                    <Text style={styles.actionLabel}>Rush Order</Text>
                                </View>
                                <View style={styles.actionItem}>
                                    <Pressable onPress={handleCancelOrder} style={[styles.iconButton, ]}>
                                        <AntDesign name="close" size={35} color="#cc0000" />
                                     
                                    </Pressable>
                                    <Text style={styles.actionLabel}>Cancel</Text>
                                </View>
                            </View>
                        )}

                        {['in_transit', 'completed', 'cancelled'].includes(delivery.status) && (
                            <View style={styles.actions}>
                                <Pressable style={styles.iconButton}>
                                    <MaterialIcons name="contact-support" size={40} color="#FF6600" />
                                </Pressable>

                            </View>
                        )}

                        {/* Pickup row */}
                        <View style={styles.addressRow}>
                            <View style={styles.rowLeft}>
                                <View style={styles.iconLabelRow}>
                                    <Icon name="record-circle-outline" size={16} color="#FF6600" />
                                    <Text style={styles.label}>Pickup:</Text>
                                </View>
                                <Text style={styles.addressValue}>
                                    {delivery.pickup_address ?? '-'}
                                </Text>
                            </View>
                            <Text style={styles.feeText}>₱{delivery.delivery_fee ?? '-'}</Text>
                        </View>

                        {/* Dropoff row */}
                        <View style={styles.addressRow}>
                            <View style={styles.rowLeft}>
                                <View style={styles.iconLabelRow}>
                                    <Icon name="map-marker" size={16} color="#FF6600" />
                                    <Text style={styles.label}>Dropoff:</Text>
                                </View>
                                <Text style={styles.addressValue}>
                                    {delivery.dropoff_address ?? '-'}
                                </Text>
                            </View>
                            <Text style={styles.feeText}></Text>
                        </View>




                        {/* Footer buttons */}
                        <View style={styles.footerRow}>
                            <Pressable style={styles.connectedBtnLeft} onPress={handleReturnRoute}>
                                <Text style={styles.connectedBtnText}>Return Route</Text>
                            </Pressable>
                            <Pressable style={styles.connectedBtnRight} onPress={handleRepeatOrder}>
                                <Text style={styles.connectedBtnText}>Repeat</Text>
                            </Pressable>
                        </View>
                    </View>
                )}

            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, position: 'relative' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    error: { color: 'red', fontSize: 16 },
    header: {
        zIndex: 99,
        position: 'absolute',
        top: 50,
        left: 20,
        right: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    logo: { fontSize: 18, fontWeight: 'bold', color: '#FF6600' },
    zoomIn: {
        position: 'absolute',
        right: 20,
        bottom: 280,
        backgroundColor: '#fff',
        padding: 10,
        borderRadius: 30,
        elevation: 4,
    },
    zoomOut: {
        position: 'absolute',
        right: 20,
        bottom: 230,
        backgroundColor: '#fff',
        padding: 10,
        borderRadius: 30,
        elevation: 4,
    },
    currentLocationButton: {
        position: 'absolute',
        right: 20,
        bottom: 180,
        backgroundColor: '#fff',
        padding: 10,
        borderRadius: 30,
        elevation: 4,
    },
    bottomSheet: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'white',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 5,
        overflow: 'hidden',
        zIndex: 100,
    },
    dragHandle: {
        paddingVertical: 10,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
    },
    dragBar: {
        width: 40,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: '#ccc',
        marginBottom: 6,
    },
    statusText: { fontSize: 16, fontWeight: 'bold', color: '#FF6600' },
    sheetContent: { padding: 20 },
    row: { marginBottom: 12 },
    value: { fontSize: 15, color: '#555' },
    actions: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 20,
    },
    actionBtn: {
        flex: 1,
        backgroundColor: '#f1f1f1',
        padding: 10,
        borderRadius: 8,
        marginHorizontal: 5,
        alignItems: 'center',
    },
    footerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 20,
        alignItems: 'center',
        marginBottom: 90,
    },
    repeatBtn: {
        backgroundColor: '#eee',
        padding: 8,
        borderRadius: 8,
    },
    overlay: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.1)',
    },
    iconButton: {
        width: 60,
        height: 60,
        borderRadius: 50,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 6,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },

    rowIcon: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },

    connectedBtnLeft: {
        flex: 1,
        backgroundColor: '#FF6600',
        paddingVertical: 17,
        borderTopLeftRadius: 10,
        borderBottomLeftRadius: 10,
        alignItems: 'center',
        marginRight: 1,
    },

    connectedBtnRight: {
        flex: 1,
        backgroundColor: '#FF6600',
        paddingVertical: 17,
        borderTopRightRadius: 10,
        borderBottomRightRadius: 10,
        alignItems: 'center',
        marginLeft: 1,
    },

    connectedBtnText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 16,
    },
    addressRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center', // keep price vertically centered with left side block
        marginBottom: 12,
    },

    rowLeft: {
        flex: 1,
        flexDirection: 'column', // stack icon/label and address vertically
        // alignItems: 'flex-start', // default
    }, iconLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },

    label: {
        fontWeight: '600',
        color: '#333',
        marginLeft: 6,
    },

    addressValue: {
        fontSize: 15,
        color: '#555',
        flexShrink: 1,
        flexWrap: 'wrap', // allow wrapping
        marginTop: 2, // slight spacing from icon/label row
    },

    feeText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FF6600',
        marginLeft: 10,
        minWidth: 70,
        textAlign: 'right',
    },
    actionItem: {
        alignItems: 'center',
        marginHorizontal: 6,
    },
    actionLabel: {
        marginTop: 4,
        fontSize: 13,
        fontWeight: '500',
        color: '#555',
        textAlign: 'center',
    },


    // optionally, make fee stand out more:
    // add background, padding, or borderRadius if you want
});