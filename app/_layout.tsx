// app/_layout.tsx
import { Stack } from 'expo-router';
import { useEffect } from 'react';

export default function RootLayout() {
  // Ensure location cache service starts immediately when app launches
  useEffect(() => {
    console.log('App launched - Location cache service is now running');
    
    // Optional: Trigger an immediate location update if needed
    // locationCacheService.updateLocationIfStale();
  }, []);

  return (
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="loading" />
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
          <Stack.Screen name="profile" />
          <Stack.Screen name="location-selector" />
          <Stack.Screen name="order-details" />
          <Stack.Screen name="orders" />
          <Stack.Screen name="(tabs)" />
        </Stack>
  );
}
