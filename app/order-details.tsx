import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
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
import { useDeliveryStore } from '../store/useDeliveryStore';

const OrderDetailsScreen = () => {

  const { deliveryData, setDeliveryField } = useDeliveryStore();

  const [receiverName, setReceiverName] = useState(deliveryData.receiver_name || '');
  const [receiverPhone, setReceiverPhone] = useState(deliveryData.receiver_contact || '');

  const [compToggle, setCompToggle] = useState(deliveryData.additional_compensation > 0);
  const [selectedComp, setSelectedComp] = useState(deliveryData.additional_compensation || 10);

  const [codToggle, setCodToggle] = useState(deliveryData.parcel_amount > 0);
  const [parcelAmount, setParcelAmount] = useState(deliveryData.parcel_amount?.toString() || '');

  const [tipToggle, setTipToggle] = useState(deliveryData.tip > 0);
  const [selectedTip, setSelectedTip] = useState(deliveryData.tip || 10);

  const [additionalInfo, setAdditionalInfo] = useState(deliveryData.add_info || '');


  const router = useRouter();


  const handleDone = () => {
  setDeliveryField('receiver_name', receiverName);
  setDeliveryField('receiver_contact', receiverPhone);

  // Handle parcel amount with fallback for NaN or invalid input
  if (codToggle && parcelAmount !== '') {
    const parsedAmount = parseFloat(parcelAmount);
    setDeliveryField('parcel_amount', isNaN(parsedAmount) ? 0 : parsedAmount);
    setDeliveryField('payer', 'sender'); // Adjust this as needed
  } else {
    setDeliveryField('parcel_amount', 0);
    setDeliveryField('payer', null);
  }

  // Additional compensation with NaN fallback
  setDeliveryField('additional_compensation', compToggle && !isNaN(selectedComp) ? selectedComp : 0);

  // Tip with NaN fallback
  setDeliveryField('tip', tipToggle && !isNaN(selectedTip) ? selectedTip : 0);

  setDeliveryField('add_info', additionalInfo);

  // ✅ Navigate to Home screen
  router.push('/home');
};



  return (

    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
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
              <Text style={styles.label}>Receiver Name</Text>
              <TextInput
                style={styles.inputField}
                placeholder="Enter receiver name"
                value={receiverName}
                onChangeText={setReceiverName}
              />
              <Text style={[styles.label, { marginTop: 12 }]}>Contact Number</Text>
              <TextInput
                style={styles.inputField}
                placeholder="Enter contact number"
                keyboardType="phone-pad"
                value={receiverPhone}
                onChangeText={setReceiverPhone}
              />
            </View>

            {/* Cash on Delivery */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Cash on Delivery</Text>
                <Switch value={codToggle} onValueChange={setCodToggle} trackColor={{ false: '#ccc', true: '#FF6600' }}
                  thumbColor={Platform.OS === 'android' ? '#fff' : undefined}

                />
              </View>
              {codToggle && (
                <View style={{ marginTop: 10 }}>
                  <Text style={styles.label}>Parcel Amount (₱)</Text>
                  <TextInput
                    style={styles.inputField}
                    placeholder="Enter parcel amount"
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
            <View style={styles.additionalInfo}>
              <MaterialIcons name="notes" size={22} color="#888" />
              <TextInput
                style={styles.textInput}
                placeholder="Additional information"
                value={additionalInfo}
                onChangeText={setAdditionalInfo}
              />
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* Bottom Bar */}
      {/* Done Button */}
      <View style={styles.fixedBottomBar}>
        <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
          <Text style={styles.doneText}>DONE</Text>
        </TouchableOpacity>
      </View>

    </View>

  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  header: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F4F4F4',
    paddingHorizontal: 16,
    paddingTop: 60,

  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#222',
  },
  container: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  sectionSub: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
    marginBottom: 12,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  amountOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#F1F1F1',
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  selectedOption: {
    backgroundColor: '#FF6600',
  },
  amountText: {
    color: '#333',
    fontWeight: '500',
  },
  selectedText: {
    color: '#fff',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  inputField: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginTop: 6,
  },
  additionalInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 10,
    marginBottom: 100

  },
  textInput: {
    marginLeft: 10,
    flex: 1,
    fontSize: 14,
  },
  bottomBar: {
    paddingHorizontal: 16,
    marginBottom: 70,
  },
  fixedBottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 40,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: '#eee',
    zIndex: 10,
  },

  priceText: {
    fontWeight: '700',
    fontSize: 16,
  },
  doneButton: {
    backgroundColor: '#FF6600', // Updated from yellow to orange
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  doneText: {
    color: '#fff', // Make text white for better contrast
    fontWeight: '600',
    fontSize: 16,
  },


});

export default OrderDetailsScreen;
