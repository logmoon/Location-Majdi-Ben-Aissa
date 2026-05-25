import * as Application from 'expo-application';
import Constants from 'expo-constants';
import React, { ReactNode, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { updateService } from '../services/updateService';

interface ForceUpdateGateProps {
  children: ReactNode;
}

/**
 * Wraps the app and blocks rendering if the installed build is older than
 * the minimum_build_version stored in Supabase.
 *
 * Build number comes from app.json → android.versionCode (set by EAS autoIncrement).
 * Falls open on network failure — never blocks the user if we can't reach Supabase.
 */
const ForceUpdateGate: React.FC<ForceUpdateGateProps> = ({ children }) => {
  const [checking, setChecking] = useState(true);
  const [needsUpdate, setNeedsUpdate] = useState(false);

  // Application.nativeBuildVersion reads the versionCode directly from the
  // Android package manager at runtime — reliable whether running the embedded
  // bundle or an OTA update via expo-updates. Constants.nativeBuildVersion
  // returns null when running an OTA bundle, which caused the gate to always
  // trigger with the '1' fallback.
  // Fallback to null if both are unavailable — checkForUpdate treats a null
  // currentBuild as unknown and fails open (never blocks the user).
  const nativeBuildStr = Application.nativeBuildVersion ?? Constants.nativeBuildVersion ?? null;
  const currentBuild = nativeBuildStr !== null ? parseInt(nativeBuildStr, 10) : null;

  useEffect(() => {
    checkForUpdate();
  }, []);

  const checkForUpdate = async () => {
    try {
      // Race against a 5-second timeout — fail open so a slow connection never blocks the user
      const minimum = await Promise.race([
        updateService.fetchMinimumBuildVersion(),
        new Promise<null>(resolve => setTimeout(() => resolve(null), 5000)),
      ]);
      if (minimum !== null && currentBuild !== null && currentBuild < minimum) {
        setNeedsUpdate(true);
      }
    } finally {
      setChecking(false);
    }
  };

  // Brief loading state while we check — keeps the splash screen feel
  if (checking) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }

  return (
    <>
      {children}
      <Modal
        visible={needsUpdate}
        transparent={false}
        animationType="fade"
        // Prevent dismissal — user must update
        onRequestClose={() => {}}
      >
        <View style={styles.container}>
          <View style={styles.card}>
            <Text style={styles.emoji}>🔄</Text>
            <Text style={styles.title}>Mise à jour requise</Text>
            <Text style={styles.body}>
              Une nouvelle version de l'application est disponible et doit être installée
              pour continuer à l'utiliser.{'\n\n'}
              Appuyez sur le bouton ci-dessous pour télécharger la nouvelle version,
              puis désinstallez l'ancienne et installez la nouvelle.
            </Text>
            <TouchableOpacity
              style={styles.button}
              onPress={updateService.openDownloadLink}
            >
              <Text style={styles.buttonText}>Télécharger la mise à jour</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 28,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  button: {
    backgroundColor: '#3498db',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ForceUpdateGate;
