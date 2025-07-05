import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import logo from '../assets/images/logo.png';

interface SharedHeaderProps {
  isOrdersTab?: boolean;
}

export default function SharedHeader({ isOrdersTab = false }: SharedHeaderProps) {
  return (
    <View style={[styles.headerContainer, isOrdersTab && styles.ordersBorder]}>
      <Image source={logo} style={styles.logoImage} />
      <Text style={styles.logoText}>PARFLY</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 0,
    paddingBottom: 20,
    paddingHorizontal: 0,
  },
  ordersBorder: {
    borderBottomWidth: 2,
    borderBottomColor: '#CCCCCC',
    // Negative margins to counteract parent's paddingHorizontal (usually 16)
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  logoImage: {
    width: 40,
    height: 40,
    marginRight: 8,
    borderRadius: 15,
  },
  logoText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF6600',
  },
});
