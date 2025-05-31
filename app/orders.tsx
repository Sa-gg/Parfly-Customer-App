import axios from 'axios';
import { useLocalSearchParams } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export default function OrderDetails() {
    const params = useLocalSearchParams();
    const deliveryId = params.delivery_id;
    const [delivery, setDelivery] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

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
                const userId = userData.userId;

                const res = await axios.get(`${API_URL}/api/client/deliveries/${userId}/${deliveryId}`);
                setDelivery(res.data);
                // console.log('Delivery details:', res.data);
            } catch (err: any) {
                console.error('Error fetching delivery:', err);
                setError('Failed to load delivery details.');
            } finally {
                setLoading(false);
            }
        };

        if (deliveryId) fetchDeliveryDetails();
    }, [deliveryId]);

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#FF6600" />
                <Text style={styles.loadingText}>Loading delivery...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.center}>
                <Text style={styles.error}>{error}</Text>
            </View>
        );
    }

    if (!delivery) {
        return (
            <View style={styles.center}>
                <Text>No delivery found.</Text>
            </View>
        );
    }

    const isValidCoordinates =
        !isNaN(Number(delivery.pickup_lat)) &&
        !isNaN(Number(delivery.pickup_long)) &&
        !isNaN(Number(delivery.dropoff_lat)) &&
        !isNaN(Number(delivery.dropoff_long));


    return (
        <View style={styles.container}>
            <Text style={styles.title}>Order Details</Text>
            <Text style={styles.label}>Pickup:</Text>
            <Text style={styles.value}>{delivery.pickup_address}</Text>

            <Text style={styles.label}>Dropoff:</Text>
            <Text style={styles.value}>{delivery.dropoff_address}</Text>

            <Text style={styles.label}>Receiver:</Text>
            <Text style={styles.value}>
                {delivery.receiver_name} ({delivery.receiver_contact})
            </Text>

            <Text style={styles.label}>Status:</Text>
            <Text style={styles.value}>{delivery.status}</Text>

            <Text style={styles.label}>Parcel Amount:</Text>
            <Text style={styles.value}>₱{delivery.parcel_amount}</Text>

            {/* Map Section */}
            {delivery.pickup_lat && delivery.pickup_long && delivery.dropoff_lat && delivery.dropoff_long && isValidCoordinates && (
                <MapView
                    style={styles.map}
                    initialRegion={{
                        latitude: Number(delivery.pickup_lat),
                        longitude: Number(delivery.pickup_long),
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01,
                    }}
                >
                    <Marker
                        coordinate={{
                            latitude: Number(delivery.pickup_lat),
                            longitude: Number(delivery.pickup_long),
                        }}
                        title="Pickup Location"
                        pinColor="green"
                    />
                    <Marker
                        coordinate={{
                            latitude: Number(delivery.dropoff_lat),
                            longitude: Number(delivery.dropoff_long),
                        }}
                        title="Dropoff Location"
                        pinColor="red"
                    />
                </MapView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#fff',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 10,
        color: '#888',
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#FF6600',
        marginBottom: 20,
    },
    label: {
        fontWeight: 'bold',
        marginTop: 12,
        fontSize: 16,
    },
    value: {
        fontSize: 16,
        color: '#333',
    },
    error: {
        color: 'red',
        fontSize: 16,
    },
    map: {
        width: Dimensions.get('window').width - 40,
        height: 250,
        marginTop: 20,
        borderRadius: 10,
    },
});
