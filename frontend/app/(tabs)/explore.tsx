import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, FlatList, Alert } from 'react-native';
import { Text, Searchbar, Chip, Card, useTheme, Button, IconButton, Surface, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import api from '@/services/api';
import { POI } from '@/types';
import { useTripStore } from '@/stores/tripStore';
import { CategoryColors, CategoryIcons } from '@/constants/theme';

const CATEGORIES = ['hotel', 'restaurant', 'landmark', 'activity'] as const;

export default function ExploreScreen() {
    const theme = useTheme();
    const { trips, currentTrip, addStop } = useTripStore();
    const [query, setQuery] = useState('');
    const [lat, setLat] = useState('17.3616'); // Default: Hyderabad
    const [lng, setLng] = useState('78.4747');
    const [results, setResults] = useState<POI[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

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

    const searchPOI = useCallback(async () => {
        if (!query && !selectedCategory) return;
        setLoading(true);
        try {
            let response;
            if (selectedCategory) {
                response = await api.get(`/poi/category/${selectedCategory}`, {
                    params: { lat, lng, radius: 5000 },
                });
            } else {
                response = await api.get('/poi/search', {
                    params: { q: query, lat, lng, radius: 5000 },
                });
            }
            setResults(response.data);
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setLoading(false);
        }
    }, [query, lat, lng, selectedCategory]);

    const handleAddToTrip = (poi: POI) => {
        if (trips.length === 0) {
            Alert.alert('No Trips', 'Create a trip first to add places to it.');
            return;
        }

        // Show trip selection with day picker
        const tripOptions = trips.map(t => t.name);
        Alert.alert(
            'Add to Trip',
            `Add "${poi.name}" to which trip?`,
            [
                ...trips.slice(0, 5).map((trip) => ({
                    text: trip.name,
                    onPress: () => {
                        // Add to first day by default
                        addStop(trip._id, 0, {
                            name: poi.name,
                            placeId: poi.placeId,
                            lat: poi.lat,
                            lng: poi.lng,
                            category: poi.category as any,
                            address: poi.address || undefined,
                            rating: poi.rating || undefined,
                            photo: poi.photo || undefined,
                            order: 0,
                        });
                        Alert.alert('Added!', `${poi.name} added to ${trip.name}`);
                    },
                })),
                { text: 'Cancel', style: 'cancel' },
            ]
        );
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

                {item.address && (
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }} numberOfLines={2}>
                        {item.address}
                    </Text>
                )}

                <View style={styles.poiActions}>
                    <Chip compact mode="flat" style={styles.sourceChip} textStyle={{ fontSize: 10 }}>
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
                            onPress={() => {
                                setSelectedCategory(selectedCategory === cat ? null : cat);
                                setQuery('');
                            }}
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
            {loading ? (
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
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyContainer: { alignItems: 'center', paddingTop: 60 },
});
