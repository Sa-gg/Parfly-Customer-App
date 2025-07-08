import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import OrderButton from './OrderButton';

const screenWidth = Dimensions.get('window').width;

interface Service {
  key: string;
  label: string;
  price: string;
  basePrice: number;
  icon: any; // Image source
}

interface ServiceSelectorProps {
  selectedService: string;
  onServiceSelect: (serviceKey: string) => void;
  filledFieldCount: number;
  hasPickupAddress: boolean;
  hasDropoffAddress: boolean;
  loadingPrice: boolean;
  loading: boolean;
  formattedPrice: string;
  fallbackPrice: string;
  onOrderPress: () => void;
}

const services: Service[] = [
  {
    key: 'motorcycles',
    label: 'Motorcycles',
    price: 'from ₱10',
    basePrice: 10,
    icon: require('../../assets/images/motorcycle.png')
  },
  {
    key: 'cars',
    label: 'Passenger cars',
    price: 'from ₱40',
    basePrice: 10,
    icon: require('../../assets/images/car.png')
  },
  {
    key: 'trucks',
    label: 'Trucks',
    price: 'from ₱10',
    basePrice: 10,
    icon: require('../../assets/images/truck.png')
  },
];

const styles = StyleSheet.create({
  serviceSelector: {
    position: 'absolute',
    bottom: 0,
    width: screenWidth,
    padding: 12,
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  serviceHeader: {
    marginBottom: 16,
  },
  serviceHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 5,
  },
  detailsCount: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 'bold',
    position: 'absolute',
    right: 20,
    backgroundColor: '#FF6600',
    color: 'white',
  },
  serviceDetail: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F2F2F2',
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 20,
  },
  serviceText: {
    fontSize: 12,
    color: '#333',
  },
  serviceTypes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    flex: 1,
    height: 100,
  },
  serviceTypeBox: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    marginHorizontal: 4,
    backgroundColor: '#F2F2F2',
  },
  serviceTypeSelected: {
    borderWidth: 2,
    borderColor: '#FF6600',
    transform: [{ scale: 1.05 }],
  },
  serviceLabel: {
    fontSize: 12,
    color: '#333',
    marginTop: 6,
  },
  servicePrice: {
    fontSize: 11,
    color: '#777',
  },
  iconImage: {
    width: 70,
    height: 40,
  },
});

export default function ServiceSelector({
  selectedService,
  onServiceSelect,
  filledFieldCount,
  hasPickupAddress,
  hasDropoffAddress,
  loadingPrice,
  loading,
  formattedPrice,
  fallbackPrice,
  onOrderPress,
}: ServiceSelectorProps) {
  const router = useRouter();

  const handleServicePress = (serviceKey: string) => {
    if (serviceKey === 'cars' || serviceKey === 'trucks') {
      alert('Not available for now');
      return;
    }
    onServiceSelect(serviceKey);
  };

  return (
    <View style={styles.serviceSelector}>
      <View style={styles.serviceHeader}>
        <TouchableOpacity style={styles.serviceDetail} onPress={() => router.push('/order-details')}>
          <Ionicons name="options-outline" size={16} color="#333" />
          <Text style={styles.serviceText}>Details</Text>
          <Text style={filledFieldCount > 0 ? styles.detailsCount : undefined}>
            {filledFieldCount > 0 ? filledFieldCount : ""}
          </Text>
        </TouchableOpacity>
        <View style={styles.serviceHeaderContainer}>
          <TouchableOpacity style={styles.serviceDetail}>
            <Ionicons name="cash-outline" size={16} color="#333" />
            <Text style={styles.serviceText}>In cash</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.serviceDetail}>
            <Ionicons name="time-outline" size={16} color="#333" />
            <Text style={styles.serviceText}>Now</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Services */}
      <View style={styles.serviceTypes}>
        {services.map(service => {
          const isSelected = selectedService === service.key;

          return (
            <TouchableOpacity
              key={service.key}
              style={[styles.serviceTypeBox, isSelected && styles.serviceTypeSelected]}
              onPress={() => handleServicePress(service.key)}
            >
              <Image source={service.icon} style={styles.iconImage} />
              <Text style={[styles.serviceLabel, { color: isSelected ? 'black' : '#333' }]}>
                {service.label}
              </Text>
              <Text style={[styles.servicePrice, { color: isSelected ? 'black' : '#777' }]}>
                {service.price}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Order Button */}
      <OrderButton
        hasPickupAddress={hasPickupAddress}
        hasDropoffAddress={hasDropoffAddress}
        loadingPrice={loadingPrice}
        loading={loading}
        formattedPrice={formattedPrice}
        fallbackPrice={fallbackPrice}
        onPress={onOrderPress}
      />
    </View>
  );
}

// Export services for use in other components
export { services };

