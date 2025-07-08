import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';

interface LocationPermissionState {
  loading: boolean;
  hasLocationStored: boolean;
  showModal: boolean;
}

/**
 * Custom hook to manage user location permission with modal
 * Shows modal for permission, then fetches location in background
 */
export const useLocationPermission = () => {
  const [state, setState] = useState<LocationPermissionState>({
    loading: false,
    hasLocationStored: false,
    showModal: false,
  });

  // Check for stored location on mount
  useEffect(() => {
    checkLocationStatus();
  }, []);

  /** Check if we have stored location, if not show modal */
  const checkLocationStatus = async () => {
    try {
      // Check if location services are enabled on device
      const isLocationEnabled = await Location.hasServicesEnabledAsync();

      // If location services are disabled, always show modal
      if (!isLocationEnabled) {
        setState(prev => ({ ...prev, showModal: true }));
        return;
      }

      // Check if we already have a stored location
      const hasLocation = await SecureStore.getItemAsync('lastKnownLocation');
      
      // Also check actual location permission status
      const { status } = await Location.getForegroundPermissionsAsync();

      // Show modal if:
      // 1. Location services disabled OR
      // 2. No stored location OR
      // 3. Location permission is denied/undetermined
      if (!hasLocation || status !== 'granted') {
        setState(prev => ({ ...prev, showModal: true }));
        return;
      }

      // We have location services enabled, stored location, and permission
      setState(prev => ({ ...prev, hasLocationStored: true }));
    } catch (error) {
      console.error('Failed to check location status:', error);
      // On error, still show modal to be safe
      setState(prev => ({ ...prev, showModal: true }));
    }
  };

  /** Save user's current location to secure storage */
  const saveLocationToStorage = async (latitude: number, longitude: number) => {
    try {
      const locationData = JSON.stringify({ 
        latitude, 
        longitude, 
        timestamp: Date.now() 
      });
      await SecureStore.setItemAsync('lastKnownLocation', locationData);
      setState(prev => ({ ...prev, hasLocationStored: true }));
    } catch (error) {
      console.error('Failed to save location:', error);
    }
  };

  /** Silently fetch user location in background */
  const fetchLocationSilently = async () => {
    setState(prev => ({ ...prev, loading: true }));

    try {
      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status === 'granted') {
        // Get current location
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        
        const { latitude, longitude } = location.coords;
        
        // Save location to storage
        await saveLocationToStorage(latitude, longitude);
      } else {
        // Location permission denied - using fallback
      }
    } catch (error) {
      console.error('Failed to fetch location silently:', error);
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  /** Handle user allowing location - close modal immediately, fetch in background */
  const handleAllowLocation = async () => {
    // Close modal immediately - no waiting for user
    setState(prev => ({ ...prev, showModal: false }));
    
    // Start fetching location in background (don't await - runs internally)
    // This allows the UI to continue functioning while location is being fetched
    fetchLocationSilently();
  };

  /** Handle user skipping location */
  const handleSkipLocation = () => {
    setState(prev => ({ ...prev, showModal: false }));
  };

  /** Handle modal dismiss (tap outside) */
  const handleDismissModal = () => {
    setState(prev => ({ ...prev, showModal: false }));
  };

  /** Manually fetch location (can be called when needed) */
  const fetchLocationManually = async () => {
    await fetchLocationSilently();
  };

  return {
    loading: state.loading,
    hasLocationStored: state.hasLocationStored,
    showModal: state.showModal,
    handleAllowLocation,
    handleSkipLocation,
    handleDismissModal,
    fetchLocationManually,
  };
};
