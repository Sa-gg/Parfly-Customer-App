// app/_layout.tsx
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="loading" />
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
          <Stack.Screen name="profile" />
          <Stack.Screen name="pickup-location" />
          <Stack.Screen name="order-details" />
          <Stack.Screen name="orders" />
          <Stack.Screen name="(tabs)" />
        </Stack>
  );
}
