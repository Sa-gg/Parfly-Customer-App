import axios from 'axios';
import { useState } from 'react';
import Toast from 'react-native-toast-message';
import { useDeliveryStore } from '../store/useDeliveryStore';
import { useLocationStore } from '../store/useLocationStore';

export const useOrderSubmission = () => {
  const [loading, setLoading] = useState(false);
  const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

  const handleOrderConfirm = async (): Promise<boolean> => {
    setLoading(true);

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
        pickup_city: deliveryData.pickup_city || '',
        dropoff_city: deliveryData.dropoff_city || '',
      };

      const response = await axios.post(`${API_URL}/api/client/deliveries`, payload);

      // Reset stores after successful order
      useDeliveryStore.getState().resetDeliveryData();
      useLocationStore.getState().clearLocations();

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Delivery created successfully.',
      });

      return true;
    } catch (error) {
      console.error('Delivery creation failed:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to create delivery. Please try again.',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    handleOrderConfirm,
  };
};
