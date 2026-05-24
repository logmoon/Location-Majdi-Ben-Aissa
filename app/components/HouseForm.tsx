import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { House, HouseImage } from '../constants/Houses';
import { Translations } from '../constants/Translations';
import { useRental } from '../context/RentalContext';

interface HouseFormProps {
  house?: House;
  onComplete: () => void;
}

const HouseForm: React.FC<HouseFormProps> = ({ house: initialHouse, onComplete }) => {
  const { addHouse, updateHouse, addHouseImage, deleteHouseImage } = useRental();

  // After a new house is saved we promote to edit mode in-place
  const [currentHouse, setCurrentHouse] = useState<House | undefined>(initialHouse);
  const [images, setImages] = useState<HouseImage[]>(initialHouse?.images || []);

  const [name, setName] = useState(initialHouse?.name || '');
  const [description, setDescription] = useState(initialHouse?.description || '');
  const [code, setCode] = useState(initialHouse?.code || '');
  const [price, setPrice] = useState(initialHouse?.price?.toString() || '');
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const isEditMode = !!currentHouse;

  const handlePickImage = async () => {
    if (!currentHouse) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission refusée', "Besoin de l'accès à la galerie pour ajouter des images");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      await uploadImage(currentHouse.id, result.assets[0].uri);
    }
  };

  const handleTakePhoto = async () => {
    if (!currentHouse) return;
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission refusée', "Besoin de l'accès à la caméra");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      await uploadImage(currentHouse.id, result.assets[0].uri);
    }
  };

  const uploadImage = async (houseId: number, uri: string) => {
    setUploadingImage(true);
    const url = await addHouseImage(houseId, uri);
    setUploadingImage(false);
    if (url) {
      // Add to local image state immediately — no need to close/reopen
      const newImage: HouseImage = {
        id: `temp_${Date.now()}`,
        houseId,
        url,
        sortOrder: images.length,
      };
      setImages(prev => [...prev, newImage]);
    } else {
      Alert.alert('Erreur', "Impossible d'ajouter l'image");
    }
  };

  const handleDeleteImage = (imageId: string) => {
    Alert.alert('Confirmer', 'Supprimer cette image ?', [
      { text: Translations.cancel, style: 'cancel' },
      {
        text: Translations.delete,
        style: 'destructive',
        onPress: async () => {
          const success = await deleteHouseImage(imageId);
          if (success) {
            // Remove from local state immediately
            setImages(prev => prev.filter(img => img.id !== imageId));
          } else {
            Alert.alert('Erreur', "Impossible de supprimer l'image");
          }
        },
      },
    ]);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert(Translations.error, 'Le nom est requis');
      return;
    }
    setSaving(true);
    const houseData = {
      name: name.trim(),
      description: description.trim(),
      code: code.trim(),
      price: parseFloat(price) || 0,
    };

    if (currentHouse) {
      const success = await updateHouse({ ...currentHouse, ...houseData });
      if (!success) Alert.alert(Translations.error, 'Impossible de modifier la maison');
    } else {
      const id = await addHouse(houseData);
      if (id) {
        // Transition to edit mode in-place so images can be added immediately
        const newHouse: House = { ...houseData, id, images: [] };
        setCurrentHouse(newHouse);
        setImages([]);
      } else {
        Alert.alert(Translations.error, "Impossible d'ajouter la maison");
      }
    }
    setSaving(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>
        {isEditMode ? 'Modifier la maison' : 'Ajouter une maison'}
      </Text>

      {/* Show a success hint after create → edit transition */}
      {isEditMode && !initialHouse && (
        <View style={styles.successBanner}>
          <Ionicons name="checkmark-circle" size={16} color="#27ae60" />
          <Text style={styles.successBannerText}>
            Maison créée. Ajoutez des images ci-dessous.
          </Text>
        </View>
      )}

      <Text style={styles.label}>Nom</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Nom de la maison"
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={description}
        onChangeText={setDescription}
        placeholder="Description"
        multiline
        numberOfLines={3}
      />

      <Text style={styles.label}>Code</Text>
      <TextInput
        style={styles.input}
        value={code}
        onChangeText={setCode}
        placeholder="Ex: 1-1"
      />

      <Text style={styles.label}>Prix (DT/nuit)</Text>
      <TextInput
        style={styles.input}
        value={price}
        onChangeText={setPrice}
        placeholder="0"
        keyboardType="numeric"
      />

      {/* Image section — only available once a house exists */}
      {isEditMode && (
        <>
          <Text style={styles.label}>Images</Text>

          {images.length > 0 ? (
            <ScrollView
              horizontal
              style={styles.imageGallery}
              showsHorizontalScrollIndicator={false}
            >
              {images.map(img => (
                <View key={img.id} style={styles.imageContainer}>
                  <Image source={{ uri: img.url }} style={styles.image} />
                  <TouchableOpacity
                    style={styles.deleteImageBtn}
                    onPress={() => handleDeleteImage(img.id)}
                  >
                    <Ionicons name="close" size={14} color="white" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.noImages}>Aucune image</Text>
          )}

          <View style={styles.imageButtons}>
            <TouchableOpacity
              style={[styles.imageButton, uploadingImage && styles.imageButtonDisabled]}
              onPress={handlePickImage}
              disabled={uploadingImage}
            >
              {uploadingImage ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="images-outline" size={16} color="white" />
              )}
              <Text style={styles.imageButtonText}>Galerie</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.imageButton, uploadingImage && styles.imageButtonDisabled]}
              onPress={handleTakePhoto}
              disabled={uploadingImage}
            >
              {uploadingImage ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="camera-outline" size={16} color="white" />
              )}
              <Text style={styles.imageButtonText}>Appareil photo</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onComplete}
          disabled={saving}
        >
          <Text style={styles.buttonText}>
            {isEditMode && !initialHouse ? 'Fermer' : Translations.cancel}
          </Text>
        </TouchableOpacity>

        {/* Only show save when not in post-create image mode */}
        {!(isEditMode && !initialHouse) && (
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSubmit}
            disabled={saving}
          >
            <Text style={styles.buttonText}>
              {saving ? 'Enregistrement...' : Translations.save}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    flexShrink: 1,
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#eafaf1',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#27ae60',
  },
  successBannerText: {
    color: '#1e8449',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 12,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  imageGallery: {
    marginVertical: 8,
  },
  imageContainer: {
    position: 'relative',
    marginRight: 8,
  },
  image: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  deleteImageBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(231, 76, 60, 0.9)',
    borderRadius: 12,
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImages: {
    color: '#999',
    fontStyle: 'italic',
    marginVertical: 8,
  },
  imageButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  imageButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  imageButtonDisabled: {
    backgroundColor: '#95a5a6',
  },
  imageButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 8,
  },
  cancelButton: {
    backgroundColor: '#95a5a6',
    borderRadius: 8,
    padding: 16,
    flex: 1,
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#27ae60',
    borderRadius: 8,
    padding: 16,
    flex: 1,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default HouseForm;
