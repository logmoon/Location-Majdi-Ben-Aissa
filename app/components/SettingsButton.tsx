import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

export default function SettingsButton() {
  const router = useRouter();

  const handlePress = () => {
    router.push('/settings');
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={handlePress} style={styles.button}>
        <Ionicons name="settings" size={22} color="white" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginRight: 12, // Add margin to pull it in from the right edge
  },
  button: {
    padding: 8,
  },
});