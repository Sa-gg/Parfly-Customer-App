import * as SecureStore from 'expo-secure-store';
import { useDeliveryStore } from '../store/useDeliveryStore';

export const initDeliverySenderFromSecureStore = async () => {
  const userDataString = await SecureStore.getItemAsync('userData');
  if (userDataString) {
    try {
      const userData = JSON.parse(userDataString);
      const userId = userData?.userId;
      if (userId) {
        useDeliveryStore.getState().setDeliveryField('sender_id', userId);
      }
    } catch (error) {
      console.error('Failed to parse userData from SecureStore:', error);
    }
  }
};
