import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AdminAuth from './components/AdminAuth';
import AdminHouseManager from './components/AdminHouseManager';
import ClearDataButton from './components/ClearDataButton';
import ShareAppModal from './components/ShareAppModal';
import { Translations } from './constants/Translations';
import { useNetwork } from './context/NetworkContext';
import { useRental } from './context/RentalContext';

export default function SettingsScreen() {
  const { isAdmin, syncRentalPeriods, isSyncing } = useRental();
  const { isConnected } = useNetwork();

  const [syncStatus, setSyncStatus] = useState<{ complete: boolean; success: boolean }>({ complete: false, success: false });
  const [clearStatus, setClearStatus] = useState<{ complete: boolean; success: boolean }>({ complete: false, success: false });
  const [showShareModal, setShowShareModal] = useState(false);

  const handleSyncComplete = (success: boolean) => {
    setSyncStatus({ complete: true, success });
    setTimeout(() => setSyncStatus({ complete: false, success: false }), 3000);
  };

  const handleClearComplete = (success: boolean) => {
    setClearStatus({ complete: true, success });
    setTimeout(() => setClearStatus({ complete: false, success: false }), 3000);
  };

  const handleSync = async () => {
    if (!isConnected) {
      setSyncStatus({ complete: true, success: false });
      setTimeout(() => setSyncStatus({ complete: false, success: false }), 3000);
      return;
    }
    const success = await syncRentalPeriods();
    handleSyncComplete(success);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <AdminAuth />

        {isAdmin && <AdminHouseManager />}

        {/* Share app — available to everyone */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Partager l'application</Text>
          <TouchableOpacity style={styles.shareButton} onPress={() => setShowShareModal(true)}>
            <Ionicons name="qr-code-outline" size={20} color="white" />
            <Text style={styles.shareButtonText}>Afficher le QR code</Text>
          </TouchableOpacity>
        </View>

        {isAdmin && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{Translations.dataManagement}</Text>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.syncButton, !isConnected && styles.disabledButton]}
                onPress={handleSync}
                disabled={!isConnected || isSyncing}
              >
                {isSyncing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>{Translations.syncData}</Text>
                )}
              </TouchableOpacity>

              <ClearDataButton onClearComplete={handleClearComplete} />
            </View>

            {syncStatus.complete && (
              <Text style={[styles.statusText, syncStatus.success ? styles.successText : styles.errorText]}>
                {syncStatus.success ? Translations.syncSuccess : Translations.syncError}
              </Text>
            )}

            {clearStatus.complete && (
              <Text style={[styles.statusText, clearStatus.success ? styles.successText : styles.errorText]}>
                {clearStatus.success ? Translations.clearSuccess : Translations.clearError}
              </Text>
            )}

            {!isConnected && (
              <Text style={styles.offlineText}>{Translations.offlineNoSync}</Text>
            )}
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {isAdmin ? Translations.adminMode : Translations.viewerMode}
          </Text>
        </View>
      </ScrollView>

      <ShareAppModal visible={showShareModal} onClose={() => setShowShareModal(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 20,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3498db',
    paddingVertical: 12,
    borderRadius: 10,
  },
  shareButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3498db',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flex: 1,
    marginRight: 8,
    justifyContent: 'center',
  },
  disabledButton: {
    backgroundColor: '#95a5a6',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '500',
    fontSize: 14,
    textAlign: 'center',
  },
  statusText: {
    textAlign: 'center',
    marginTop: 8,
    fontSize: 14,
  },
  successText: {
    color: '#27ae60',
  },
  errorText: {
    color: '#e74c3c',
  },
  offlineText: {
    color: '#e74c3c',
    textAlign: 'center',
    marginTop: 8,
    fontSize: 14,
  },
  footer: {
    padding: 16,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#666',
  },
});
