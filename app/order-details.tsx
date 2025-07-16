import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import OrderButton from '../components/delivery/OrderButton';
import { useDeliveryStore } from '../store/useDeliveryStore';
import { useLocationStore } from '../store/useLocationStore';

const OrderDetailsScreen = () => {
  const insets = useSafeAreaInsets();

  const { deliveryData, setDeliveryField } = useDeliveryStore();
  const pickup = useLocationStore(state => state.pickup);
  const dropoff = useLocationStore(state => state.dropoff);

  const [receiverName, setReceiverName] = useState(deliveryData.receiver_name || '');
  const [receiverPhone, setReceiverPhone] = useState(deliveryData.receiver_contact || '');

  const [compToggle, setCompToggle] = useState(deliveryData.additional_compensation > 0);
  const [selectedComp, setSelectedComp] = useState(deliveryData.additional_compensation || 10);

  const [codToggle, setCodToggle] = useState(deliveryData.parcel_amount > 0);
  const [parcelAmount, setParcelAmount] = useState(deliveryData.parcel_amount?.toString() || '');

  const [tipToggle, setTipToggle] = useState(deliveryData.tip > 0);
  const [selectedTip, setSelectedTip] = useState(deliveryData.tip || 10);
  const [priceLoading, setPriceLoading] = useState(false);

  const [additionalInfo, setAdditionalInfo] = useState(deliveryData.add_info || '');

  const router = useRouter();

  // Debounced price calculation to improve UI responsiveness
  const [debouncedTip, setDebouncedTip] = useState(selectedTip);
  const [debouncedComp, setDebouncedComp] = useState(selectedComp);

  // Calculate real-time pricing
  const hasPickupAddress = !!pickup?.address;
  const hasDropoffAddress = !!dropoff?.address;
  
  // Get current tip and compensation values
  const currentTip = tipToggle ? debouncedTip : 0;
  const currentComp = compToggle ? debouncedComp : 0;
  
  // Base delivery fee from the store (calculated in home screen)
  // Remove tip and compensation from the base fee to avoid double counting
  const originalDeliveryFee = deliveryData.delivery_fee || 0;
  const originalTip = deliveryData.tip || 0;
  const originalComp = deliveryData.additional_compensation || 0;
  const baseFeeWithoutExtras = originalDeliveryFee - originalTip - originalComp;
  
  // Calculate new total price
  const totalPrice = baseFeeWithoutExtras + currentTip + currentComp;
  const formattedPrice = `₱${totalPrice.toFixed(2)}`;

  // Update store in real-time when values change
  useEffect(() => {
    setDeliveryField('receiver_name', receiverName);
  }, [receiverName, setDeliveryField]);

  useEffect(() => {
    setDeliveryField('receiver_contact', receiverPhone);
  }, [receiverPhone, setDeliveryField]);

  useEffect(() => {
    if (codToggle && parcelAmount !== '') {
      const parsedAmount = parseFloat(parcelAmount);
      setDeliveryField('parcel_amount', isNaN(parsedAmount) ? 0 : parsedAmount);
      setDeliveryField('payer', 'sender');
    } else {
      setDeliveryField('parcel_amount', 0);
      setDeliveryField('payer', null);
    }
  }, [codToggle, parcelAmount, setDeliveryField]);

  // Debounced updates for tip and compensation
  useEffect(() => {
    setPriceLoading(true);
    const timer = setTimeout(() => {
      setDebouncedTip(selectedTip);
      setPriceLoading(false);
    }, 150); // 150ms delay for smooth UI

    return () => clearTimeout(timer);
  }, [selectedTip]);

  useEffect(() => {
    setPriceLoading(true);
    const timer = setTimeout(() => {
      setDebouncedComp(selectedComp);
      setPriceLoading(false);
    }, 150); // 150ms delay for smooth UI

    return () => clearTimeout(timer);
  }, [selectedComp]);

  useEffect(() => {
    setDeliveryField('additional_compensation', currentComp);
  }, [currentComp, setDeliveryField]);

  useEffect(() => {
    setDeliveryField('tip', currentTip);
  }, [currentTip, setDeliveryField]);

  useEffect(() => {
    setDeliveryField('add_info', additionalInfo);
  }, [additionalInfo, setDeliveryField]);

  const handleDone = () => {
    // Update the final delivery fee when user is done
    setDeliveryField('delivery_fee', totalPrice);
    // All other data is already updated in real-time via useEffect hooks
    // Just navigate back to home
    router.push('/home');
  };



  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <View style={styles.screen}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order details</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0} // adjust this based on your header height
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>

          <ScrollView contentContainerStyle={styles.container}>
            {/* Receiver Details */}
            <View style={styles.section}>
              {/* Receiver Name */}
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color="#888" />
                <TextInput
                  style={styles.textInput}
                  placeholder="Receiver name"
                  value={receiverName}
                  onChangeText={setReceiverName}
                />
              </View>
              
              {/* Contact Number */}
              <View style={[styles.inputContainer, { marginTop: 8 }]}>
                <Ionicons name="call-outline" size={20} color="#888" />
                <TextInput
                  style={styles.textInput}
                  placeholder="Contact number"
                  keyboardType="phone-pad"
                  value={receiverPhone}
                  onChangeText={setReceiverPhone}
                />
              </View>
            </View>

            {/* Cash on Delivery */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Cash on Delivery</Text>
                <Switch value={codToggle} onValueChange={setCodToggle} trackColor={{ false: '#ccc', true: '#FF6600' }}
                  thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
                />
              </View>
              <Text style={styles.sectionSub}>
                Collect payment from receiver upon delivery.
              </Text>
              {codToggle && (
                <View style={[styles.inputContainer, { marginTop: 8 }]}>
                  <Ionicons name="cash-outline" size={20} color="#888" />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Parcel amount (₱)"
                    keyboardType="numeric"
                    value={parcelAmount}
                    onChangeText={setParcelAmount}
                  />
                </View>
              )}
            </View>

            {/* Additional Compensation */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Additional compensation</Text>
                <Switch value={compToggle} onValueChange={setCompToggle} trackColor={{ false: '#ccc', true: '#FF6600' }}
                  thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
                />
              </View>
              <Text style={styles.sectionSub}>
                Additional compensation shows that your order is urgent and makes it more attractive to performers.
              </Text>
              {compToggle && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {[10, 20, 30, 40, 50, 60].map((amount) => (
                      <TouchableOpacity
                        key={amount}
                        style={[
                          styles.amountOption,
                          selectedComp === amount && styles.selectedOption,
                        ]}
                        onPress={() => setSelectedComp(amount)}
                      >
                        <Text
                          style={[
                            styles.amountText,
                            selectedComp === amount && styles.selectedText,
                          ]}
                        >
                          ₱{amount}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

              )}
            </View>


            {/* Tip */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Tip</Text>
                <Switch value={tipToggle} onValueChange={setTipToggle} trackColor={{ false: '#ccc', true: '#FF6600' }}
                  thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
                />
              </View>
              <Text style={styles.sectionSub}>
                Order total will increase by the tip amount.
              </Text>
              {tipToggle && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {[10, 20, 30, 40, 50, 60].map((amount) => (
                      <TouchableOpacity
                        key={amount}
                        style={[
                          styles.amountOption,
                          selectedTip === amount && styles.selectedOption,
                        ]}
                        onPress={() => setSelectedTip(amount)}
                      >
                        <Text
                          style={[
                            styles.amountText,
                            selectedTip === amount && styles.selectedText,
                          ]}
                        >
                          ₱{amount}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

              )}
            </View>



            {/* Additional Info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Additional Information</Text>
              <View style={[styles.inputContainer, { marginTop: 8 }]}>
                <MaterialIcons name="notes" size={20} color="#888" />
                <TextInput
                  style={styles.textInput}
                  placeholder="Any special instructions or notes"
                  value={additionalInfo}
                  onChangeText={setAdditionalInfo}
                  multiline
                />
              </View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* Bottom Bar */}
      <View style={[styles.fixedBottomBar, { bottom: Math.max(insets.bottom, 16) }]}>
        <OrderButton
          hasPickupAddress={hasPickupAddress}
          hasDropoffAddress={hasDropoffAddress}
          loadingPrice={priceLoading}
          loading={false}
          formattedPrice={formattedPrice}
          fallbackPrice="₱0.00"
          onPress={handleDone}
          buttonText="DONE"
        />
      </View>

    </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  screen: { flex: 1, backgroundColor: '#fff' },
  header: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#222',
  },
  container: {
    padding: 16,
    paddingBottom: 120, // Add more space for the fixed bottom button
  },
  section: {
    marginBottom: 20, // Reduced from 24 for tighter spacing
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4, // Add small margin below header
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  sectionSub: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    marginBottom: 8, // Reduced margin
    lineHeight: 16,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  amountOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F8F8F8',
    borderRadius: 25,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  selectedOption: {
    backgroundColor: '#FF6600',
    borderColor: '#FF6600',
  },
  amountText: {
    color: '#333',
    fontWeight: '600',
    fontSize: 14,
  },
  selectedText: {
    color: '#fff',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 10,
  },
  textInput: {
    marginLeft: 8,
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  bottomBar: {
    paddingHorizontal: 16,
    marginBottom: 70,
  },
  fixedBottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: '#eee',
    zIndex: 10,
  },


});

export default OrderDetailsScreen;
