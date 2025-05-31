import { Entypo, FontAwesome5, Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useRouter } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import CustomModal from '../../components/CustomModal'; // Adjust the import path as necessary
import { useDeliveryStore } from '../../store/useDeliveryStore';
import { useLocationStore } from '../../store/useLocationStore';
import { initDeliverySenderFromSecureStore } from '../../utils/initDeliverySender';

export default function HomeScreen() {
  const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

  React.useEffect(() => {
    initDeliverySenderFromSecureStore();
  }, []);

  const deliveryData = useDeliveryStore(state => state.deliveryData);
  const setDeliveryField = useDeliveryStore(state => state.setDeliveryField);

  // React.useEffect(() => {
  //   console.log('Current Delivery Data:', deliveryData);
  // }, [deliveryData]);


  const router = useRouter();
  const [modalVisible, setModalVisible] = useState(false);

  const pickup = useLocationStore(state => state.pickup);
  const dropoff = useLocationStore(state => state.dropoff);
  const routePoints = React.useMemo(() => ({ pickup, dropoff }), [pickup, dropoff]);

  const pickupLat = routePoints?.pickup?.lat;
  const pickupLon = routePoints?.pickup?.lon;
  const dropoffLat = routePoints?.dropoff?.lat;
  const dropoffLon = routePoints?.dropoff?.lon;

  const isValidRoute = useMemo(() => {
    return (
      pickupLat !== undefined &&
      pickupLon !== undefined &&
      dropoffLat !== undefined &&
      dropoffLon !== undefined
    );
  }, [pickupLat, pickupLon, dropoffLat, dropoffLon]);


  const hasPickupAddress = !!pickup?.address;
  const hasDropoffAddress = !!dropoff?.address;




  const [selectedService, setSelectedService] = React.useState('motorcycles');
  const services = [
    { key: 'motorcycles', label: 'Motorcycles', price: 'from ₱10', basePrice: 10, icon: <Ionicons name="bicycle-outline" size={24} /> },
    { key: 'cars', label: 'Passenger cars', price: 'from ₱40', basePrice: 10, icon: <Ionicons name="car-outline" size={24} /> },
    { key: 'trucks', label: 'Trucks', price: 'from ₱10', basePrice: 10, icon: <FontAwesome5 name="truck" size={22} /> },
  ];

  const [routeInfo, setRouteInfo] = React.useState<{ km: number; mins: number, trafficmins: number } | null>(null);

  const fetchRouteDistance = async (
    pickupLat: number,
    pickupLon: number,
    dropoffLat: number,
    dropoffLon: number
  ) => {
    try {
      const res = await fetch(
        `${API_URL}/api/route-distance?pickup_lat=${pickupLat}&pickup_lon=${pickupLon}&dropoff_lat=${dropoffLat}&dropoff_lon=${dropoffLon}`
      );

      const text = await res.text();


      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}, message: ${text}`);

      const data = JSON.parse(text);
      console.log("Fetch complete")
      return {
        km: data.distanceInKm,
        mins: data.durationInMinutes,
        trafficmins: data.trafficDelayInMinutes,
      };
    } catch (err) {
      // console.error('Route distance error:', err);
      return null;
    }
  };


  // Find selected service details
  const selectedServiceDetails = services.find((s) => s.key === selectedService);
  const distanceKm = routeInfo?.km ?? 0;
  const basePrice = selectedServiceDetails?.basePrice ?? 0;



  const fetchedOnceRef = useRef(false);

  React.useEffect(() => {
    if (fetchedOnceRef.current) return;

    if (
      pickupLat === undefined ||
      pickupLon === undefined ||
      dropoffLat === undefined ||
      dropoffLon === undefined
    ) return;

    const handler = setTimeout(() => {
      fetchRouteDistance(pickupLat, pickupLon, dropoffLat, dropoffLon)
        .then((result) => {
          setRouteInfo(result);
          fetchedOnceRef.current = true;
        });
    }, 500);

    return () => clearTimeout(handler);
  }, [pickupLat, pickupLon, dropoffLat, dropoffLon]);




  function estimateDuration(distanceInKm: number): number {
    if (distanceInKm <= 7) {
      return (distanceInKm / 30) * 60; // urban center
    } else if (distanceInKm <= 15) {
      return (distanceInKm / 35) * 60; // city edge or nearby
    } else {
      return (distanceInKm / 40) * 60; // inter-city
    }
  }

  function estimateFare(distanceInKm: number, basePrice: number): number {
    let perKmRate = 0;

    if (distanceInKm <= 2) {
      perKmRate = 10.5; // ₱31 for 1.9km → ₱10 base + ₱21
    } else if (distanceInKm <= 6) {
      perKmRate = 11; // ₱60 for 4.3km
    } else if (distanceInKm <= 10) {
      perKmRate = 12.5; // ₱113 for 8.1km, ₱147 for 10.5km
    } else {
      perKmRate = 13.5; // ₱295 for 21.6km
    }

    const fare = basePrice + distanceInKm * perKmRate;
    return Math.round(fare); // Round to nearest peso
  }

  const COMMISSION_RATE = 0.15; // 15% commission

  // Compute price parts
  const tip = deliveryData.tip || 0;
  const additionalComp = deliveryData.additional_compensation || 0;

  const partialPrice = estimateFare(distanceKm, basePrice);
  const totalPrice = partialPrice + tip + additionalComp;
  const durationMins = estimateDuration(distanceKm);

  const commissionAmount = partialPrice * COMMISSION_RATE;
  const driverEarnings = totalPrice - commissionAmount;



  // Update store when any of these values change
  React.useEffect(() => {
    if (
      pickupLat !== undefined &&
      pickupLon !== undefined &&
      dropoffLat !== undefined &&
      dropoffLon !== undefined
    ) {
      setDeliveryField('pickup_lat', pickupLat);
      setDeliveryField('pickup_long', pickupLon);
      setDeliveryField('dropoff_lat', dropoffLat);
      setDeliveryField('dropoff_long', dropoffLon);

      setDeliveryField('pickup_address', pickup?.address || '');
      setDeliveryField('dropoff_address', dropoff?.address || '');
    }

    setDeliveryField('delivery_fee', totalPrice);
    setDeliveryField('commission_amount', commissionAmount);
    setDeliveryField('driver_earnings', driverEarnings);
    setDeliveryField('distance_km', distanceKm);
    setDeliveryField('duration_minutes', durationMins);
  }, [
    pickupLat,
    pickupLon,
    dropoffLat,
    dropoffLon,
    pickup?.address,
    dropoff?.address,
    totalPrice,
    commissionAmount,
    driverEarnings,
    distanceKm,
    durationMins,
    setDeliveryField,
  ]);


  // For UI display
  const formattedPrice = `₱${totalPrice.toFixed(2)}`;


  const [loading, setLoading] = useState(false);




  const handleOrderConfirm = async () => {
    setLoading(true); // show loading indicator

    try {
      const { deliveryData } = useDeliveryStore.getState();

      const payload = {
        sender_id: deliveryData.sender_id,
        pickup_address: deliveryData.pickup_address,
        dropoff_address: deliveryData.dropoff_address,
        payer: deliveryData.payer ?? 'sender',
        add_info: deliveryData.add_info,
        pickup_lat: deliveryData.pickup_lat,
        pickup_long: deliveryData.pickup_long,
        dropoff_lat: deliveryData.dropoff_lat,
        dropoff_long: deliveryData.dropoff_long,
        parcel_amount: deliveryData.parcel_amount,
        receiver_name: deliveryData.receiver_name,
        receiver_contact: deliveryData.receiver_contact,
        delivery_fee: deliveryData.delivery_fee,
        commission_amount: deliveryData.commission_amount,
        driver_earnings: deliveryData.driver_earnings,
        commission_deducted: deliveryData.commission_deducted,
        additional_compensation: deliveryData.additional_compensation,
        tip: deliveryData.tip,
        distance_km: deliveryData.distance_km,
        duration_minutes: deliveryData.duration_minutes,
      };
      console.log('Payload to send:', payload);

      const response = await axios.post(`${API_URL}/api/client/deliveries`, payload);
      console.log('Delivery created:', response.data);

      useDeliveryStore.getState().resetDeliveryData();
      useLocationStore.getState().clearLocations();

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Delivery created successfully.',
      });

      setModalVisible(false);
    } catch (error) {
      console.error('Delivery creation failed:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: "Failed to request create delivery pls try again.",
      });
    } finally {
      setLoading(false); // hide loading indicator
      setModalVisible(false);
    }
  }


  const handlePlaceOrder = () => {
    if (!isValidRoute) {
      alert('Please select valid pick-up and drop-off locations.');
      return;
    }

    if (!hasPickupAddress || !hasDropoffAddress) {
      alert('Please set both pick-up and drop-off addresses.');
      return;
    }

    setModalVisible(true);
  };








  return (
    <View style={styles.container}>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6600" />
          <Text style={styles.loadingText}>Creating your order request...</Text>
        </View>
      ) : (
        <>

          {/* Header */}

          <View style={styles.header}>
            <Text style={styles.logo}>
              <Text style={styles.logoOrange}>PARFLY</Text>
            </Text>
          </View>

          {/* Pick-up Location */}
          <TouchableOpacity
            style={styles.optionBox}
            onPress={() =>
              router.push({
                pathname: '/pickup-location',
                params: { mode: 'pickup' },
              })
            }
          >
            <View style={styles.optionLeft}>
              <Icon name="circle-outline" size={24} color="#FF6600" />

              <View style={styles.addressContainer}>
                {hasPickupAddress ? (
                  <>
                    <Text style={styles.pickupLabel}>Pick-up Location</Text>
                    <Text style={styles.pickupAddress} numberOfLines={2} ellipsizeMode="tail">
                      {pickup.address}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.optionText}>Pick-up Location</Text>
                )}
              </View>
            </View>
            <Entypo name="chevron-right" size={20} color="gray" />
          </TouchableOpacity>

          {/* Drop-off Location */}
          <TouchableOpacity
            style={styles.optionBox}
            onPress={() =>
              router.push({
                pathname: '/pickup-location',
                params: { mode: 'dropoff' },
              })
            }


          >
            <View style={styles.optionLeft}>
              <Icon name="map-marker" size={24} color="#FF6600" />
              <View style={styles.addressContainer}>
                {hasDropoffAddress ? (
                  <>
                    <Text style={styles.pickupLabel}>Destination</Text>
                    <Text style={styles.pickupAddress} numberOfLines={2} ellipsizeMode="tail">
                      {dropoff.address}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.optionText}>Destination</Text>
                )}
              </View>
            </View>
            <Entypo name="chevron-right" size={20} color="gray" />
          </TouchableOpacity>




          {/* Service Type Selector */}
          <View style={styles.serviceSelector}>
            <View style={styles.serviceHeader}>
              <TouchableOpacity style={styles.serviceDetail} onPress={() => router.push('/order-details')}>
                <Ionicons name="options-outline" size={16} color="#333" />
                <Text style={styles.serviceText}>Details</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.serviceDetail}>
                <Ionicons name="cash-outline" size={16} color="#333" />
                <Text style={styles.serviceText}>In cash</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.serviceDetail}>
                <Ionicons name="time-outline" size={16} color="#333" />
                <Text style={styles.serviceText}>Now</Text>
              </TouchableOpacity>
            </View>

            {/* Services */}
            <View style={styles.serviceTypes}>
              {services.map(service => {
                const isSelected = selectedService === service.key;

                const handlePress = () => {
                  if (service.key === 'cars' || service.key === 'trucks') {
                    alert('Not available for now');
                    return;
                  }
                  setSelectedService(service.key);
                };

                return (
                  <TouchableOpacity
                    key={service.key}
                    style={[styles.serviceTypeBox, isSelected && styles.serviceTypeSelected]}
                    onPress={handlePress}
                  >
                    {React.cloneElement(service.icon, { color: isSelected ? 'black' : '#000' })}
                    <Text style={[styles.serviceLabel, { color: isSelected ? 'black' : '#333' }]}>{service.label}</Text>
                    <Text style={[styles.servicePrice, { color: isSelected ? 'black' : '#777' }]}>{service.price}</Text>
                  </TouchableOpacity>
                );
              })}

            </View>


            {/* Order Button */}
            <TouchableOpacity
              style={styles.orderButton}
              disabled={!hasPickupAddress || !hasDropoffAddress}
              onPress={handlePlaceOrder}
            >
              <Text style={styles.orderPrice}>{hasPickupAddress && hasDropoffAddress ? formattedPrice : `${selectedServiceDetails?.price}`}</Text>
              <Text style={styles.orderText} >ORDER</Text>
            </TouchableOpacity>

          </View>
          <CustomModal
            visible={modalVisible}
            message="Are you sure you want to place order?"
            onCancel={() => setModalVisible(false)}
            onConfirm={handleOrderConfirm}
          />


        </>
      )}
      <Toast />
    </View>
  );
}


const screenWidth = Dimensions.get('window').width;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 60,
    position: 'relative',
    height: '100%',
    width: '100%',
  },
  header: {
    marginBottom: 24,
  },
  logo: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  logoOrange: {
    color: '#FF6600',
  },
  optionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F2',
    padding: 16,
    borderRadius: 15,
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  addressContainer: {
    marginLeft: 12,
    flexShrink: 1,
  },
  pickupLabel: {
    fontSize: 12,
    color: '#999999',
    marginBottom: 2,
  },
  pickupAddress: {
    fontSize: 16,
    color: '#333333',
    flexWrap: 'wrap',
  },
  optionText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#333333',
  },
  serviceSelector: {
    position: 'absolute',
    bottom: 0,
    width: screenWidth, // <--- this works
    padding: 12,
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  serviceDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F2F2F2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  serviceText: {
    fontSize: 12,
    color: '#333',
  },
  serviceTypes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    flex: 1,
    height: 100,
  },
  serviceTypeBox: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    marginHorizontal: 4,
    backgroundColor: '#F2F2F2',

  },
  serviceTypeSelected: {
    borderWidth: 2,
    borderColor: '#FF6600',
    transform: [{ scale: 1.05 }],
  },
  serviceLabel: {
    fontSize: 12,
    color: '#333',
    marginTop: 6,
  },
  servicePrice: {
    fontSize: 11,
    color: '#777',
  },
  orderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6600',
    paddingVertical: 14,
    borderRadius: 30,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  orderPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  orderText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#555',
  },






});