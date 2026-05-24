import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, FlatList, RefreshControl, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import HouseCard from './components/HouseCard';
import { House } from './constants/Houses';
import { Translations } from './constants/Translations';
import { useRental } from './context/RentalContext';

export default function HousesScreen() {
  const { houses, checkForOverlap, refreshHouses, isHousesLoading } = useRental();
  const router = useRouter();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [datePickerMode, setDatePickerMode] = useState<'start' | 'end'>('start');
  const [filteredHouses, setFilteredHouses] = useState<House[]>([]);
  const [isFiltering, setIsFiltering] = useState(false);
  const [showSearchView, setShowSearchView] = useState(false);
  const [selectedHouseId, setSelectedHouseId] = useState<number | null>(null);

  const handleHousePress = (house: House) => {
    router.push({
      pathname: '/house',
      params: { houseId: house.id }
    });
  };

  const openDatePicker = (mode: 'start' | 'end') => {
    setDatePickerMode(mode);
    setShowDatePicker(true);
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      if (datePickerMode === 'start') {
        setStartDate(selectedDate);
      } else {
        setEndDate(selectedDate);
      }
    }
  };

  const searchAvailableHouses = () => {
    // Compare at day level to avoid timestamp issues from the picker
    const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const endDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    if (endDay < startDay) {
      Alert.alert(Translations.error, 'La date de fin doit être après la date de début');
      return;
    }
    let available = houses.filter(house => {
      const hasOverlap = checkForOverlap(
          house.id,
          startDate.toISOString(),
          endDate.toISOString(),
          false,
          false
        );
      return !hasOverlap;
    });

    if (selectedHouseId) {
      available = available.filter(h => h.id === selectedHouseId);
    }

    setFilteredHouses(available);
    setIsFiltering(true);
  };

  const clearFilters = () => {
    setFilteredHouses([]);
    setIsFiltering(false);
    setSelectedHouseId(null);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('fr-FR');
  };

  const toggleSearchView = () => {
    setShowSearchView(!showSearchView);
    if (isFiltering && showSearchView) {
      clearFilters();
    }
  };

  const displayHouses = isFiltering ? filteredHouses : houses;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{Translations.searchForAvailability}</Text>
        <TouchableOpacity 
          style={styles.searchToggleButton} 
          onPress={toggleSearchView}
        >
          <Ionicons 
            name={showSearchView ? "close-outline" : "search-outline"} 
            size={24} 
            color="white" 
          />
        </TouchableOpacity>
      </View>

      {showSearchView && (
        <View style={styles.searchContainer}>
          <Text style={styles.searchTitle}>{Translations.selectDates}</Text>
          
          <View style={styles.dateRow}>
            <Text style={styles.dateLabel}>{Translations.startDate}:</Text>
            <TouchableOpacity 
              style={styles.dateButton} 
              onPress={() => openDatePicker('start')}
            >
              <Text style={styles.dateButtonText}>{formatDate(startDate)}</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.dateRow}>
            <Text style={styles.dateLabel}>{Translations.endDate}:</Text>
            <TouchableOpacity 
              style={styles.dateButton} 
              onPress={() => openDatePicker('end')}
            >
              <Text style={styles.dateButtonText}>{formatDate(endDate)}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.filterLabel}>Maison</Text>
          <View style={styles.houseFilterRow}>
            <TouchableOpacity
              style={[styles.houseFilterPill, selectedHouseId === null && styles.houseFilterPillActive]}
              onPress={() => setSelectedHouseId(null)}
            >
              <Text style={[styles.houseFilterPillText, selectedHouseId === null && styles.houseFilterPillTextActive]}>
                Toutes
              </Text>
            </TouchableOpacity>
            {houses.map(house => (
              <TouchableOpacity
                key={house.id}
                style={[styles.houseFilterPill, selectedHouseId === house.id && styles.houseFilterPillActive]}
                onPress={() => setSelectedHouseId(house.id)}
              >
                <Text style={[styles.houseFilterPillText, selectedHouseId === house.id && styles.houseFilterPillTextActive]}>
                  {house.code}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={styles.searchButton} 
              onPress={searchAvailableHouses}
            >
              <Text style={styles.buttonText}>{Translations.search}</Text>
            </TouchableOpacity>
            
            {isFiltering && (
              <TouchableOpacity 
                style={styles.clearButton} 
                onPress={clearFilters}
              >
                <Text style={styles.buttonText}>{Translations.cancel}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
      
      <FlatList
        data={displayHouses}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <HouseCard house={item} onPress={handleHousePress} />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isHousesLoading}
            onRefresh={refreshHouses}
            colors={['#3498db']}
            tintColor="#3498db"
          />
        }
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.subtitle}>
              {isFiltering 
                ? `${Translations.availableLegend}: ${formatDate(startDate)} - ${formatDate(endDate)}` 
                : Translations.selectHouse}
            </Text>
          </View>
        }
      />
      
      {showDatePicker && (
        <DateTimePicker
          value={datePickerMode === 'start' ? startDate : endDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#3498db',
    padding: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  searchToggleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    backgroundColor: 'white',
    padding: 16,
    margin: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  searchTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dateLabel: {
    fontSize: 16,
    flex: 1,
  },
  dateButton: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 6,
    flex: 2,
  },
  dateButtonText: {
    fontSize: 16,
    textAlign: 'center',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 6,
  },
  houseFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
    gap: 6,
  },
  houseFilterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  houseFilterPillActive: {
    backgroundColor: '#3498db',
    borderColor: '#3498db',
  },
  houseFilterPillText: {
    fontSize: 13,
    color: '#555',
    fontWeight: '500',
  },
  houseFilterPillTextActive: {
    color: 'white',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  searchButton: {
    backgroundColor: '#3498db',
    padding: 12,
    borderRadius: 6,
    flex: 1,
    marginRight: 8,
  },
  clearButton: {
    backgroundColor: '#e74c3c',
    padding: 12,
    borderRadius: 6,
    flex: 1,
    marginLeft: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  listHeader: {
    padding: 12,
    backgroundColor: '#f5f5f5',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  listContent: {
    paddingVertical: 8,
  },
});
