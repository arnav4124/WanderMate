import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, FlatList, Linking, RefreshControl, Platform } from 'react-native';
import { Text, Searchbar, Chip, Card, useTheme, Button, Surface, ActivityIndicator, IconButton, Portal, Snackbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { WebView } from 'react-native-webview';
import BottomSheet, { BottomSheetView, BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useRouter, useNavigation } from 'expo-router';

import api from '@/services/api';
import { POI, Day } from '@/types';
import { useTripStore } from '@/stores/tripStore';
import { useAuthStore } from '@/stores/authStore';
import { useActiveTripStore } from '@/stores/activeTripStore';
import { CategoryColors, CategoryIcons } from '@/constants/theme';

const CATEGORIES = ['hotel', 'restaurant', 'landmark', 'activity'] as const;

export default function ExploreScreenV2() {
    const theme = useTheme();
    const router = useRouter();
    const navigation = useNavigation();
    const { trips, fetchTrips, addStop, updateTrip } = useTripStore();
    const { activeTripId, activeDayIndex, setActiveDay } = useActiveTripStore();
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

    const [mode, setMode] = useState<'list' | 'map'>('list');
    const [query, setQuery] = useState('');
    const [lat, setLat] = useState('17.3616'); // Default: Hyderabad
    const [lng, setLng] = useState('78.4747');
    const [results, setResults] = useState<POI[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedPOI, setSelectedPOI] = useState<POI | null>(null);

    const [snackbarVisible, setSnackbarVisible] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');

    const sheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ['10%', '45%', '90%'], []);

    const activeTrip = useMemo(() => trips.find(t => t._id === activeTripId), [trips, activeTripId]);

    const showMessage = useCallback((message: string) => {
        setSnackbarMessage(message);
        setSnackbarVisible(true);
    }, []);

    // Set location based on active trip destination or current location
    useEffect(() => {
        const updateLocation = async () => {
            if (activeTrip?.destination) {
                try {
                    const geocoded = await Location.geocodeAsync(activeTrip.destination);
                    if (geocoded && geocoded.length > 0) {
                        setLat(geocoded[0].latitude.toString());
                        setLng(geocoded[0].longitude.toString());
                        return;
                    }
                } catch (e) {
                    console.error("Geocoding failed", e);
                }
            }
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                const loc = await Location.getCurrentPositionAsync({});
                setLat(loc.coords.latitude.toString());
                setLng(loc.coords.longitude.toString());
            }
        };
        updateLocation();
    }, [activeTrip?.destination]);

    useEffect(() => {
        if (!isAuthenticated) return;
        fetchTrips();
    }, [isAuthenticated, fetchTrips]);

    useEffect(() => {
        if (activeTrip) {
            navigation.setOptions({ title: activeTrip.name });
        } else {
            navigation.setOptions({ title: 'Explore' });
        }
    }, [navigation, activeTrip]);

    const runSearch = useCallback(async (overrideCategory?: string | null, isRefresh = false) => {
        const activeCategory = overrideCategory !== undefined ? overrideCategory : selectedCategory;
        const activeQuery = activeCategory ? '' : query;

        if (!activeQuery && !activeCategory) return;

        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        try {
            let response;
            if (activeCategory) {
                response = await api.get(`/poi/category/${activeCategory}`, {
                    params: { lat, lng, radius: 5000, refresh: isRefresh },
                });
            } else {
                response = await api.get('/poi/search', {
                    params: { q: activeQuery, lat, lng, radius: 5000, refresh: isRefresh },
                });
            }
            setResults(response.data);
            setSelectedPOI(null);
        } catch (error) {
            console.error('Search error:', error);
            showMessage('Search failed. Please try again.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [query, lat, lng, selectedCategory, showMessage]);

    const searchPOI = useCallback(async () => {
        await runSearch(undefined, false);
    }, [runSearch]);

    const onRefresh = useCallback(async () => {
        await runSearch(undefined, true);
    }, [runSearch]);

    const handleAddToTrip = async (poi: POI) => {
        if (!activeTrip) {
            showMessage('Please select an active trip from the Home tab first.');
            return;
        }

        const savedTrip = await addStop(activeTrip._id, activeDayIndex, {
            name: poi.name,
            placeId: poi.placeId,
            lat: poi.lat,
            lng: poi.lng,
            category: ['hotel', 'restaurant', 'landmark', 'activity', 'transport', 'other'].includes(poi.category)
                ? poi.category as any
                : 'other',
            address: poi.address || undefined,
            rating: poi.rating || undefined,
            photo: poi.photo || undefined,
            order: 0,
        });

        if (savedTrip) {
            showMessage(`${poi.name} added to ${activeTrip.name} (Day ${activeDayIndex + 1})`);
            sheetRef.current?.snapToIndex(1); // Open sheet to show it
            return;
        }

        showMessage('Could not add stop to this trip. Please try again.');
    };

    const openSource = useCallback(async (poi: POI) => {
        const url = poi.source === 'google_places'
            ? (poi.placeId
                ? `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(poi.placeId)}`
                : `https://www.google.com/maps/search/?api=1&query=${poi.lat},${poi.lng}`)
            : `https://www.openstreetmap.org/?mlat=${poi.lat}&mlon=${poi.lng}#map=16/${poi.lat}/${poi.lng}`;

        try {
            const supported = await Linking.canOpenURL(url);
            if (supported) {
                await Linking.openURL(url);
            } else {
                showMessage('Could not open map link.');
            }
        } catch (error) {
            console.error('Open source link error:', error);
        }
    }, [showMessage]);

    const handleCategoryPress = useCallback(async (category: string) => {
        const nextCategory = selectedCategory === category ? null : category;
        setSelectedCategory(nextCategory);
        setQuery('');

        if (nextCategory) {
            await runSearch(nextCategory);
        }
    }, [selectedCategory, runSearch]);

    const handleAddDay = async () => {
        if (!activeTrip) return;
        const newDayNumber = activeTrip.days.length + 1;
        const lastDay = activeTrip.days[activeTrip.days.length - 1];
        const newDate = lastDay ? new Date(lastDay.date) : new Date();
        if (lastDay) {
            newDate.setDate(newDate.getDate() + 1);
        }
        
        const newDay: Day = {
            dayNumber: newDayNumber,
            date: newDate.toISOString(),
            stops: []
        };
        
        const newDays = [...activeTrip.days, newDay];
        await updateTrip(activeTrip._id, { days: newDays });
        showMessage(`Day ${newDayNumber} added`);
        setActiveDay(newDays.length - 1);
    };

    const handleMapMessage = (event: any) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'PIN_CLICK' && data.id) {
                const poi = results.find(r => r.id === data.id);
                if (poi) {
                    setSelectedPOI(poi);
                }
            }
        } catch (e) {
            console.error("Failed to parse map message", e);
        }
    };

    const renderPriceLevel = (level?: number) => {
        if (level === undefined) return null;
        if (level === 0) return 'FREE';
        return Array(level).fill('$').join('');
    };

    const renderPOICard = ({ item }: { item: POI }) => (
        <Card style={[styles.poiCard, { backgroundColor: theme.colors.surface }]} mode="elevated">
            {item.photo && (
                <Card.Cover source={{ uri: item.photo }} style={styles.poiImage} />
            )}
            <Card.Content style={styles.poiContent}>
                <View style={styles.poiHeader}>
                    <View style={[styles.categoryBadge, { backgroundColor: CategoryColors[item.category] || '#95E1D3' }]}>
                        <MaterialCommunityIcons
                            name={(CategoryIcons[item.category] || 'map-marker') as any}
                            size={14}
                            color="#FFF"
                        />
                    </View>
                    <Text variant="titleSmall" style={{ flex: 1, fontWeight: '700', color: theme.colors.onSurface }} numberOfLines={1}>
                        {item.name}
                    </Text>
                    {item.rating && (
                        <View style={styles.ratingContainer}>
                            <MaterialCommunityIcons name="star" size={14} color="#FFD93D" />
                            <Text variant="bodySmall" style={{ marginLeft: 2, fontWeight: '600', color: theme.colors.onSurface }}>
                                {item.rating.toFixed(1)}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Badges for distance, hours, price */}
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    {(item.openingHours === 'Open 24 hours' || item.openingHours) && (
                        <Chip compact textStyle={{ fontSize: 10 }} icon="clock-outline" style={{ height: 24 }}>
                            {Array.isArray(item.openingHours) ? 'Open Today' : (item.openingHours || 'Open')}
                        </Chip>
                    )}
                    {item.priceLevel !== undefined && (
                        <Chip compact textStyle={{ fontSize: 10 }} icon="cash" style={{ height: 24, backgroundColor: item.priceLevel === 0 ? '#E8F5E9' : undefined }}>
                            {renderPriceLevel(item.priceLevel)}
                        </Chip>
                    )}
                </View>

                {item.address && (
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }} numberOfLines={2}>
                        {item.address}
                    </Text>
                )}

                <View style={styles.poiActions}>
                    <Button
                        mode="contained"
                        compact
                        onPress={() => handleAddToTrip(item)}
                        icon="plus"
                        style={{ flex: 1, marginRight: 8 }}
                    >
                        Add to Trip
                    </Button>
                    <Button
                        mode="outlined"
                        compact
                        onPress={() => {
                            setMode('map');
                            setSelectedPOI(item);
                        }}
                        icon="map"
                    >
                        Map View
                    </Button>
                </View>
            </Card.Content>
        </Card>
    );

    const mapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        * { margin: 0; padding: 0; }
        body { overflow: hidden; }
        #map { width: 100%; height: 100vh; }
        .custom-marker {
          background-color: white;
          border-radius: 50%;
          border: 3px solid;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 14px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map').setView([${lat}, ${lng}], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

        var markers = [];
        
        // Render stops
        var stops = ${JSON.stringify((activeTrip?.days[activeDayIndex]?.stops || []).map((s, i) => ({
            lat: s.lat,
            lng: s.lng,
            name: s.name,
            category: s.category,
            order: i + 1,
            color: CategoryColors[s.category] || '#95E1D3',
        })))};

        stops.forEach(function(stop) {
            var icon = L.divIcon({
                className: '',
                html: '<div class="custom-marker" style="border-color: ' + stop.color + '; color: ' + stop.color + ';">' + stop.order + '</div>',
                iconSize: [32, 32],
                iconAnchor: [16, 16],
            });
            var marker = L.marker([stop.lat, stop.lng], { icon: icon }).addTo(map);
            markers.push(marker);
        });

        // Draw polyline connecting stops
        if (stops.length >= 2) {
            var latlngs = stops.map(function(s) { return [s.lat, s.lng]; });
            L.polyline(latlngs, {
                color: '#1B6EF3',
                weight: 3,
                opacity: 0.6,
                dashArray: '8, 8',
            }).addTo(map);
        }

        // Add selected POI if it exists
        var selectedPOI = ${selectedPOI ? JSON.stringify({
            id: selectedPOI.id,
            lat: selectedPOI.lat,
            lng: selectedPOI.lng,
            name: selectedPOI.name,
            color: CategoryColors[selectedPOI.category] || '#FF5722'
        }) : 'null'};

        if (selectedPOI) {
            var icon = L.divIcon({
                className: '',
                html: '<div class="custom-marker" style="border-color: ' + selectedPOI.color + '; color: ' + selectedPOI.color + ';">' + '<div style="width:12px;height:12px;background-color:'+selectedPOI.color+';border-radius:50%;"></div>' + '</div>',
                iconSize: [36, 36],
                iconAnchor: [18, 18],
            });
            var marker = L.marker([selectedPOI.lat, selectedPOI.lng], { icon: icon, zIndexOffset: 1000 }).addTo(map);
            markers.push(marker);
        }

        if (markers.length > 0) {
            var group = L.featureGroup(markers);
            map.fitBounds(group.getBounds().pad(0.1));
        } else if (stops.length === 0 && !selectedPOI) {
            // fallback center
            map.setView([${lat}, ${lng}], 13);
        }
      </script>
    </body>
    </html>
  `;

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {/* Header Area */}
            <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.outlineVariant }]}>
                <View style={styles.searchSection}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Searchbar
                            placeholder="Search places..."
                            value={query}
                            onChangeText={setQuery}
                            onSubmitEditing={searchPOI}
                            style={[styles.searchbar, { backgroundColor: theme.colors.surfaceVariant, flex: 1 }]}
                            inputStyle={{ fontSize: 15 }}
                        />
                        <IconButton
                            icon={mode === 'list' ? 'map' : 'format-list-bulleted'}
                            mode="contained-tonal"
                            size={24}
                            onPress={() => setMode(mode === 'list' ? 'map' : 'list')}
                        />
                    </View>

                    {mode === 'list' && (
                        <View style={styles.categoryRow}>
                            {CATEGORIES.map((cat) => (
                                <Chip
                                    key={cat}
                                    selected={selectedCategory === cat}
                                    onPress={() => handleCategoryPress(cat)}
                                    mode="flat"
                                    style={[styles.catChip, selectedCategory === cat && { backgroundColor: CategoryColors[cat] + '30' }]}
                                    textStyle={{ fontSize: 12, textTransform: 'capitalize' }}
                                    icon={() => (
                                        <MaterialCommunityIcons
                                            name={(CategoryIcons[cat] || 'map-marker') as any}
                                            size={16}
                                            color={selectedCategory === cat ? CategoryColors[cat] : theme.colors.onSurfaceVariant}
                                        />
                                    )}
                                >
                                    {cat}
                                </Chip>
                            ))}
                        </View>
                    )}
                </View>
            </View>

            {/* Main Content Area */}
            <View style={styles.content}>
                {loading && !refreshing && mode === 'list' ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={theme.colors.primary} />
                        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>
                            Searching places...
                        </Text>
                    </View>
                ) : mode === 'list' ? (
                    <FlatList
                        data={results}
                        keyExtractor={(item) => item.id}
                        renderItem={renderPOICard}
                        contentContainerStyle={styles.list}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} />
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <MaterialCommunityIcons name="compass-outline" size={64} color={theme.colors.primary} style={{ opacity: 0.4 }} />
                                <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>
                                    Search for hotels, restaurants, or landmarks
                                </Text>
                            </View>
                        }
                    />
                ) : (
                    <View style={{ flex: 1 }}>
                        <WebView
                            source={{ html: mapHtml }}
                            style={{ flex: 1 }}
                            javaScriptEnabled
                            onMessage={handleMapMessage}
                        />
                        {/* Map Mode Mini Card */}
                        {selectedPOI && (
                            <View style={styles.miniCardContainer}>
                                <Card style={[styles.poiCard, { backgroundColor: theme.colors.surface, marginBottom: 0 }]} mode="elevated">
                                    <Card.Content style={styles.poiContent}>
                                        <View style={styles.poiHeader}>
                                            <Text variant="titleMedium" style={{ flex: 1, fontWeight: '700' }} numberOfLines={1}>
                                                {selectedPOI.name}
                                            </Text>
                                            <IconButton icon="close" size={20} onPress={() => setSelectedPOI(null)} style={{ margin: 0 }} />
                                        </View>
                                        <View style={styles.poiActions}>
                                            <Button mode="contained" compact onPress={() => handleAddToTrip(selectedPOI)} icon="plus">
                                                Add to Trip
                                            </Button>
                                            <Button mode="outlined" compact onPress={() => openSource(selectedPOI)}>
                                                More Details
                                            </Button>
                                        </View>
                                    </Card.Content>
                                </Card>
                            </View>
                        )}
                    </View>
                )}
            </View>

            {/* Bottom Sheet for Itinerary */}
            {activeTrip && (
                <BottomSheet
                    ref={sheetRef}
                    index={0}
                    snapPoints={snapPoints}
                    enablePanDownToClose={false}
                    backgroundStyle={{ backgroundColor: theme.colors.surface, borderTopWidth: 1, borderTopColor: theme.colors.outlineVariant }}
                    handleIndicatorStyle={{ backgroundColor: theme.colors.onSurfaceVariant }}
                >
                    <BottomSheetView style={styles.sheetHeader}>
                        <Text variant="titleMedium" style={{ fontWeight: '700', color: theme.colors.onSurface }}>
                            {activeTrip.name}
                        </Text>
                        <Button mode="text" compact onPress={() => router.push(`/trip/${activeTrip._id}`)}>
                            Edit Trip
                        </Button>
                    </BottomSheetView>
                    
                    <View style={[styles.dayTabs, { backgroundColor: theme.colors.surface }]}>
                        <FlatList
                            horizontal
                            data={activeTrip.days}
                            keyExtractor={(item) => item._id || item.dayNumber.toString()}
                            showsHorizontalScrollIndicator={false}
                            renderItem={({ item, index }) => (
                                <Chip
                                    mode={activeDayIndex === index ? "flat" : "outlined"}
                                    selected={activeDayIndex === index}
                                    onPress={() => setActiveDay(index)}
                                    style={{ marginRight: 8 }}
                                    textStyle={{ fontSize: 12 }}
                                >
                                    Day {item.dayNumber}
                                </Chip>
                            )}
                            ListFooterComponent={
                                <Chip
                                    mode="outlined"
                                    onPress={handleAddDay}
                                    style={{ marginRight: 8 }}
                                    icon="plus"
                                >
                                    Add Day
                                </Chip>
                            }
                        />
                    </View>

                    <BottomSheetFlatList
                        data={activeTrip.days[activeDayIndex]?.stops || []}
                        keyExtractor={(item, index) => item._id || index.toString()}
                        contentContainerStyle={styles.sheetList}
                        renderItem={({ item, index }) => (
                            <View style={styles.stopItem}>
                                <View style={[styles.stopNumber, { backgroundColor: CategoryColors[item.category] || theme.colors.primary }]}>
                                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{index + 1}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text variant="bodyMedium" style={{ fontWeight: '600' }}>{item.name}</Text>
                                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{item.category}</Text>
                                </View>
                            </View>
                        )}
                        ListEmptyComponent={
                            <View style={styles.emptyStops}>
                                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>No stops for this day yet.</Text>
                            </View>
                        }
                    />
                </BottomSheet>
            )}

            <Snackbar
                visible={snackbarVisible}
                onDismiss={() => setSnackbarVisible(false)}
                duration={3000}
                style={{ bottom: 80 }}
            >
                {snackbarMessage}
            </Snackbar>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { paddingBottom: 12, borderBottomWidth: 1, zIndex: 10 },
    activeTripBanner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 6, marginBottom: 8 },
    searchSection: { paddingHorizontal: 16, gap: 12 },
    searchbar: { borderRadius: 12, elevation: 0, height: 48 },
    categoryRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    catChip: { borderRadius: 20 },
    content: { flex: 1 },
    list: { padding: 16, paddingBottom: 100 },
    poiCard: { marginBottom: 12, borderRadius: 14, overflow: 'hidden' },
    poiImage: { height: 140 },
    poiContent: { padding: 12 },
    poiHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    categoryBadge: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    ratingContainer: { flexDirection: 'row', alignItems: 'center' },
    poiActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyContainer: { alignItems: 'center', paddingTop: 60 },
    miniCardContainer: { position: 'absolute', bottom: 100, left: 16, right: 16, zIndex: 20 },
    
    // Bottom Sheet styles
    sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, paddingTop: 8 },
    dayTabs: { paddingHorizontal: 16, paddingBottom: 16 },
    sheetList: { paddingHorizontal: 16, paddingBottom: 24 },
    stopItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ccc' },
    stopNumber: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    emptyStops: { padding: 24, alignItems: 'center' },
});
