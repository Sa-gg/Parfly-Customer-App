import axios from 'axios';
import { useFocusEffect, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  AppStateStatus,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Menu, Provider } from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import SharedHeader from '../../components/SharedHeader';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * Orders Screen - Displays current and completed delivery orders
 * Features real-time polling for order updates and pull-to-refresh
 */
export default function OrdersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Core state for orders data and UI
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [visibleMenu, setVisibleMenu] = useState<string | null>(null);

  // Animation system for smooth order transitions
  const fadeAnimMap = useRef(new Map<string, Animated.Value>()).current;
  
  // Real-time polling system refs
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const lastFetchRef = useRef<number>(0);
  const isActiveRef = useRef(true);

  // Menu controls
  const openMenu = (id: string) => setVisibleMenu(id);
  const closeMenu = () => setVisibleMenu(null);

  /**
   * Fetch orders with smart caching and duplicate prevention
   * @param showLoader - Whether to show loading indicator
   */
  const fetchCompletedOrders = async (showLoader = false) => {
    const now = Date.now();
    
    // Prevent duplicate API calls within 2 seconds
    if (now - lastFetchRef.current < 2000 && !showLoader) return;
    lastFetchRef.current = now;

    try {
      if (showLoader) setLoading(true);
      
      const storedUser = await SecureStore.getItemAsync('userData');
      if (!storedUser) return;

      const { userId } = JSON.parse(storedUser);
      const response = await axios.get(`${API_URL}/api/client/deliveries/${userId}`);

      const filtered = response.data.filter((order: any) =>
        ['completed', 'cancelled', 'pending', 'accepted', 'in_transit'].includes(order.status)
      );

      // Only update if data actually changed
      const hasChanged = JSON.stringify(filtered) !== JSON.stringify(orders);
      if (hasChanged) {
        setOrders(filtered);

        // Setup animations for new orders
        filtered.forEach((order: any) => {
          const orderId = order.delivery_id.toString();
          if (!fadeAnimMap.has(orderId)) {
            fadeAnimMap.set(orderId, new Animated.Value(0));
          }
          
          const anim = fadeAnimMap.get(orderId);
          if (anim) {
            Animated.timing(anim, {
              toValue: 1,
              duration: 500,
              useNativeDriver: true,
            }).start();
          }
        });
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ============ REAL-TIME POLLING SYSTEM ============
  
  /** Start polling for order updates every 5 seconds */
  const startPolling = useCallback(() => {
    if (intervalRef.current) return; // Already polling
    
    intervalRef.current = setInterval(() => {
      if (isActiveRef.current && appStateRef.current === 'active') {
        fetchCompletedOrders(false);
      }
    }, 5000);
  }, []);

  /** Stop the polling interval */
  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  /** Handle app background/foreground state changes */
  const handleAppStateChange = useCallback((nextAppState: AppStateStatus) => {
    appStateRef.current = nextAppState;
    
    if (nextAppState === 'active' && isActiveRef.current) {
      fetchCompletedOrders(false);
      startPolling();
    } else {
      stopPolling(); // Save battery when app is backgrounded
    }
  }, [startPolling, stopPolling]);

  // ============ LIFECYCLE HOOKS ============
  
  /** Handle screen focus changes - start/stop polling when screen is focused/unfocused */
  useFocusEffect(
    useCallback(() => {
      isActiveRef.current = true;
      fetchCompletedOrders(true);
      startPolling();

      return () => {
        isActiveRef.current = false;
        stopPolling();
      };
    }, [startPolling, stopPolling])
  );

  /** Setup app state listener for background/foreground detection */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
      stopPolling();
    };
  }, [handleAppStateChange, stopPolling]);

  // ============ UTILITY FUNCTIONS ============
  
  /** Manual refresh handler for pull-to-refresh */
  const onRefresh = () => {
    setRefreshing(true);
    fetchCompletedOrders(false);
  };

  /** Format date for display */
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    };
    return date.toLocaleString('en-GB', options);
  };

  /** Get status message for current orders */
  const getStatusMessage = (status: string) => {
    switch (status) {
      case 'pending': return "We're looking for drivers near you";
      case 'accepted': return 'A driver has accepted your order';
      case 'in_transit': return 'Your order is on the way!';
      default: return '';
    }
  };

  /** Navigate to order details */
  const navigateToOrderDetails = (deliveryId: string) => {
    router.push({
      pathname: '/order-location',
      params: { delivery_id: deliveryId },
    });
  };

  // ============ RENDER FUNCTIONS ============
  
  /** Render completed order item with animations */
  const renderCompletedOrderItem = ({ item }: { item: any }) => {
    const anim = fadeAnimMap.get(item.delivery_id.toString()) || new Animated.Value(1);

    return (
      <Animated.View key={item.delivery_id} style={[styles.card, { opacity: anim }]}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => navigateToOrderDetails(item.delivery_id.toString())}
        >
          <View style={styles.rowBetween}>
            {/* Addresses */}
            <View style={{ flex: 1, paddingRight: 8 }}>
              <View style={styles.row}>
                <Icon name="record-circle-outline" size={16} color="#FF6600" />
                <Text style={styles.locationText} numberOfLines={1}>
                  {item.pickup_address}
                </Text>
              </View>
              {item.dropoff_address && (
                <View style={styles.row}>
                  <Icon name="map-marker" size={16} color="#FF6600" />
                  <Text style={styles.locationText} numberOfLines={1}>
                    {item.dropoff_address}
                  </Text>
                </View>
              )}
            </View>

            {/* Menu */}
            <View>
              <Menu
                visible={visibleMenu === item.delivery_id.toString()}
                onDismiss={closeMenu}
                anchor={
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      openMenu(item.delivery_id.toString());
                    }}
                  >
                    <Icon name="dots-vertical" size={24} />
                  </TouchableOpacity>
                }
              >
                <Menu.Item onPress={() => {}} title="Delete" />
                <Menu.Item onPress={() => {}} title="Repeat" />
                <Menu.Item onPress={() => {}} title="Return route" />
              </Menu>
            </View>
          </View>

          {/* Date and Status */}
          <View style={styles.rowBetween}>
            <Text style={styles.dateText}>
              {`${formatDate(item.created_at)} / ${item.status}`}
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // ============ DATA FILTERING ============
  
  const currentOrders = orders.filter((o) =>
    ['pending', 'accepted', 'in_transit'].includes(o.status)
  );
  const completedOrders = orders.filter((o) =>
    ['completed', 'cancelled'].includes(o.status)
  );

  // ============ MAIN RENDER ============
  
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <Provider>
        <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <SharedHeader isOrdersTab />

        <ScrollView
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          keyboardShouldPersistTaps="handled"
        >
          {loading && !refreshing ? (
            <ActivityIndicator size="large" color="#FF6600" />
          ) : (
            <>
              {/* Current Orders Section */}
              {currentOrders.length > 0 && (
                <>
                  <Text style={styles.subtitle}>Current Orders</Text>
                  {currentOrders.map((item) => {
                    const anim = fadeAnimMap.get(item.delivery_id.toString()) || new Animated.Value(1);
                    
                    return (
                      <View key={item.delivery_id}>
                        {/* Status Header - Clickable */}
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => navigateToOrderDetails(item.delivery_id.toString())}
                        >
                          <View style={styles.currentHeading}>
                            <Text style={styles.currentHeadingText}>
                              {getStatusMessage(item.status)}
                            </Text>
                          </View>
                        </TouchableOpacity>

                        {/* Order Card */}
                        <Animated.View style={[styles.card, { opacity: anim }]}>
                          <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => navigateToOrderDetails(item.delivery_id.toString())}
                          >
                            <View style={{ flex: 1 }}>
                              {/* Pickup Address */}
                              <View style={styles.row}>
                                <Icon name="record-circle-outline" size={16} color="#FF6600" />
                                <Text style={styles.locationText} numberOfLines={1}>
                                  {item.pickup_address}
                                </Text>
                              </View>
                              
                              {/* Dropoff Address */}
                              {item.dropoff_address && (
                                <View style={styles.row}>
                                  <Icon name="map-marker" size={16} color="#FF6600" />
                                  <Text style={styles.locationText} numberOfLines={1}>
                                    {item.dropoff_address}
                                  </Text>
                                </View>
                              )}

                              {/* Price Row */}
                              <View style={styles.bottomRow}>
                                <Text style={styles.inCashText}>In cash</Text>
                                <Text style={styles.priceText}>
                                  ₱{Number(item.delivery_fee || 0).toFixed(2)}
                                </Text>
                              </View>
                            </View>
                          </TouchableOpacity>
                        </Animated.View>
                      </View>
                    );
                  })}
                </>
              )}

              {/* Completed Orders Section */}
              <Text style={styles.subtitle}>Completed Orders</Text>
              {completedOrders.map((item) => renderCompletedOrderItem({ item }))}
            </>
          )}
        </ScrollView>
      </View>
    </Provider>
    </SafeAreaView>
  );
}

// ============ STYLES ============

const styles = StyleSheet.create({
  // Safe Area
  safeArea: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  // Layout
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    paddingHorizontal: 16,
    position: 'relative',
    height: '100%',
    width: '100%',
    paddingTop: 20,
  },

  // Typography
  subtitle: {
    fontSize: 16,
    marginBottom: 12,
    marginTop: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  locationText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#333',
    flexShrink: 1,
  },
  dateText: {
    fontSize: 13,
    color: '#777',
    marginTop: 15,
  },
  priceText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  inCashText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },

  // Cards and Containers
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderBottomWidth: 2,
    borderBottomColor: '#CCCCCC',
  },
  currentHeading: {
    backgroundColor: '#FF6600',
    padding: 15,
    borderRadius: 6,
    marginBottom: -5,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  currentHeadingText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'left',
    marginLeft: 10,
  },

  // Layout Helpers
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingHorizontal: 6,
    alignItems: 'center',
  },

});
