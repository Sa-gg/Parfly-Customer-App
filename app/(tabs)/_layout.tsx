import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function AnimatedTabIcon({ focused, activeIcon, inactiveIcon, color, size }: any) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: focused ? 1.2 : 1,
      useNativeDriver: true,
      friction: 4,
      tension: 100,
    }).start();
  }, [focused]);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      {focused ? (
        <MaterialCommunityIcons name={activeIcon} size={size} color={color} />
      ) : (
        <Feather name={inactiveIcon} size={size} color={color} />
      )}
    </Animated.View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#FF6600',
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: {
          paddingTop: 5,
          paddingBottom: insets.bottom + 10,
          height: 60 + insets.bottom,
          backgroundColor: '#fff',
        },
        tabBarIcon: ({ focused, color, size }) => {
          let activeIcon = '';
          let inactiveIcon = '';

          if (route.name === 'home') {
            activeIcon = 'home-variant';
            inactiveIcon = 'home';
          } else if (route.name === 'order') {
            activeIcon = 'truck-delivery-outline'; // Delivery-focused minimalist icon
            inactiveIcon = 'package'; // Simple box/package icon
          } else if (route.name === 'favorites') {
            activeIcon = 'star';
            inactiveIcon = 'star';
          } else if (route.name === 'menu') {
            activeIcon = 'menu-open';
            inactiveIcon = 'menu';
          }

          return (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <AnimatedTabIcon
                focused={focused}
                activeIcon={activeIcon}
                inactiveIcon={inactiveIcon}
                color={color}
                size={24}
              />
            </View>
          );
        },
      })}
    >
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="order" options={{ title: 'Orders' }} />
      <Tabs.Screen name="favorites" options={{ title: 'Favorites' }} />
      <Tabs.Screen name="menu" options={{ title: 'Menu' }} />
    </Tabs>
  );
}
