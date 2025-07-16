// app/loading.tsx
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoadingScreen() {
  const router = useRouter();

  useEffect(() => {
    const checkLoginStatus = async () => {
      const token = await SecureStore.getItemAsync('userToken');
      setTimeout(() => {
        if (token) {
          router.replace('/home'); // or your actual home path
        } else {
          router.replace('/login');
        }
      }, 1500); // fake loading delay
    };

    checkLoginStatus();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.logo}>Parlfy</Text>
      <ActivityIndicator size="large" color="#FF6600" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  logo: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FF6600',
    marginBottom: 20,
  },
});
