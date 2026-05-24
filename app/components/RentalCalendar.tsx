import React, { JSX, memo, useState } from 'react';
import { Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { buildCalendarDays } from '../../lib/calendarLogic';
import { Translations } from '../constants/Translations';
import { RentalPeriod, useRental } from '../context/RentalContext';
import RentalForm from './RentalForm';

interface RentalCalendarProps {
  houseId: number;
  month: number; // 0-11 (JavaScript months)
  year: number;
  onDayPress?: (date: string, timeOfDay?: 'AM' | 'PM') => void;
}

interface RentalDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  houseId: number;
  date: string;
  timeOfDay?: 'AM' | 'PM';
}

const RentalDetailsModal: React.FC<RentalDetailsModalProps> = ({ 
  visible, 
  onClose, 
  houseId, 
  date,
  timeOfDay
}) => {
  const { getRentalPeriodForDate, removeRentalPeriod, isAdmin } = useRental();
  const [showEditForm, setShowEditForm] = useState(false);
  
  // Get the rental period for the specific time of day if provided
  const rentalPeriod = getRentalPeriodForDate(houseId, date, timeOfDay);
  
  // If the modal is visible but no rental is found, close it via effect (not during render)
  React.useEffect(() => {
    if (visible && !rentalPeriod) {
      onClose();
    }
  }, [visible, rentalPeriod, onClose]);

  if (!rentalPeriod) {
    return null;
  }
  
  const handleDelete = () => {
    Alert.alert(
      'Supprimer la location',
      `Êtes-vous sûr de vouloir supprimer la location de ${rentalPeriod.renterName} ?`,
      [
        { text: Translations.cancel, style: 'cancel' },
        {
          text: Translations.delete,
          style: 'destructive',
          onPress: () => {
            // Identify by id when available — startDate-based lookup fails after an edit
            if (rentalPeriod.id) {
              removeRentalPeriod(houseId, rentalPeriod.startDate);
            } else {
              removeRentalPeriod(houseId, rentalPeriod.startDate);
            }
            onClose();
          },
        },
      ]
    );
  };
  
  const handleEdit = () => {
    setShowEditForm(true);
  };
  
  const handleFormComplete = () => {
    setShowEditForm(false);
    onClose();
  };
  
  if (showEditForm) {
    return (
      <Modal
        visible={visible}
        transparent={true}
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <RentalForm 
              houseId={houseId} 
              onComplete={handleFormComplete} 
              initialRental={rentalPeriod}
            />
          </View>
        </View>
      </Modal>
    );
  }
  
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{Translations.rentalDetails}</Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{Translations.renterName}:</Text>
            <Text style={styles.detailValue}>{rentalPeriod.renterName}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{Translations.startDate}:</Text>
            <Text style={styles.detailValue}>
              {new Date(rentalPeriod.startDate).toLocaleDateString('fr-FR')}
              {rentalPeriod.startHalfDay && ` (${Translations.afternoonOnly})`}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{Translations.endDate}:</Text>
            <Text style={styles.detailValue}>
              {new Date(rentalPeriod.endDate).toLocaleDateString('fr-FR')}
              {rentalPeriod.endHalfDay && ` (${Translations.morningOnly})`}
            </Text>
          </View>
          
          {rentalPeriod.notes && (
            <View style={styles.notesContainer}>
              <Text style={styles.detailLabel}>{Translations.notes}:</Text>
              <Text style={styles.notesText}>{rentalPeriod.notes}</Text>
            </View>
          )}
          
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.buttonText}>{Translations.done}</Text>
            </TouchableOpacity>
            
            {isAdmin && (
              <>
                <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
                  <Text style={styles.buttonText}>{Translations.editRental}</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
                  <Text style={styles.buttonText}>{Translations.delete}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const RentalCalendar: React.FC<RentalCalendarProps> = ({ 
  houseId, 
  month, 
  year,
  onDayPress 
}) => {
  const { isHouseAvailable, isAdmin, getRentalPeriodForDate, getRentalPeriodsForHouse } = useRental();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTimeOfDay, setSelectedTimeOfDay] = useState<'AM' | 'PM' | undefined>(undefined);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  
  // Get unique rental periods for this house to create color mapping
  const rentalPeriods = getRentalPeriodsForHouse(houseId);
  const uniqueRentalPeriods = rentalPeriods.reduce((acc: RentalPeriod[], rental) => {
    const key = `${rental.startDate}-${rental.endDate}`;
    if (!acc.find(r => `${r.startDate}-${r.endDate}` === key)) {
      acc.push(rental);
    }
    return acc;
  }, []);
  
  // Generate colors for different rental periods
  const generateRentalColor = (rental: RentalPeriod) => {
    const index = uniqueRentalPeriods.findIndex(r => 
      r.startDate === rental.startDate && r.endDate === rental.endDate
    );
    
    // Base red color with varying hue and saturation
    const hueVariation = (index * 15) % 40; // Vary hue within red spectrum
    const saturation = 70 + (index * 10) % 10; // Vary saturation between 70-100%
    const lightness = 85 + (index * 5) % 10; // Vary lightness between 90-100%
    
    return `hsl(${350 + hueVariation}, ${saturation}%, ${lightness}%)`;
  };
  
  const generateRentalTextColor = (rental: RentalPeriod) => {
    const index = uniqueRentalPeriods.findIndex(r => 
      r.startDate === rental.startDate && r.endDate === rental.endDate
    );
    
    // Darker version for text
    const hueVariation = (index * 15) % 10;
    const saturation = 60 + (index * 10) % 20;
    const lightness = 25 + (index * 5) % 15;
    
    return `hsl(${350 + hueVariation}, ${saturation}%, ${lightness}%)`;
  };
  
  // Calendar days array — built by the shared pure helper
  const calendarDays = buildCalendarDays(month, year);
  
  // Function to check if a day is available
  const isDayAvailable = (day: number, timeOfDay?: 'AM' | 'PM') => {
    const date = new Date(year, month, day).toISOString();
    return isHouseAvailable(houseId, date, timeOfDay);
  };
  
  // Get rental period for a day
  const getRentalForDay = (day: number, timeOfDay?: 'AM' | 'PM') => {
    const date = new Date(year, month, day).toISOString();
    return getRentalPeriodForDate(houseId, date, timeOfDay);
  };
  
  // Handle day press for a specific half-day
  const handleHalfDayPress = (day: number, timeOfDay: 'AM' | 'PM') => {
    const date = new Date(year, month, day).toISOString();
    const isAvailable = isHouseAvailable(houseId, date, timeOfDay);
    
    setSelectedDate(date);
    setSelectedTimeOfDay(timeOfDay);
    
    if (!isAvailable && isAdmin) {
      // Show rental details modal for rented half-days
      setShowDetailsModal(true);
    } else if (isAdmin && onDayPress) {
      // Call the parent's onDayPress for available half-days (if admin)
      onDayPress(date, timeOfDay);
    }
  };
  
  // Handle day press for full day (backward compatibility)
  const handleDayPress = (day: number) => {
    const date = new Date(year, month, day).toISOString();
    const isAvailable = isHouseAvailable(houseId, date);
    
    setSelectedDate(date);
    setSelectedTimeOfDay(undefined);
    
    if (!isAvailable && isAdmin) {
      // Show rental details modal for rented days
      setShowDetailsModal(true);
    } else if (isAdmin && onDayPress) {
      // Call the parent's onDayPress for available days (if admin)
      onDayPress(date);
    }
  };
  
  const closeDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedDate(null);
    setSelectedTimeOfDay(undefined);
  };

  // Create rows of 7 days each
  const renderCalendarGrid = () => {
    const rows: JSX.Element[] = [];
    let currentRow: JSX.Element[] = [];
    
    calendarDays.forEach((day, index) => {
      if (day === null) {
        currentRow.push(
          <View key={index} style={styles.dayCell}>
            <View style={styles.emptyDay} />
          </View>
        );
      } else {
        const isAmAvailable = isDayAvailable(day, 'AM');
        const isPmAvailable = isDayAvailable(day, 'PM');
        
        // Get rentals for each half of the day
        const amRental = getRentalForDay(day, 'AM');
        const pmRental = getRentalForDay(day, 'PM');
        
        // For backward compatibility and displaying the renter name
        const rental = amRental || pmRental;
        const renterName = rental?.renterName || '';
        const amRenterName = amRental?.renterName || '';
        const pmRenterName = pmRental?.renterName || '';
        
        const isToday = new Date().getDate() === day && 
                       new Date().getMonth() === month && 
                       new Date().getFullYear() === year;
        
        const isAmEndDate = amRental && new Date(amRental.endDate).getDate() === day && 
                        new Date(amRental.endDate).getMonth() === month && 
                        new Date(amRental.endDate).getFullYear() === year;
        
        const isPmStartDate = pmRental && new Date(pmRental.startDate).getDate() === day && 
                          new Date(pmRental.startDate).getMonth() === month && 
                          new Date(pmRental.startDate).getFullYear() === year;
        
        const isStartHalfDay = isPmStartDate && pmRental?.startHalfDay;
        const isEndHalfDay = isAmEndDate && amRental?.endHalfDay;
        
        // Determine if this is a half-day rental or if AM and PM have different rentals
        const isHalfDayRental = isStartHalfDay || isEndHalfDay || (amRental !== pmRental && amRental && pmRental);
        
        // Get dynamic colors for each half
        const amBackgroundColor = amRental ? generateRentalColor(amRental) : '#E8F5E9';
        const pmBackgroundColor = pmRental ? generateRentalColor(pmRental) : '#E8F5E9';
        
        // For backward compatibility
        const backgroundColor = rental ? generateRentalColor(rental) : '#E8F5E9';
        const textColor = rental ? generateRentalTextColor(rental) : '#000';
        
        currentRow.push(
          <View key={index} style={styles.dayCell}>
            <View
              style={[
                styles.day,
                isToday && styles.today,
              ]}
            >
              {/* For half-day rentals or days with different AM/PM availability, we use a split container */}
              {(isHalfDayRental || (isAmAvailable !== isPmAvailable)) ? (
                <View style={styles.halfDayContainer}>
                  {/* First half - AM */}
                  <TouchableOpacity 
                    style={[
                      styles.halfDay,
                      styles.firstHalf,
                      { backgroundColor: !isAmAvailable ? amBackgroundColor : '#E8F5E9' }
                    ]}
                    onPress={() => handleHalfDayPress(day, 'AM')}
                  >
                  {isAdmin && rental && renterName && (
                    <Text style={[
                      styles.halfRenterNameText,
                      { color: textColor }
                    ]} numberOfLines={1}>
                      {amRenterName}
                    </Text>
                  )}
                  </TouchableOpacity>
                  {/* Second half - PM */}
                  <TouchableOpacity 
                    style={[
                      styles.halfDay,
                      styles.secondHalf,
                      { backgroundColor: !isPmAvailable ? pmBackgroundColor : '#E8F5E9' }
                    ]}
                    onPress={() => handleHalfDayPress(day, 'PM')}
                  >
                  {isAdmin && rental && renterName && (
                    <Text style={[
                      styles.halfRenterNameText,
                      { color: textColor }
                    ]} numberOfLines={1}>
                      {pmRenterName}
                    </Text>
                  )}
                  </TouchableOpacity>
                  <View style={styles.halfDaySeparatorContainer}>
                    <View style={styles.separatorSegment} />
                    <View style={styles.separatorSpacer} />
                    <View style={styles.separatorSegment} />
                  </View>
                  <Text style={[
                    styles.dayText,
                    { color: isToday ? '#3498db' : textColor },
                    isToday && styles.todayText,
                    styles.halfDayText
                  ]}>
                    {day}
                  </Text>
                </View>
              ) : (
                // Regular full-day cell
                <TouchableOpacity 
                  style={[styles.fullDayContainer, { backgroundColor }]}
                  onPress={() => handleDayPress(day)}
                >
                  <Text style={[
                    styles.dayText,
                    { color: isToday ? '#3498db' : textColor },
                    isToday && styles.todayText,
                  ]}>
                    {day}
                  </Text>
                  {isAdmin && rental && renterName && (
                    <Text style={[
                      styles.renterNameText,
                      { color: textColor }
                    ]} numberOfLines={2}>
                      {renterName}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      }
      
      // If we have 7 items in current row, push to rows and start new row
      if (currentRow.length === 7) {
        rows.push(
          <View key={rows.length} style={styles.calendarRow}>
            {currentRow}
          </View>
        );
        currentRow = [];
      }
    });
    
    // Add any remaining items in the last row
    if (currentRow.length > 0) {
      // Fill remaining cells with empty ones
      while (currentRow.length < 7) {
        currentRow.push(
          <View key={`empty-${currentRow.length}`} style={styles.dayCell}>
            <View style={styles.emptyDay} />
          </View>
        );
      }
      rows.push(
        <View key={rows.length} style={styles.calendarRow}>
          {currentRow}
        </View>
      );
    }
    
    return rows;
  };

  return (
    <View style={styles.container}>
      <View style={styles.calendarRow}>
        {Translations.daysOfWeek.map((day, index) => (
          <View key={index} style={styles.dayCell}>
            <Text style={styles.weekdayText}>
              {day}
            </Text>
          </View>
        ))}
      </View>
      
      <View style={styles.calendarGrid}>
        {renderCalendarGrid()}
      </View>
      
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, styles.availableDay]} />
          <Text style={styles.legendText}>{Translations.availableLegend}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, styles.rentedDay]} />
          <Text style={styles.legendText}>{Translations.rentedLegend}</Text>
        </View>
      </View>
      
      {selectedDate && showDetailsModal && (
        <RentalDetailsModal
          visible={showDetailsModal}
          onClose={closeDetailsModal}
          houseId={houseId}
          date={selectedDate}
          timeOfDay={selectedTimeOfDay}
        />
      )}
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
  calendarGrid: {
    marginBottom: 16,
  },
  calendarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  weekdayText: {
    fontWeight: 'bold',
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  day: {
    width: '90%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    minHeight: 45,
    maxWidth: 38,
    overflow: 'hidden',
  },
  fullDayContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  halfDayContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  halfDay: {
    position: 'absolute',
    width: '100%',
    height: '50%',
  },
  firstHalf: {
    top: 0,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  secondHalf: {
    bottom: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  halfDayText: {
    zIndex: 1, // Ensure text is above the background halves
  },
  emptyDay: {
    width: '90%',
    aspectRatio: 1,
    borderRadius: 8,
    minHeight: 45,
    maxWidth: 38,
  },
  availableDay: {
    backgroundColor: '#E8F5E9', // Light green
  },
  rentedDay: {
    backgroundColor: '#FFEBEE', // Light red (fallback)
  },
  today: {
    borderWidth: 2,
    borderColor: '#3498db',
  },
  dayText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  todayText: {
    fontWeight: 'bold',
  },
  renterNameText: {
    fontSize: 8,
    textAlign: 'center',
    marginVertical: 2,
    width: '100%',
    fontWeight: '500',
    zIndex: 2, // Ensure text is above the background halves
  },
  halfRenterNameText: {
    fontSize: 8,
    textAlign: 'center',
    marginTop: 6,
    width: '100%',
    fontWeight: '500',
    zIndex: 2, // Ensure text is above the background halves
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
    marginBottom: 8,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 4,
  },
  legendText: {
    fontSize: 14,
    color: '#666',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    width: '40%',
  },
  detailValue: {
    fontSize: 16,
    flex: 1,
  },
  notesContainer: {
    marginTop: 8,
    marginBottom: 16,
  },
  notesText: {
    fontSize: 16,
    marginTop: 4,
    backgroundColor: '#f9f9f9',
    padding: 8,
    borderRadius: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  closeButton: {
    backgroundColor: '#3498db',
    borderRadius: 8,
    padding: 12,
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: '#f39c12',
    borderRadius: 8,
    padding: 12,
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: '#e74c3c',
    borderRadius: 8,
    padding: 12,
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  halfDaySeparatorContainer: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 1,
    flexDirection: 'row',
    zIndex: 0,
  },
  separatorSegment: {
    flex: 1,
    backgroundColor: '#666',
    height: '100%',
  },
  separatorSpacer: {
    flex: 1,
    backgroundColor: 'transparent',
    height: '100%',
  },
});

export default memo(RentalCalendar);