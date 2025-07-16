import { Entypo } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import CustomModal from '../../components/CustomModal';
import ServiceSelector, { services } from '../../components/delivery/ServiceSelector';
import LocationPermissionModal from '../../components/LocationPermissionModal';
import SharedHeader from '../../components/SharedHeader';
import { useDeliveryPricing } from '../../hooks/useDeliveryPricing';
import { useFilledFieldCounter } from '../../hooks/useFilledFieldCounter';
import { useLocationPermission } from '../../hooks/useLocationPermission';
import { useOrderSubmission } from '../../hooks/useOrderSubmission';
import { useRouteCalculation } from '../../hooks/useRouteCalculation';
import { locationCacheService } from '../../services/LocationCacheService';
import { useDeliveryStore } from '../../store/useDeliveryStore';
import { useLocationStore } from '../../store/useLocationStore';
import { initDeliverySenderFromSecureStore } from '../../utils/initDeliverySender';

export default function HomeScreen() {
  // Initialize delivery sender data on mount
  React.useEffect(() => {
    initDeliverySenderFromSecureStore();
  }, []);

  // Global state
  const deliveryData = useDeliveryStore(state => state.deliveryData);
  const setDeliveryField = useDeliveryStore(state => state.setDeliveryField);
  const pickup = useLocationStore(state => state.pickup);
  const dropoff = useLocationStore(state => state.dropoff);

  // Local state
  const router = useRouter();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedService, setSelectedService] = React.useState('motorcycles');

  // Location validation
  const coordinates = {
    pickupLat: pickup?.lat,
    pickupLon: pickup?.lon,
    dropoffLat: dropoff?.lat,
    dropoffLon: dropoff?.lon,
  };

  const isValidRoute = useMemo(() => {
    const { pickupLat, pickupLon, dropoffLat, dropoffLon } = coordinates;
    return (
      pickupLat !== undefined &&
      pickupLon !== undefined &&
      dropoffLat !== undefined &&
      dropoffLon !== undefined
    );
  }, [coordinates]);

  const hasPickupAddress = !!pickup?.address;
  const hasDropoffAddress = !!dropoff?.address;

  // Business logic hooks
  const { routeInfo, loadingPrice } = useRouteCalculation({
    pickupLat: coordinates.pickupLat,
    pickupLon: coordinates.pickupLon,
    dropoffLat: coordinates.dropoffLat,
    dropoffLon: coordinates.dropoffLon,
  });

  const selectedServiceDetails = services.find((s) => s.key === selectedService);
  const distanceKm = routeInfo?.km ?? 0;
  const basePrice = selectedServiceDetails?.basePrice ?? 0;

  const pricingData = useDeliveryPricing({
    distanceKm,
    basePrice,
    tip: deliveryData.tip || 0,
    additionalCompensation: deliveryData.additional_compensation || 0,
  });

  const { loading, handleOrderConfirm } = useOrderSubmission();
  const filledFieldCount = useFilledFieldCounter(deliveryData);
  
  // Location permission management with modal
  // Modal shows initially, closes immediately when user clicks enable,
  // but location fetching continues in background
  const { 
    loading: locationLoading, 
    hasLocationStored, 
    showModal: showLocationModal,
    handleAllowLocation,
    handleSkipLocation,
    handleDismissModal,
  } = useLocationPermission();

  // Sync location and pricing data to delivery store
  React.useEffect(() => {
    const { pickupLat, pickupLon, dropoffLat, dropoffLon } = coordinates;
    
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
      setDeliveryField('pickup_city', pickup?.city || '');
      setDeliveryField('dropoff_city', dropoff?.city || '');
    }

    setDeliveryField('delivery_fee', pricingData.totalPrice);
    setDeliveryField('commission_amount', pricingData.commissionAmount);
    setDeliveryField('driver_earnings', pricingData.driverEarnings);
    setDeliveryField('distance_km', distanceKm);
    setDeliveryField('duration_minutes', pricingData.durationMins);
  }, [
    coordinates.pickupLat,
    coordinates.pickupLon,
    coordinates.dropoffLat,
    coordinates.dropoffLon,
    pickup?.address,
    dropoff?.address,
    pickup?.city,
    dropoff?.city,
    pricingData.totalPrice,
    pricingData.commissionAmount,
    pricingData.driverEarnings,
    distanceKm,
    pricingData.durationMins,
    setDeliveryField,
  ]);

  // Order validation and submission
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

  // DEV: Clear cached location
  const handleClearCache = async () => {
    try {
      await locationCacheService.clearCachedLocation();
      Toast.show({
        type: 'success',
        text1: 'Cache Cleared',
        text2: 'Location cache has been cleared',
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to clear cache',
      });
    }
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
          <SharedHeader />

          {/* Location Selection Cards */}
          <TouchableOpacity
            style={styles.optionBox}
            onPress={() =>
              router.push({
                pathname: '/location-selector',
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
                pathname: '/location-selector',
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

          {/* Service Selector */}
          <ServiceSelector
            selectedService={selectedService}
            onServiceSelect={setSelectedService}
            filledFieldCount={filledFieldCount}
            hasPickupAddress={hasPickupAddress}
            hasDropoffAddress={hasDropoffAddress}
            loadingPrice={loadingPrice}
            loading={loading}
            formattedPrice={pricingData.formattedPrice}
            fallbackPrice={selectedServiceDetails?.price || 'from ₱10'}
            onOrderPress={handlePlaceOrder}
          />

          {/* DEV: Clear Cache Button */}
          {__DEV__ && (
            <TouchableOpacity
              style={styles.devButton}
              onPress={handleClearCache}
            >
              <Icon name="delete" size={20} color="#FF6600" />
              <Text style={styles.devButtonText}>Clear Location Cache</Text>
            </TouchableOpacity>
          )}

          <CustomModal
            visible={modalVisible}
            message="Are you sure you want to place order?"
            onCancel={() => setModalVisible(false)}
            onConfirm={async () => {
              const success = await handleOrderConfirm();
              if (success) {
                setModalVisible(false);
              }
            }}
          />
        </>
      )}

      {/* Location Permission Modal */}
      <LocationPermissionModal
        visible={showLocationModal}
        onAllow={handleAllowLocation}
        onSkip={handleSkipLocation}
        onDismiss={handleDismissModal}
        loading={locationLoading}
      />

      <Toast />
    </View>
  );
}

const styles = StyleSheet.create({
  // Main Container
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 60,
    position: 'relative',
    height: '100%',
    width: '100%',
  },

  // Location Selection Cards
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

  // Loading States
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

  // DEV: Development buttons
  devButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE5CC',
    padding: 12,
    borderRadius: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FF6600',
  },
  devButtonText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#FF6600',
    fontWeight: '500',
  },
});