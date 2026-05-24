import { Image } from 'expo-image';
import React from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { House } from '../constants/Houses';
import { Translations } from '../constants/Translations';
import { useRental } from '../context/RentalContext';

interface HouseCardProps {
  house: House;
  onPress: (house: House) => void;
}

const HouseCard: React.FC<HouseCardProps> = ({ house, onPress }) => {
  const { isHouseAvailable } = useRental();

  const today = new Date();
  const timeOfDay = today.getHours() < 12 ? 'AM' : 'PM';
  // Use local-midnight ISO to avoid UTC-offset off-by-one on availability check
  const todayLocalISO = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const isAvailable = isHouseAvailable(house.id, todayLocalISO, timeOfDay);

  const firstImage = house.images && house.images.length > 0 ? house.images[0] : null;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(house)}
      activeOpacity={0.7}
    >
      <View style={styles.card}>
        {firstImage ? (
          <Image source={{ uri: firstImage.url }} style={styles.image} contentFit="cover" />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.imagePlaceholderText}>{house.code}</Text>
          </View>
        )}
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{house.name}</Text>
            {house.price > 0 && (
              <Text style={styles.price}>{house.price} DT</Text>
            )}
          </View>
          <Text style={styles.description} numberOfLines={2}>{house.description}</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: isAvailable ? '#4CAF50' : '#F44336' }]}>
              <Text style={styles.badgeText}>
                {isAvailable ? Translations.available : Translations.rented}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    width: width - 32,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  image: {
    width: 120,
    height: 120,
  },
  imagePlaceholder: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#3498db',
  },
  imagePlaceholderText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
  },
  content: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#27ae60',
    marginLeft: 8,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default HouseCard;
