import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Translations } from '../constants/Translations';
import { useNetwork } from '../context/NetworkContext';

const OfflineIndicator: React.FC = () => {
  const { isConnected, lastConnectedAt, checkConnection, isCheckingConnection } = useNetwork();

  if (isConnected) {
    return null;
  }

  // Format the last connected time
  const formatLastConnected = () => {
    if (!lastConnectedAt) return '';
    
    return lastConnectedAt.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleRetryConnection = async () => {
    await checkConnection();
  };

  return (
    <View style={styles.container}>
      <View style={styles.contentRow}>
        <Text style={styles.text}>
          {Translations.offlineWarning}
        </Text>
        <TouchableOpacity 
          style={styles.retryButton} 
          onPress={handleRetryConnection}
          disabled={isCheckingConnection}
        >
          {isCheckingConnection ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="refresh" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
      {lastConnectedAt && (
        <Text style={styles.subText}>
          {Translations.lastConnected}: {formatLastConnected()}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#e74c3c',
    paddingTop: 40,
    padding: 10,
    width: '100%',
  },
  contentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  text: {
    color: 'white',
    flex: 1,
    fontWeight: 'bold',
  },
  subText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 12,
    marginTop: 2,
  },
  retryButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 20,
    padding: 8,
    marginLeft: 8,
  },
});

export default OfflineIndicator;