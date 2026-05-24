import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Translations } from '../constants/Translations';
import { useRental } from '../context/RentalContext';
import { adminAuthService } from '../services/adminAuthService';
import { pushTokenService } from '../services/pushTokenService';

interface AdminAuthProps {
  onAuthComplete?: () => void;
}

const AdminAuth: React.FC<AdminAuthProps> = ({ onAuthComplete }) => {
  const { isAdmin, setIsAdmin } = useRental();
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!password.trim()) return;

    setIsLoading(true);
    try {
      const result = await adminAuthService.login(password);

      if (result.success) {
        setIsAdmin(true);
        setPassword('');
        // Register this device for push notifications now that it's authenticated
        await pushTokenService.register();
        if (onAuthComplete) onAuthComplete();
      } else {
        setPassword('');
        switch (result.error) {
          case 'invalid_password':
            Alert.alert(Translations.error, Translations.incorrectPassword);
            break;
          case 'network_error':
            Alert.alert(
              Translations.error,
              'Impossible de se connecter. Vérifiez votre connexion internet.'
            );
            break;
          case 'server_error':
          default:
            Alert.alert(
              Translations.error,
              'Erreur serveur. Réessayez dans quelques instants.'
            );
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      // Unregister push token before clearing the session
      await pushTokenService.unregister();
      await adminAuthService.logout();
      setIsAdmin(false);
      setPassword('');
      if (onAuthComplete) onAuthComplete();
    } finally {
      setIsLoading(false);
    }
  };

  if (isAdmin) {
    return (
      <View style={styles.container}>
        <Text style={styles.statusText}>{Translations.adminMode}</Text>
        <TouchableOpacity
          style={[styles.logoutButton, isLoading && styles.disabledButton]}
          onPress={handleLogout}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{Translations.logout}</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{Translations.adminAccess}</Text>
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder={Translations.enterPassword}
        secureTextEntry
        editable={!isLoading}
        onSubmitEditing={handleLogin}
        returnKeyType="done"
      />
      <TouchableOpacity
        style={[styles.button, isLoading && styles.disabledButton]}
        onPress={handleLogin}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{Translations.login}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
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
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#f9f9f9',
  },
  button: {
    backgroundColor: '#3498db',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  logoutButton: {
    backgroundColor: '#e74c3c',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#27ae60',
    marginBottom: 16,
    textAlign: 'center',
  },
});

export default AdminAuth;
