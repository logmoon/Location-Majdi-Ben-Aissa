import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import HouseTasks from './components/HouseTasks';
import { Translations } from './constants/Translations';
import { useRefresh } from './context/RefreshContext';
import { useRental } from './context/RentalContext';

const { width, height } = Dimensions.get('window');

export default function HouseScreen() {
  const { houseId: houseIdParam } = useLocalSearchParams<{ houseId: string }>();
  const houseId = houseIdParam ? parseInt(houseIdParam, 10) : 1;
  const { refreshAll, isRefreshing } = useRefresh();
  const { houses, isHouseAvailable } = useRental();
  const router = useRouter();

  const house = houses.find(h => h.id === houseId) || houses[0];

  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxVisible, setLightboxVisible] = useState(false);

  const galleryRef = useRef<FlatList>(null);
  const lightboxRef = useRef<FlatList>(null);

  // Guard: houses still loading
  if (!house) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#999' }}>Chargement...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Use local date string to avoid UTC midnight off-by-one on availability check
  const today = new Date();
  const todayLocalISO = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const timeOfDay = today.getHours() < 12 ? 'AM' : 'PM';
  const isAvailable = isHouseAvailable(house.id, todayLocalISO, timeOfDay);

  const handleGalleryScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    setActiveIndex(index);
  };

  const handleLightboxScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    setLightboxIndex(index);
  };

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxVisible(true);
    // Scroll lightbox to the tapped image after it mounts
    setTimeout(() => {
      lightboxRef.current?.scrollToIndex({ index, animated: false });
    }, 50);
  };

  const closeLightbox = () => setLightboxVisible(false);

  const handleCalendarPress = () => {
    router.push({ pathname: '/calendar', params: { houseId: house.id } });
  };

  const hasImages = house.images && house.images.length > 0;
  const images = house.images || [];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refreshAll}
            colors={['#3498db']}
            tintColor="#3498db"
          />
        }>

        {/* Thumbnail gallery */}
        {hasImages ? (
          <View style={styles.galleryContainer}>
            <FlatList
              ref={galleryRef}
              data={images}
              keyExtractor={item => item.id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={handleGalleryScroll}
              scrollEventThrottle={16}
              renderItem={({ item, index }) => (
                <TouchableWithoutFeedback onPress={() => openLightbox(index)}>
                  <View>
                    <Image
                      source={{ uri: item.url }}
                      style={styles.galleryImage}
                      contentFit="cover"
                    />
                  </View>
                </TouchableWithoutFeedback>
              )}
            />
            {/* Tap hint */}
            <View style={styles.tapHint}>
              <Ionicons name="expand-outline" size={14} color="white" />
              <Text style={styles.tapHintText}>Appuyer pour agrandir</Text>
            </View>
            {images.length > 1 && (
              <View style={styles.dotsContainer}>
                {images.map((_, i) => (
                  <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.imagePlaceholderText}>{house.code}</Text>
          </View>
        )}

        {/* Details */}
        <View style={styles.detailsContainer}>
          <View style={styles.titleRow}>
            <Text style={styles.houseName}>{house.name}</Text>
            <View style={[styles.badge, { backgroundColor: isAvailable ? '#4CAF50' : '#F44336' }]}>
              <Text style={styles.badgeText}>
                {isAvailable ? Translations.available : Translations.rented}
              </Text>
            </View>
          </View>

          <Text style={styles.houseCode}>{house.code}</Text>

          {house.price > 0 && (
            <View style={styles.priceRow}>
              <Ionicons name="pricetag-outline" size={18} color="#27ae60" />
              <Text style={styles.price}>{house.price} DT / nuit</Text>
            </View>
          )}

          {house.description ? (
            <Text style={styles.description}>{house.description}</Text>
          ) : null}
        </View>

        {/* Tasks — admin only, renders null for non-admins */}
        <HouseTasks houseId={house.id} />

      </ScrollView>

      {/* Calendar button pinned at bottom */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.calendarButton} onPress={handleCalendarPress}>
          <Ionicons name="calendar-outline" size={20} color="white" />
          <Text style={styles.calendarButtonText}>Voir le calendrier</Text>
        </TouchableOpacity>
      </View>

      {/* Fullscreen lightbox */}
      <Modal
        visible={lightboxVisible}
        transparent={false}
        animationType="fade"
        onRequestClose={closeLightbox}
        statusBarTranslucent
      >
        <StatusBar hidden />
        <View style={styles.lightbox}>
          <FlatList
            ref={lightboxRef}
            data={images}
            keyExtractor={item => item.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleLightboxScroll}
            scrollEventThrottle={16}
            initialScrollIndex={lightboxIndex}
            getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
            renderItem={({ item }) => (
              <View style={styles.lightboxImageContainer}>
                <Image
                  source={{ uri: item.url }}
                  style={styles.lightboxImage}
                  contentFit="contain"
                />
              </View>
            )}
          />

          {/* Counter */}
          {images.length > 1 && (
            <View style={styles.lightboxCounter}>
              <Text style={styles.lightboxCounterText}>
                {lightboxIndex + 1} / {images.length}
              </Text>
            </View>
          )}

          {/* Dots */}
          {images.length > 1 && (
            <View style={styles.lightboxDots}>
              {images.map((_, i) => (
                <View key={i} style={[styles.dot, i === lightboxIndex && styles.dotActive]} />
              ))}
            </View>
          )}

          {/* Close button */}
          <TouchableOpacity style={styles.closeButton} onPress={closeLightbox}>
            <Ionicons name="close" size={28} color="white" />
          </TouchableOpacity>
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
  scrollContent: {
    paddingBottom: 16,
  },

  // Thumbnail gallery
  galleryContainer: {
    width,
    height: width * 0.7,
    backgroundColor: '#e0e0e0',
  },
  galleryImage: {
    width,
    height: width * 0.7,
  },
  tapHint: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tapHintText: {
    color: 'white',
    fontSize: 11,
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 12,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dotActive: {
    backgroundColor: 'white',
    width: 18,
  },
  imagePlaceholder: {
    width,
    height: width * 0.7,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#3498db',
  },
  imagePlaceholderText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: 'white',
  },

  // Details card
  detailsContainer: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  houseName: {
    fontSize: 22,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  houseCode: {
    fontSize: 14,
    color: '#999',
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  price: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#27ae60',
  },
  description: {
    fontSize: 15,
    color: '#555',
    lineHeight: 22,
  },

  // Footer
  footer: {
    padding: 16,
    paddingBottom: 24,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  calendarButton: {
    backgroundColor: '#3498db',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  calendarButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Lightbox
  lightbox: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
  },
  lightboxImageContainer: {
    width,
    height,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxImage: {
    width,
    height,
  },
  lightboxCounter: {
    position: 'absolute',
    top: 52,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  lightboxCounterText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  lightboxDots: {
    position: 'absolute',
    bottom: 48,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  closeButton: {
    position: 'absolute',
    top: 48,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
