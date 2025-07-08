import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface OrderButtonProps {
  hasPickupAddress: boolean;
  hasDropoffAddress: boolean;
  loadingPrice: boolean;
  loading: boolean;
  formattedPrice: string;
  fallbackPrice: string;
  onPress: () => void;
  buttonText?: string;
}

export default function OrderButton({
  hasPickupAddress,
  hasDropoffAddress,
  loadingPrice,
  loading,
  formattedPrice,
  fallbackPrice,
  onPress,
  buttonText = "ORDER",
}: OrderButtonProps) {
  const isDisabled = !hasPickupAddress || !hasDropoffAddress || loadingPrice || loading;
  
  const displayPrice = hasPickupAddress && hasDropoffAddress ? formattedPrice : fallbackPrice;

  return (
    <TouchableOpacity
      style={[styles.orderButton, isDisabled && styles.orderButtonDisabled]}
      disabled={isDisabled}
      onPress={onPress}
    >
      <View style={styles.priceContainer}>
        {loadingPrice ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.orderPrice}>{displayPrice}</Text>
        )}
      </View>
      <View style={styles.separatorLine} />
      <Text style={styles.orderText}>{buttonText}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  orderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6600',
    paddingVertical: 15,
    borderRadius: 30,
    paddingHorizontal: 20,
  },
  orderButtonDisabled: {
    opacity: 0.6,
  },
  priceContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 24, // Ensure consistent height
  },
  orderPrice: {
    fontSize: 20,
    fontWeight: '600',
    color: 'white',
  },
  orderText: {
    fontSize: 19,
    fontWeight: 'bold',
    color: 'white',
    flex: 1,
    textAlign: 'center',
  },
  separatorLine: {
    width: 1.5,
    backgroundColor: '#F2F2F2',
    marginHorizontal: 12,
    alignSelf: 'stretch',
    borderRadius: 1,
  },
});
