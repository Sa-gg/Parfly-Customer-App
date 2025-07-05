import axios from 'axios';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Menu, Provider } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import SharedHeader from '../../components/SharedHeader'; // Adjust the import path as necessary

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export default function CompletedOrdersScreen() {
  const router = useRouter();

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [visibleMenu, setVisibleMenu] = useState<string | null>(null);

  const fadeAnimMap = useRef(new Map<string, Animated.Value>()).current;

  const openMenu = (id: string) => setVisibleMenu(id);
  const closeMenu = () => setVisibleMenu(null);

  const fetchCompletedOrders = async () => {
    try {
      const storedUser = await SecureStore.getItemAsync('userData');
      if (!storedUser) return;

      const { userId } = JSON.parse(storedUser);
      const response = await axios.get(`${API_URL}/api/client/deliveries/${userId}`);

      const filtered = response.data.filter((order: any) =>
        ['completed', 'cancelled', 'pending', 'accepted', 'in_transit'].includes(order.status)
      );

      setOrders(filtered);

      filtered.forEach((order: any) => {
        if (!fadeAnimMap.has(order.delivery_id.toString())) {
          fadeAnimMap.set(order.delivery_id.toString(), new Animated.Value(0));
        }
      });

      filtered.forEach((order: any) => {
        const anim = fadeAnimMap.get(order.delivery_id.toString());
        if (anim) {
          Animated.timing(anim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }).start();
        }
      });
    } catch (error) {
      console.error('Failed to fetch completed orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCompletedOrders();


  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCompletedOrders();
  };

  function formatDate(dateString: string) {
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
  }

  const renderItem = ({ item }: { item: any }) => {
    const anim = fadeAnimMap.get(item.delivery_id.toString()) || new Animated.Value(1);

    return (
      <Animated.View key={item.delivery_id} style={[styles.card, { opacity: anim }]}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() =>
            router.push({
              pathname: '/orders',
              params: { delivery_id: item.delivery_id.toString() },
            })
          }
        >
          <View style={styles.rowBetween}>
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
                <Menu.Item onPress={() => { }} title="Delete" />
                <Menu.Item onPress={() => { }} title="Repeat" />
                <Menu.Item onPress={() => { }} title="Return route" />
              </Menu>
            </View>
          </View>

          <View style={styles.rowBetween}>
            <Text style={styles.dateText}>
              {`${formatDate(item.created_at)} / ${item.status}`}
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const currentOrders = orders.filter((o) =>
    ['pending', 'accepted', 'in_transit'].includes(o.status)
  );
  const completedOrders = orders.filter((o) =>
    ['completed', 'cancelled'].includes(o.status)
  );

  const getStatusMessage = (status: string) => {
    switch (status) {
      case 'pending':
        return "We're looking for drivers near you";
      case 'accepted':
        return 'A driver has accepted your order';
      case 'in_transit':
        return 'Your order is on the way!';
      default:
        return '';
    }
  };

  return (
    <Provider>
      <View style={styles.container}>
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
              {currentOrders.length > 0 && (
                <>
                  <Text style={styles.subtitle}>Current Orders</Text>
                  {currentOrders.map((item) => {
                    const anim =
                      fadeAnimMap.get(item.delivery_id.toString()) || new Animated.Value(1);
                    return (
                      <View key={item.delivery_id}>
                        {/* Make entire currentHeading clickable */}
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() =>
                            router.push({
                              pathname: '/orders',
                              params: { delivery_id: item.delivery_id.toString() },
                            })
                          }
                        >
                          <View style={styles.currentHeading}>
                            <Text style={styles.currentHeadingText}>
                              {getStatusMessage(item.status)}
                            </Text>
                          </View>
                        </TouchableOpacity>

                        <Animated.View style={[styles.card, { opacity: anim }]}>
                          <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() =>
                              router.push({
                                pathname: '/orders',
                                params: { delivery_id: item.delivery_id.toString() },
                              })
                            }
                          >
                            <View style={{ flex: 1 }}>
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

                              {/* Bottom row with 'In cash' on left and price on right */}
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

              <Text style={styles.subtitle}>Completed Orders</Text>
              {completedOrders.map((item) => renderItem({ item }))}
            </>
          )}
        </ScrollView>
      </View>
    </Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    paddingHorizontal: 16,
    position: 'relative',
    height: '100%',
    width: '100%',
    paddingTop: 60,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 12,
    marginTop: 24,
    fontWeight: 'bold',
    color: '#333',
  },
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
  priceText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  inCashText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  logoImage: {
    width: 40,
    height: 40,
    marginRight: 8,
    borderRadius: 15,

  },
});
