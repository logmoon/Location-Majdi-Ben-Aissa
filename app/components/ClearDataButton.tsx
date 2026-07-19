import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRental } from '../context/RentalContext';
import { Translations } from '../constants/Translations';

interface ClearDataButtonProps {
  onClearComplete?: (success: boolean) => void;
  pendingOperationsCount?: number;
}

const ClearDataButton: React.FC<ClearDataButtonProps> = ({ onClearComplete, pendingOperationsCount = 0 }) => {
  const { clearLocalData } = useRental();
  const [isClearing, setIsClearing] = useState(false);

  const handleClearData = async () => {
    const hasPendingChanges = pendingOperationsCount > 0;

    // When there are unsynced local changes, clearing data destroys them
    // permanently — use an explicit, count-specific warning instead of the
    // generic confirmation so this can't be mistaken for a harmless reset.
    Alert.alert(
      Translations.clearData,
      hasPendingChanges
        ? Translations.clearDataConfirmWithPending(pendingOperationsCount)
        : Translations.clearDataConfirm,
      [
        {
          text: Translations.cancel,
          style: 'cancel'
        },
        {
          text: hasPendingChanges ? 'Supprimer quand même' : Translations.confirm,
          style: 'destructive',
          onPress: async () => {
            setIsClearing(true);
            try {
              const success = await clearLocalData();
              if (onClearComplete) {
                onClearComplete(success);
              }
            } catch (error) {
              console.error('Error clearing local data:', error);
              if (onClearComplete) {
                onClearComplete(false);
              }
            } finally {
              setIsClearing(false);
            }
          }
        }
      ]
    );
  };

  return (
    <TouchableOpacity 
      style={styles.clearButton} 
      onPress={handleClearData}
      disabled={isClearing}
    >
      {isClearing ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <Ionicons name="trash-outline" size={20} color="#fff" />
      )}
      <Text style={styles.clearText}>{Translations.clearData}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e74c3c',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  clearText: {
    color: '#fff',
    marginLeft: 4,
    fontWeight: '500',
    fontSize: 14,
  },
});

export default ClearDataButton;