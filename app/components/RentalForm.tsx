import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Translations } from '../constants/Translations';
import { RentalPeriod, useRental } from '../context/RentalContext';

interface RentalFormProps {
  houseId: number;
  onComplete: () => void;
  initialDate?: string; // ISO date string for pre-filling the form
  initialRental?: RentalPeriod; // For editing existing rental
  initialTimeOfDay?: 'AM' | 'PM'; // For pre-selecting half-day option
}

const RentalForm: React.FC<RentalFormProps> = ({ 
  houseId, 
  onComplete, 
  initialDate,
  initialRental,
  initialTimeOfDay
}) => {
  const { addRentalPeriod, updateRentalPeriod, isAdmin } = useRental();
  
  // State for form fields
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [renterName, setRenterName] = useState('');
  const [notes, setNotes] = useState('');
  const [startHalfDay, setStartHalfDay] = useState(false); // false = full-day check-in (most common)
  const [endHalfDay, setEndHalfDay] = useState(false);   // false = full-day check-out (most common)
  
  // State for date picker
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  
  // Initialize form with initial values if provided
  useEffect(() => {
    if (initialRental) {
      // Editing mode - populate form with existing rental data
      setStartDate(new Date(initialRental.startDate));
      setEndDate(new Date(initialRental.endDate));
      setRenterName(initialRental.renterName || '');
      setNotes(initialRental.notes || '');
      setStartHalfDay(initialRental.startHalfDay || false);
      setEndHalfDay(initialRental.endHalfDay || false);
    } else if (initialDate) {
      // New rental with initial date
      const date = new Date(initialDate);
      setStartDate(date);
      
      // Set end date to same day initially
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      setEndDate(nextDay);
      
      // If initialTimeOfDay is provided, set the appropriate half-day option
      if (initialTimeOfDay) {
        if (initialTimeOfDay === 'AM') {
          setStartHalfDay(false); // Morning start (full day)
          setEndHalfDay(true);    // Noon checkout
        } else if (initialTimeOfDay === 'PM') {
          setStartHalfDay(true);  // Noon check-in
          setEndHalfDay(false);   // Evening checkout (full day)
        }
      }
    } else {
      // Default to current date
      const today = new Date();
      setStartDate(today);
      
      // Set end date to next day
      const nextDay = new Date(today);
      nextDay.setDate(nextDay.getDate() + 1);
      setEndDate(nextDay);
    }
  }, [initialDate, initialRental, initialTimeOfDay]);
  
  // Format date for display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('fr-FR');
  };
  
  // Handle date change from picker
  const onStartDateChange = (event: any, selectedDate?: Date) => {
    setShowStartDatePicker(false);
    if (selectedDate) {
      setStartDate(selectedDate);
      
      // If end date is before start date, update it
      if (endDate < selectedDate) {
        const newEndDate = new Date(selectedDate);
        newEndDate.setDate(selectedDate.getDate() + 1);
        setEndDate(newEndDate);
      }
    }
  };
  
  const onEndDateChange = (event: any, selectedDate?: Date) => {
    setShowEndDatePicker(false);
    if (selectedDate) {
      setEndDate(selectedDate);
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    // Validate inputs
    if (!renterName.trim()) {
      Alert.alert(Translations.error, 'Nom du locataire requis');
      return;
    }
    
    // Validate start date is not after end date (compare at day level to allow same-day rentals)
    const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const endDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    if (startDay > endDay) {
      Alert.alert(Translations.error, 'La date de début doit être avant la date de fin');
      return;
    }
    
    const rentalData: RentalPeriod = {
      houseId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      renterName: renterName.trim(),
      notes: notes.trim(),
      startHalfDay, // Add half-day check-in option
      endHalfDay,   // Add half-day check-out option
    };
    
    if (initialRental) {
      // Update existing rental - include id and tempId if they exist
      if (initialRental.id) {
        rentalData.id = initialRental.id;
      }
      if (initialRental.tempId) {
        rentalData.tempId = initialRental.tempId;
      }
      const updateSuccess = await updateRentalPeriod(rentalData);
      
      if (updateSuccess) {
        Alert.alert(Translations.success, 'Location modifiée avec succès');
        onComplete();
      } else {
        Alert.alert(Translations.error, 'Une ou plusieurs dates dans cette période sont déjà réservées');
      }
    } else {
      // Add new rental period
      const addSuccess = await addRentalPeriod(rentalData);
      if (addSuccess) {
        Alert.alert(Translations.success, 'Location ajoutée avec succès');
        onComplete();
      } else {
        Alert.alert(Translations.error, 'Une ou plusieurs dates dans cette période sont déjà réservées');
      }
    }
  };
  
  // If not admin, don't show the form
  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>
          Seul l&apos;administrateur peut ajouter des locations
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {initialRental ? Translations.editRental : Translations.addRental}
      </Text>
      
      <View style={styles.formGroup}>
        <Text style={styles.label}>{Translations.startDate}</Text>
        <TouchableOpacity 
          style={styles.dateInput}
          onPress={() => setShowStartDatePicker(true)}
        >
          <Text style={styles.dateText}>{formatDate(startDate)}</Text>
        </TouchableOpacity>
        {showStartDatePicker && (
          <DateTimePicker
            value={startDate}
            mode="date"
            display="default"
            onChange={onStartDateChange}
          />
        )}
        
        <View style={styles.halfDayOption}>
          <Text style={styles.halfDayLabel}>{Translations.startHalfDay}</Text>
          <Switch
            value={startHalfDay}
            onValueChange={setStartHalfDay}
            trackColor={{ false: '#767577', true: '#81b0ff' }}
            thumbColor={startHalfDay ? '#2196F3' : '#f4f3f4'}
          />
        </View>
      </View>
      
      <View style={styles.formGroup}>
        <Text style={styles.label}>{Translations.endDate}</Text>
        <TouchableOpacity 
          style={styles.dateInput}
          onPress={() => setShowEndDatePicker(true)}
        >
          <Text style={styles.dateText}>{formatDate(endDate)}</Text>
        </TouchableOpacity>
        {showEndDatePicker && (
          <DateTimePicker
            value={endDate}
            mode="date"
            display="default"
            onChange={onEndDateChange}
          />
        )}
        
        <View style={styles.halfDayOption}>
          <Text style={styles.halfDayLabel}>{Translations.endHalfDay}</Text>
          <Switch
            value={endHalfDay}
            onValueChange={setEndHalfDay}
            trackColor={{ false: '#767577', true: '#81b0ff' }}
            thumbColor={endHalfDay ? '#2196F3' : '#f4f3f4'}
          />
        </View>
      </View>
      
      <View style={styles.formGroup}>
        <Text style={styles.label}>{Translations.renterName}</Text>
        <TextInput
          style={styles.input}
          value={renterName}
          onChangeText={setRenterName}
          placeholder="Nom du locataire"
        />
      </View>
      
      <View style={styles.formGroup}>
        <Text style={styles.label}>{Translations.notes}</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Notes additionnelles"
          multiline
          numberOfLines={3}
        />
      </View>
      
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.cancelButton} onPress={onComplete}>
          <Text style={styles.buttonText}>{Translations.cancel}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.saveButton} onPress={handleSubmit}>
          <Text style={styles.buttonText}>{Translations.save}</Text>
        </TouchableOpacity>
      </View>
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
    marginBottom: 16,
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#f9f9f9',
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  cancelButton: {
    backgroundColor: '#95a5a6',
    borderRadius: 8,
    padding: 16,
    flex: 1,
    marginRight: 8,
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#27ae60',
    borderRadius: 8,
    padding: 16,
    flex: 1,
    marginLeft: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 16,
    textAlign: 'center',
  },
  halfDayOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  halfDayLabel: {
    fontSize: 14,
    color: '#555',
  },
});

export default RentalForm;