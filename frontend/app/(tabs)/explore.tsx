import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, FlatList, Linking, RefreshControl } from 'react-native';
import { Text, Searchbar, Chip, Card, useTheme, Button, Surface, ActivityIndicator, Portal, Modal, Snackbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import api from '@/services/api';
import { POI } from '@/types';
import { useTripStore } from '@/stores/tripStore';
import { useAuthStore } from '@/stores/authStore';
import { CategoryColors, CategoryIcons } from '@/constants/theme';

const CATEGORIES = ['hotel', 'restaurant', 'landmark', 'activity'] as const;

export default function ExploreScreen() {
    const theme = useTheme();
    const { trips, fetchTrips, addStop } = useTripStore();
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const [query, setQuery] = useState('');
    const [lat, setLat] = useState('17.3616'); // Default: Hyderabad
    const [lng, setLng] = useState('78.4747');
    const [results, setResults] = useState<POI[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [tripPickerVisible, setTripPickerVisible] = useState(false);
    const [selectedPOI, setSelectedPOI] = useState<POI | null>(null);
    const [snackbarVisible, setSnackbarVisible] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');

    const showMessage = useCallback((message: string) => {
        setSnackbarMessage(message);
        setSnackbarVisible(true);
    }, []);

    // Get device location on mount
    useEffect(() => {
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                const loc = await Location.getCurrentPositionAsync({});
                setLat(loc.coords.latitude.toString());
                setLng(loc.coords.longitude.toString());
            }
        })();
    }, []);

    useEffect(() => {
        if (!isAuthenticated) return;
        fetchTrips();
    }, [isAuthenticated, fetchTrips]);

    const runSearch = useCallback(async (overrideCategory?: string | null, isRefresh = false) => {
        const activeCategory = overrideCategory !== undefined ? overrideCategory : selectedCategory;
        const activeQuery = activeCategory ? '' : query;

        if (!activeQuery && !activeCategory) return;

        if (isRefresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

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
        } catch (error) {
            console.error('Search error:', error);
            showMessage('Search failed. Please check backend connectivity and try again.');
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

    const handleAddToTrip = (poi: POI) => {
        if (trips.length === 0) {
            showMessage('No trips found. Create a trip first to add places.');
            return;
        }

        setSelectedPOI(poi);
        setTripPickerVisible(true);
    };

    const handleConfirmAddToTrip = async (tripId: string, tripName: string) => {
        if (!selectedPOI) return;

        const savedTrip = await addStop(tripId, 0, {
            name: selectedPOI.name,
            placeId: selectedPOI.placeId,
            lat: selectedPOI.lat,
            lng: selectedPOI.lng,
            category: ['hotel', 'restaurant', 'landmark', 'activity', 'transport', 'other'].includes(selectedPOI.category)
                ? selectedPOI.category as any
                : 'other',
            address: selectedPOI.address || undefined,
            rating: selectedPOI.rating || undefined,
            photo: selectedPOI.photo || undefined,
            order: 0,
        });

        if (savedTrip) {
            setTripPickerVisible(false);
            setSelectedPOI(null);
            showMessage(`${selectedPOI.name} added to ${tripName}`);
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
            if (!supported) {
                showMessage('Could not open map link for this place.');
                return;
            }
            await Linking.openURL(url);
        } catch (error) {
            console.error('Open source link error:', error);
            showMessage('Could not open map link for this place.');
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

                {item.address && (
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }} numberOfLines={2}>
                        {item.address}
                    </Text>
                )}

                <View style={styles.poiActions}>
                    <Chip
                        compact
                        mode="flat"
                        style={styles.sourceChip}
                        textStyle={{ fontSize: 10 }}
                        onPress={() => openSource(item)}
                        icon={item.source === 'google_places' ? 'google-maps' : 'map'}
                    >
                        {item.source === 'google_places' ? 'Google' : 'OSM'}
                    </Chip>
                    <Button
                        mode="contained-tonal"
                        compact
                        onPress={() => handleAddToTrip(item)}
                        icon="plus"
                        labelStyle={{ fontSize: 12 }}
                    >
                        Add to Trip
                    </Button>
                </View>
            </Card.Content>
        </Card>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {/* Search Bar */}
            <View style={styles.searchSection}>
                <Searchbar
                    placeholder="Search places..."
                    value={query}
                    onChangeText={setQuery}
                    onSubmitEditing={searchPOI}
                    style={[styles.searchbar, { backgroundColor: theme.colors.surfaceVariant }]}
                    inputStyle={{ fontSize: 15 }}
                />

                {/* Location inputs */}
                <View style={styles.locationRow}>
                    <Surface style={[styles.locationInput, { backgroundColor: theme.colors.surfaceVariant }]} elevation={0}>
                        <MaterialCommunityIcons name="latitude" size={16} color={theme.colors.onSurfaceVariant} />
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginLeft: 4 }}>
                            {lat}, {lng}
                        </Text>
                    </Surface>
                    <Button mode="contained" compact onPress={searchPOI} icon="magnify" labelStyle={{ fontSize: 13 }}>
                        Search
                    </Button>
                </View>

                {/* Category Chips */}
                <View style={styles.categoryRow}>
                    {CATEGORIES.map((cat) => (
                        <Chip
                            key={cat}
                            selected={selectedCategory === cat}
                            onPress={() => handleCategoryPress(cat)}
                            mode="flat"
                            style={[
                                styles.catChip,
                                selectedCategory === cat && { backgroundColor: CategoryColors[cat] + '30' },
                            ]}
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
            </View>

            {/* Results */}
            {loading && !refreshing ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>
                        Searching places...
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={results}
                    keyExtractor={(item) => item.id}
                    renderItem={renderPOICard}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={[theme.colors.primary]}
                            tintColor={theme.colors.primary}
                        />
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
            )}

            <Portal>
                <Modal
                    visible={tripPickerVisible}
                    onDismiss={() => {
                        setTripPickerVisible(false);
                        setSelectedPOI(null);
                    }}
                    contentContainerStyle={[styles.tripModal, { backgroundColor: theme.colors.surface }]}
                >
                    <Text variant="titleMedium" style={{ fontWeight: '700', color: theme.colors.onSurface, marginBottom: 8 }}>
                        Add to Trip
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12 }}>
                        {selectedPOI ? `Choose trip for "${selectedPOI.name}"` : 'Choose a trip'}
                    </Text>

                    {trips.slice(0, 8).map((trip) => (
                        <Button
                            key={trip._id}
                            mode="outlined"
                            style={styles.tripChoiceButton}
                            contentStyle={{ justifyContent: 'flex-start' }}
                            onPress={() => handleConfirmAddToTrip(trip._id, trip.name)}
                        >
                            {trip.name}
                        </Button>
                    ))}

                    <Button
                        mode="text"
                        onPress={() => {
                            setTripPickerVisible(false);
                            setSelectedPOI(null);
                        }}
                        style={{ marginTop: 4 }}
                    >
                        Cancel
                    </Button>
                </Modal>
            </Portal>

            <Snackbar
                visible={snackbarVisible}
                onDismiss={() => setSnackbarVisible(false)}
                duration={2500}
            >
                {snackbarMessage}
            </Snackbar>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    searchSection: { padding: 16, gap: 12 },
    searchbar: { borderRadius: 12, elevation: 0 },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    locationInput: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
    categoryRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    catChip: { borderRadius: 20 },
    list: { padding: 16, paddingTop: 0 },
    poiCard: { marginBottom: 12, borderRadius: 14, overflow: 'hidden' },
    poiImage: { height: 140 },
    poiContent: { padding: 12 },
    poiHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    categoryBadge: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    ratingContainer: { flexDirection: 'row', alignItems: 'center' },
    poiActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
    sourceChip: { height: 24 },
    tripModal: { margin: 20, padding: 18, borderRadius: 14 },
    tripChoiceButton: { marginBottom: 8, borderRadius: 10 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyContainer: { alignItems: 'center', paddingTop: 60 },
});
