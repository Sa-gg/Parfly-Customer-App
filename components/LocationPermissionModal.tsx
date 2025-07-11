import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { width } = Dimensions.get('window');

interface LocationPermissionModalProps {
  visible: boolean;
  onAllow: () => void;
  onSkip: () => void;
  onDismiss?: () => void;
  loading?: boolean;
}

/**
 * Modal that prompts users to enable location services
 * Shows only once and stores the user's preference
 */
export default function LocationPermissionModal({
  visible,
  onAllow,
  onSkip,
  onDismiss,
  loading = false,
}: LocationPermissionModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
    >
      {/* Backdrop - Touchable to dismiss */}
      <TouchableOpacity 
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onDismiss}
      >
        {/* Modal Content - Prevent dismiss when touching modal */}
        <TouchableOpacity 
          style={styles.modal}
          activeOpacity={1}
          onPress={() => {}} // Prevent event bubbling
        >
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Ionicons name="location" size={40} color="#FF6600" />
          </View>

          {/* Title */}
          <Text style={styles.title}>Enable Location Services</Text>

          {/* Description - More concise */}
          <Text style={styles.description}>
            We need location access to provide accurate delivery estimates and show nearby pickup points.
          </Text>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.allowButton]}
              onPress={onAllow}
              disabled={loading}
            >
              <Text style={styles.allowButtonText}>
                {loading ? 'Getting Location...' : 'Allow Location'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.skipButton]}
              onPress={onSkip}
              disabled={loading}
            >
              <Text style={styles.skipButtonText}>Skip for Now</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    width: width - 60,
    maxWidth: 340,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  iconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
  },
  description: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  benefitsList: {
    width: '100%',
    marginBottom: 20,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  benefitText: {
    fontSize: 15,
    color: '#333',
    marginLeft: 12,
    flex: 1,
  },
  privacyNote: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 24,
    lineHeight: 18,
  },
  buttonContainer: {
    width: '100%',
  },
  button: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  allowButton: {
    backgroundColor: '#FF6600',
  },
  allowButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#DDD',
  },
  skipButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
});
