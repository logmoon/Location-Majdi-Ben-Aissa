import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import RentalCalendar from './components/RentalCalendar';
import RentalForm from './components/RentalForm';
import { Translations } from './constants/Translations';
import { useRental } from './context/RentalContext';

const SCREEN_WIDTH = Dimensions.get('window').width;

const MONTHS_BEFORE = 12;
const MONTHS_AFTER  = 24;

interface MonthPage {
    month: number;
    year: number;
    index: number;
}

function buildMonthList(anchorMonth: number, anchorYear: number): MonthPage[] {
    const total = MONTHS_BEFORE + 1 + MONTHS_AFTER;
    return Array.from({ length: total }, (_, i) => {
        const delta = i - MONTHS_BEFORE;
        let m = anchorMonth + delta;
        let y = anchorYear;
        while (m > 11) { m -= 12; y++; }
        while (m < 0)  { m += 12; y--; }
        return { month: m, year: y, index: i };
    });
}

export default function CalendarScreen() {
    const { houseId: houseIdParam } = useLocalSearchParams<{ houseId: string }>();
    const { houses, isAdmin, syncRentalPeriods, isSyncing } = useRental();

    const houseId = houseIdParam ? parseInt(houseIdParam, 10) : 1;
    const selectedHouse = houses.find(h => h.id === houseId) || houses[0];

    const today = new Date();
    const todayMonth = today.getMonth();
    const todayYear  = today.getFullYear();

    const pages = useMemo(() => buildMonthList(todayMonth, todayYear), []);
    const initialIndex = MONTHS_BEFORE;

    // Header label state — only thing that updates during scroll
    const [headerMonth, setHeaderMonth] = useState(todayMonth);
    const [headerYear,  setHeaderYear]  = useState(todayYear);

    // Track current index for arrow buttons — ref so it doesn't cause re-renders
    const currentIndexRef = useRef(initialIndex);
    const flatListRef = useRef<FlatList<MonthPage>>(null);

    const [showForm, setShowForm] = useState(false);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [selectedTimeOfDay, setSelectedTimeOfDay] = useState<'AM' | 'PM' | undefined>(undefined);

    // Compute month from scroll offset directly — no bridge delay, no viewability lag
    const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
        if (index === currentIndexRef.current) return;
        currentIndexRef.current = index;
        const page = pages[index];
        if (page) {
            setHeaderMonth(page.month);
            setHeaderYear(page.year);
        }
    }, [pages]);

    const scrollToIndex = useCallback((index: number) => {
        flatListRef.current?.scrollToIndex({ index, animated: true });
    }, []);

    const handlePrevMonth = useCallback(() => {
        scrollToIndex(Math.max(0, currentIndexRef.current - 1));
    }, [scrollToIndex]);

    const handleNextMonth = useCallback(() => {
        scrollToIndex(Math.min(pages.length - 1, currentIndexRef.current + 1));
    }, [pages.length, scrollToIndex]);

    const handleDayPress = useCallback((date: string, timeOfDay?: 'AM' | 'PM') => {
        if (isAdmin) {
            setSelectedDate(date);
            setSelectedTimeOfDay(timeOfDay);
            setShowForm(true);
        }
    }, [isAdmin]);

    const handleRefresh = useCallback(async () => {
        await syncRentalPeriods();
    }, [syncRentalPeriods]);

    const handleFormComplete = useCallback(() => {
        setShowForm(false);
        setSelectedDate(null);
        setSelectedTimeOfDay(undefined);
    }, []);

    const renderItem = useCallback(({ item }: { item: MonthPage }) => (
        <View style={styles.page}>
            <RentalCalendar
                houseId={houseId}
                month={item.month}
                year={item.year}
                onDayPress={handleDayPress}
            />
        </View>
    ), [houseId, handleDayPress]);

    const getItemLayout = useCallback((_: any, index: number) => ({
        length: SCREEN_WIDTH,
        offset: SCREEN_WIDTH * index,
        index,
    }), []);

    const keyExtractor = useCallback((item: MonthPage) => `${item.year}-${item.month}`, []);

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.houseView}>
                <Text style={styles.houseName}>
                    {selectedHouse ? selectedHouse.name : Translations.calendar}
                </Text>
            </View>

            <View style={styles.monthSelector}>
                <TouchableOpacity style={styles.monthButton} onPress={handlePrevMonth}>
                    <Ionicons name="chevron-back" size={24} color="white" />
                </TouchableOpacity>
                <Text style={styles.monthText}>
                    {Translations.months[headerMonth]} {headerYear}
                </Text>
                <TouchableOpacity style={styles.monthButton} onPress={handleNextMonth}>
                    <Ionicons name="chevron-forward" size={24} color="white" />
                </TouchableOpacity>
            </View>

            <FlatList
                ref={flatListRef}
                data={pages}
                keyExtractor={keyExtractor}
                renderItem={renderItem}
                getItemLayout={getItemLayout}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                initialScrollIndex={initialIndex}
                onScroll={onScroll}
                scrollEventThrottle={16}
                // Pre-render 5 pages (2 on each side) so fast swipes never hit blank
                windowSize={5}
                maxToRenderPerBatch={2}
                initialNumToRender={3}
                removeClippedSubviews={false}
                bounces={false}
                refreshControl={
                    <RefreshControl
                        refreshing={isSyncing}
                        onRefresh={handleRefresh}
                        colors={['#3498db']}
                        tintColor="#3498db"
                    />
                }
            />

            <Modal
                visible={showForm}
                transparent={true}
                animationType="slide"
                onRequestClose={handleFormComplete}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <RentalForm
                            houseId={houseId}
                            onComplete={handleFormComplete}
                            initialDate={selectedDate || undefined}
                            initialTimeOfDay={selectedTimeOfDay}
                        />
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    houseView: {
        alignItems: 'center',
        padding: 25,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
    },
    houseName: {
        fontSize: 22,
        fontWeight: 'bold',
    },
    monthSelector: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
    },
    monthButton: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: '#3498db',
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    monthText: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    page: {
        width: SCREEN_WIDTH,
        paddingBottom: 20,
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
        width: '90%',
        maxHeight: '80%',
    },
});
