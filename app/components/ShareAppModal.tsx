import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    Alert,
    Clipboard,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

const DOWNLOAD_URL = 'https://github.com/logmoon/Location-Majdi-Ben-Aissa/releases/latest/download/app-release.apk';

interface ShareAppModalProps {
  visible: boolean;
  onClose: () => void;
}

const ShareAppModal: React.FC<ShareAppModalProps> = ({ visible, onClose }) => {
  const handleCopyLink = () => {
    Clipboard.setString(DOWNLOAD_URL);
    Alert.alert('Copié', 'Le lien a été copié dans le presse-papiers.');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Télécharger l'application</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#666" />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Scannez le QR code avec votre téléphone Android pour télécharger l'application.
          </Text>

          {/* QR Code */}
          <View style={styles.qrContainer}>
            <QRCode
              value={DOWNLOAD_URL}
              size={200}
              color="#1a1a1a"
              backgroundColor="white"
            />
          </View>

          {/* Copy link button */}
          <TouchableOpacity style={styles.copyButton} onPress={handleCopyLink}>
            <Ionicons name="copy-outline" size={18} color="white" />
            <Text style={styles.copyButtonText}>Copier le lien</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    flex: 1,
  },
  closeBtn: {
    padding: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  qrContainer: {
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 20,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#3498db',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    width: '100%',
    justifyContent: 'center',
  },
  copyButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
});

export default ShareAppModal;
