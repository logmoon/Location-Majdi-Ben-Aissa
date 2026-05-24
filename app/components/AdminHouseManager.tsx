import React, { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { House } from '../constants/Houses';
import { Translations } from '../constants/Translations';
import { useNetwork } from '../context/NetworkContext';
import { useRental } from '../context/RentalContext';
import HouseForm from './HouseForm';

const AdminHouseManager: React.FC = () => {
  const { houses, isAdmin, deleteHouse, refreshHouses, isHousesLoading } = useRental();
  const { isConnected } = useNetwork();
  const [showForm, setShowForm] = useState(false);
  const [editingHouse, setEditingHouse] = useState<House | undefined>(undefined);

  const handleAdd = () => {
    if (!isConnected) {
      Alert.alert('Hors ligne', 'Vous devez être connecté pour ajouter une maison.');
      return;
    }
    setEditingHouse(undefined);
    setShowForm(true);
  };

  const handleEdit = (house: House) => {
    if (!isConnected) {
      Alert.alert('Hors ligne', 'Vous devez être connecté pour modifier une maison.');
      return;
    }
    setEditingHouse(house);
    setShowForm(true);
  };

  const handleDelete = (house: House) => {
    if (!isConnected) {
      Alert.alert('Hors ligne', 'Vous devez être connecté pour supprimer une maison.');
      return;
    }
    Alert.alert(
      'Supprimer la maison',
      `Êtes-vous sûr de vouloir supprimer ${house.name} ?`,
      [
        { text: Translations.cancel, style: 'cancel' },
        {
          text: Translations.delete,
          style: 'destructive',
          onPress: async () => {
            const success = await deleteHouse(house.id);
            if (!success) {
              Alert.alert(Translations.error, 'Impossible de supprimer la maison');
            }
          },
        },
      ]
    );
  };

  const handleFormComplete = () => {
    setShowForm(false);
    setEditingHouse(undefined);
    // addHouse/updateHouse already update local state optimistically — no refetch needed
  };

  if (!isAdmin) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Gestion des maisons</Text>
        <TouchableOpacity
          style={[styles.addButton, !isConnected && styles.disabledButton]}
          onPress={handleAdd}
        >
          <Text style={styles.addButtonText}>+ Ajouter</Text>
        </TouchableOpacity>
      </View>

      {!isConnected && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            Hors ligne — la gestion des maisons est désactivée
          </Text>
        </View>
      )}

      {isHousesLoading ? (
        <ActivityIndicator size="small" color="#3498db" style={styles.loader} />
      ) : (
        <FlatList
          data={houses}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <View style={styles.houseRow}>
              <View style={styles.houseInfo}>
                <Text style={styles.houseName}>{item.name}</Text>
                <Text style={styles.houseCode}>{item.code}</Text>
                {item.price > 0 && (
                  <Text style={styles.housePrice}>{item.price} DT/nuit</Text>
                )}
              </View>
              <View style={styles.houseActions}>
                <TouchableOpacity
                  style={[styles.editButton, !isConnected && styles.disabledButton]}
                  onPress={() => handleEdit(item)}
                >
                  <Text style={styles.actionText}>Modifier</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.deleteButton, !isConnected && styles.disabledButton]}
                  onPress={() => handleDelete(item)}
                >
                  <Text style={styles.actionText}>Suppr.</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          scrollEnabled={false}
        />
      )}

      <Modal
        visible={showForm}
        transparent={true}
        animationType="slide"
        onRequestClose={handleFormComplete}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <HouseForm house={editingHouse} onComplete={handleFormComplete} />
          </View>
        </View>
      </Modal>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  addButton: {
    backgroundColor: '#27ae60',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  disabledButton: {
    backgroundColor: '#95a5a6',
  },
  addButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  offlineBanner: {
    backgroundColor: '#fdecea',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#e74c3c',
  },
  offlineBannerText: {
    color: '#c0392b',
    fontSize: 13,
    fontWeight: '500',
  },
  loader: {
    marginVertical: 16,
  },
  houseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  houseInfo: {
    flex: 1,
  },
  houseName: {
    fontSize: 16,
    fontWeight: '600',
  },
  houseCode: {
    fontSize: 13,
    color: '#666',
  },
  housePrice: {
    fontSize: 13,
    color: '#27ae60',
    fontWeight: '600',
  },
  houseActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    backgroundColor: '#f39c12',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  deleteButton: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '92%',
    maxHeight: '90%',
  },
});

export default AdminHouseManager;
