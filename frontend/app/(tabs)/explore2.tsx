import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Linking } from 'react-native';
import { Text, useTheme, ActivityIndicator, Snackbar, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import BottomSheet from '@gorhom/bottom-sheet';
import { useRouter, useNavigation } from 'expo-router';

import api from '@/services/api';
import { POI, Day, Stop } from '@/types';
import { useTripStore } from '@/stores/tripStore';
import { useBudgetStore } from '@/stores/budgetStore';
import { useAuthStore } from '@/stores/authStore';
import { useActiveTripStore } from '@/stores/activeTripStore';

import { useLocation } from '@/hooks/useLocation';
import { usePOISearch } from '@/hooks/usePOISearch';
import { SearchBarSection } from '@/components/explore/SearchBarSection';
import { POICard } from '@/components/explore/POICard';
import { ExploreMapView } from '@/components/explore/MapView';
import { ItineraryBottomSheet } from '@/components/explore/ItineraryBottomSheet';

export default function ExploreScreenV2() {
    const theme = useTheme();
    const navigation = useNavigation();
    const { trips, fetchTrips, addStop, updateTrip, removeStop, reorderStops, updateStop } = useTripStore();
    const { addExpense, updateExpense } = useBudgetStore();
    const { activeTripId, activeDayIndex, setActiveDay } = useActiveTripStore();
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

    const location = useLocation();
    const [mapLat, setMapLat] = useState(location.lat || '17.3616');
    const [mapLng, setMapLng] = useState(location.lng || '78.4747');
    const [mapCenterTick, setMapCenterTick] = useState(0); // Force map re-center
    const [viewMode, setViewMode] = useState<'itinerary' | 'discover'>('itinerary');
    const [mapMoved, setMapMoved] = useState(false);
    const searchCenterRef = useRef({ lat: mapLat, lng: mapLng, zoom: 13 });

    useEffect(() => {
        if (location.lat && location.lat !== '17.3616' && mapLat === '17.3616') {
            setMapLat(location.lat);
            setMapLng(location.lng);
        }
    }, [location.lat, location.lng]);
    const { query, setQuery, results, loading, refreshing, selectedCategory, setSelectedCategory, runSearch } = usePOISearch();

    const [mode, setMode] = useState<'list' | 'map'>('list');
    const [selectedPOI, setSelectedPOI] = useState<POI | null>(null);
    const [routeData, setRouteData] = useState<any>(null);
    const [expandedStopId, setExpandedStopId] = useState<string | null>(null);
    const [editTime, setEditTime] = useState('');
    const [editDuration, setEditDuration] = useState('');
    const [editCost, setEditCost] = useState('');
    const [editNotes, setEditNotes] = useState('');
    const [snackbarVisible, setSnackbarVisible] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');

    const sheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ['10%', '45%', '90%'], []);
    const activeTrip = useMemo(() => trips.find(t => t._id === activeTripId), [trips, activeTripId]);

    const showMessage = useCallback((message: string) => {
        setSnackbarMessage(message);
        setSnackbarVisible(true);
    }, []);

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
    }, [navigation, activeTrip?.name]);

    useEffect(() => {
        if (!activeTrip) return;

        const updateLocation = async () => {
            let initialLat: string | null = null;
            let initialLng: string | null = null;

            const allStops = activeTrip.days?.flatMap(d => d.stops) || [];
            if (allStops.length > 0) {
                initialLat = allStops[0].lat.toString();
                initialLng = allStops[0].lng.toString();
            } else if (activeTrip.destination) {
                try {
                    const { data } = await api.get('/poi/geocode', { params: { q: activeTrip.destination } });
                    if (data && data.length > 0) {
                        initialLat = data[0].lat.toString();
                        initialLng = data[0].lng.toString();
                    }
                } catch (e) {
                    console.error('Failed to geocode trip destination');
                }
            }

            if (initialLat && initialLng) {
                setMapLat(initialLat);
                setMapLng(initialLng);
                searchCenterRef.current = { lat: initialLat, lng: initialLng, zoom: 13 };
                setMapMoved(false);
                setMode('map');
                setMapCenterTick(prev => prev + 1); // Force map re-render center
            }
        };

        updateLocation();
    }, [activeTrip?._id]); // Only runs when a different trip becomes active

    useEffect(() => {
        if (activeTrip?.days?.[activeDayIndex]?.stops?.length && activeTrip.days[activeDayIndex].stops.length >= 2) {
            computeRoute();
        } else {
            setRouteData(null);
        }
    }, [activeDayIndex, activeTrip]);

    const computeRoute = async () => {
        const day = activeTrip?.days?.[activeDayIndex];
        if (!day || !day.stops || day.stops.length < 2) return;
        try {
            const coordinates = [...day.stops].sort((a, b) => a.order - b.order).map(s => ({ lat: s.lat, lng: s.lng }));
            const response = await api.post('/routes/optimize', { coordinates });
            setRouteData(response.data);
        } catch (error) {
            console.error('Route error:', error);
        }
    };

    const handleAddToTrip = async (poi: POI) => {
        if (!activeTrip) {
            showMessage('Please select an active trip from the Home tab first.');
            return;
        }
        const savedTrip = await addStop(activeTrip._id, activeDayIndex, {
            name: poi.name, placeId: poi.placeId, lat: poi.lat, lng: poi.lng,
            category: ['hotel', 'restaurant', 'landmark', 'activity', 'transport', 'shopping', 'museum', 'park', 'nightlife', 'medical', 'grocery', 'finance', 'other'].includes(poi.category) ? poi.category as any : 'other',
            address: poi.address, rating: poi.rating, photo: poi.photo, order: 0,
        });
        if (savedTrip) {
            showMessage(`${poi.name} added to ${activeTrip.name} (Day ${activeDayIndex + 1})`);
            sheetRef.current?.snapToIndex(1);
        } else {
            showMessage('Could not add stop to this trip. Please try again.');
        }
    };

    const openSource = useCallback(async (poi: POI) => {
        const url = poi.source === 'google_places'
            ? (poi.placeId ? `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(poi.placeId)}` : `https://www.google.com/maps/search/?api=1&query=${poi.lat},${poi.lng}`)
            : `https://www.openstreetmap.org/?mlat=${poi.lat}&mlon=${poi.lng}#map=16/${poi.lat}/${poi.lng}`;
        try {
            const supported = await Linking.canOpenURL(url);
            if (supported) await Linking.openURL(url);
            else showMessage('Could not open map link.');
        } catch (error) { console.error(error); }
    }, [showMessage]);

    const handleAddDay = async () => {
        if (!activeTrip) return;
        const newDayNumber = activeTrip.days.length + 1;
        const lastDay = activeTrip.days[activeTrip.days.length - 1];
        const newDate = lastDay ? new Date(lastDay.date) : new Date();
        if (lastDay) newDate.setDate(newDate.getDate() + 1);
        const newDays = [...activeTrip.days, { dayNumber: newDayNumber, date: newDate.toISOString(), stops: [] }];
        await updateTrip(activeTrip._id, { days: newDays });
        showMessage(`Day ${newDayNumber} added`);
        setActiveDay(newDays.length - 1);
    };

    const handleDeleteDay = async () => {
        if (!activeTrip) return;
        const currentDay = activeTrip.days[activeDayIndex];
        if (currentDay.stops && currentDay.stops.length > 0) {
            showMessage("Cannot delete a day with stops");
            return;
        }
        const newDays = activeTrip.days.filter((_, idx) => idx !== activeDayIndex).map((d, idx) => ({ ...d, dayNumber: idx + 1 }));
        await updateTrip(activeTrip._id, { days: newDays });
        showMessage(`Day ${currentDay.dayNumber} deleted`);
        setActiveDay(Math.max(0, activeDayIndex - 1));
    };

    const moveStop = async (index: number, direction: 'up' | 'down') => {
        if (!activeTrip) return;
        const day = activeTrip.days[activeDayIndex];
        const stops = [...day.stops].sort((a, b) => a.order - b.order);
        if (direction === 'up' && index > 0) {
            [stops[index - 1], stops[index]] = [stops[index], stops[index - 1]];
        } else if (direction === 'down' && index < stops.length - 1) {
            [stops[index + 1], stops[index]] = [stops[index], stops[index + 1]];
        } else return;
        await reorderStops(activeTrip._id, activeDayIndex, stops.map(s => s._id!));
    };

    const handleExpandStop = (stop: Stop) => {
        if (expandedStopId === stop._id) {
            setExpandedStopId(null);
        } else {
            setExpandedStopId(stop._id || null);
            setEditTime(stop.arrivalTime || '');
            setEditDuration(stop.duration ? stop.duration.toString() : '');
            setEditCost(stop.cost ? stop.cost.toString() : '');
            setEditNotes(stop.notes || '');
        }
    };

    const handleSaveStopDetails = async (stop: Stop) => {
        if (!activeTrip) return;
        let newExpenseId = stop.expenseId;
        const parsedCost = parseFloat(editCost);
        if (!isNaN(parsedCost) && parsedCost > 0) {
            const expMap: any = { hotel: 'accommodation', restaurant: 'food', transport: 'transport', activity: 'activities', landmark: 'activities', other: 'other' };
            const expCat = expMap[stop.category] || 'other';
            const expenseData = { description: stop.name, amount: parsedCost, category: expCat, date: activeTrip.days[activeDayIndex].date, dayNumber: activeTrip.days[activeDayIndex].dayNumber };
            if (newExpenseId) await updateExpense(activeTrip._id, newExpenseId, expenseData);
            else {
                const newExpense = await addExpense(activeTrip._id, expenseData);
                if (newExpense) newExpenseId = newExpense._id;
            }
        }
        const updates: Partial<Stop> = { arrivalTime: editTime, duration: editDuration ? parseInt(editDuration) : undefined, cost: !isNaN(parsedCost) ? parsedCost : undefined, notes: editNotes, expenseId: newExpenseId };
        if (stop._id) await updateStop(activeTrip._id, activeDayIndex, stop._id, updates);
        showMessage('Stop details saved');
        setExpandedStopId(null);
    };

    const handleSearchLocation = async () => {
        if (!query) return;
        
        // Disable implicit geocode hijack here to allow native POI list results sorted by distance.
        // Google will contextualize the query against mapLat / mapLng locally.
        setViewMode('discover');
        setSelectedCategory(null);
        
        await runSearch(mapLat, mapLng, null, false, showMessage);
    };

    const handleMapMessage = (event: any) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'REGION_CHANGE') {
                searchCenterRef.current = { lat: data.lat.toString(), lng: data.lng.toString(), zoom: data.zoom || 13 };
                setMapMoved(true);
            } else if (data.type === 'POI_CLICK' && data.poi) {
                setSelectedPOI(data.poi);
                setMapLat(data.poi.lat.toString());
                setMapLng(data.poi.lng.toString());
                    searchCenterRef.current = { lat: data.poi.lat.toString(), lng: data.poi.lng.toString(), zoom: Math.max(searchCenterRef.current?.zoom || 15, 15) };
            } else if (data.type === 'PIN_CLICK' && data.id) {
                const poi = results.find(r => r.id === data.id);
                if (poi) {
                    setSelectedPOI(poi);
                    setMapLat(poi.lat.toString());
                    setMapLng(poi.lng.toString());
                    searchCenterRef.current = { lat: poi.lat.toString(), lng: poi.lng.toString(), zoom: Math.max(searchCenterRef.current?.zoom || 15, 15) };
                }
            } else if (data.type === 'STOP_CLICK' && data.stop) {
                const stopPOI = { id: data.stop.id || data.stop._id || data.stop.name, placeId: data.stop.placeId, name: data.stop.name, lat: data.stop.lat, lng: data.stop.lng, category: data.stop.category, photo: data.stop.photo, rating: data.stop.rating, address: data.stop.address, openingHours: (data.stop as any).openingHours, priceLevel: (data.stop as any).priceLevel } as POI;
                setSelectedPOI(stopPOI);
                setMapLat(stopPOI.lat.toString()); setMapLng(stopPOI.lng.toString()); searchCenterRef.current = { lat: stopPOI.lat.toString(), lng: stopPOI.lng.toString(), zoom: Math.max(searchCenterRef.current?.zoom || 15, 15) };
            }
        } catch (e) {
            console.error("Failed to parse map message", e);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <SearchBarSection
                query={query} setQuery={setQuery}
                onSearch={handleSearchLocation}
                mode={mode} setMode={setMode}
                selectedCategory={selectedCategory}
                onCategoryPress={(cat) => {
                    const nextCat = selectedCategory === cat ? null : cat;
                    setSelectedCategory(nextCat);
                    setQuery('');
                    if (nextCat) runSearch(mapLat, mapLng, nextCat, false, showMessage);
                }}
            />

            <View style={styles.content}>
                {loading && !refreshing && mode === 'list' ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={theme.colors.primary} />
                        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>Searching places...</Text>
                    </View>
                ) : mode === 'list' ? (
                    <FlatList
                        data={results}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => <POICard poi={item} onAdd={handleAddToTrip} onMap={(p) => { setMode('map'); setSelectedPOI(p); setMapLat(p.lat.toString()); setMapLng(p.lng.toString()); searchCenterRef.current = { lat: p.lat.toString(), lng: p.lng.toString(), zoom: Math.max(searchCenterRef.current?.zoom || 15, 15) }; }} />}
                        contentContainerStyle={styles.list}
                        showsVerticalScrollIndicator={false}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => runSearch(mapLat, mapLng, undefined, true, showMessage)} colors={[theme.colors.primary]} />}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <MaterialCommunityIcons name="compass-outline" size={64} color={theme.colors.primary} style={{ opacity: 0.4 }} />
                                <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>Search for hotels, restaurants, or landmarks</Text>
                            </View>
                        }
                    />
                ) : (
                    <View style={{ flex: 1 }}>
                        <ExploreMapView
                            lat={searchCenterRef.current ? searchCenterRef.current.lat : mapLat} 
                            lng={searchCenterRef.current ? searchCenterRef.current.lng : mapLng}
                            zoom={searchCenterRef.current ? searchCenterRef.current.zoom : 13}
                            mapCenterTick={mapCenterTick}
                            viewMode={viewMode}
                            discoverPOIs={results}
                            dayStops={activeTrip?.days?.[activeDayIndex]?.stops || []}
                            selectedPOI={selectedPOI}
                            routeData={routeData}
                            onMapMessage={handleMapMessage}
                        />
                        <View style={{ position: 'absolute', top: 16, right: 16, backgroundColor: theme.colors.surface, borderRadius: 12, elevation: 4, flexDirection: 'row', overflow: 'hidden', zIndex: 10 }}>
                            <Button 
                                mode={viewMode === 'itinerary' ? 'contained' : 'text'} 
                                onPress={() => setViewMode('itinerary')}
                                compact
                                style={{ borderRadius: 0 }}
                            >Itinerary</Button>
                            <Button 
                                mode={viewMode === 'discover' ? 'contained' : 'text'} 
                                onPress={() => { 
                                    setViewMode('discover'); 
                                    if (results.length === 0) runSearch(searchCenterRef.current ? searchCenterRef.current.lat : mapLat, searchCenterRef.current ? searchCenterRef.current.lng : mapLng, selectedCategory, false, showMessage); 
                                }}
                                compact
                                style={{ borderRadius: 0 }}
                            >Discover</Button>
                        </View>
                        {mapMoved && viewMode === 'discover' && (
                             <Button 
                                mode="contained-tonal"
                                style={{ position: 'absolute', top: 60, alignSelf: 'center', zIndex: 10 }}
                                onPress={() => { setMapMoved(false); 
                                    setMapLat(searchCenterRef.current.lat); 
                                    setMapLng(searchCenterRef.current.lng);
                                    const activeCat = selectedCategory || (query ? null : 'landmark');
                                    if (!selectedCategory && !query) setSelectedCategory('landmark');
                                    runSearch(searchCenterRef.current.lat, searchCenterRef.current.lng, activeCat, false, showMessage); }}
                             >Search this area</Button>
                        )}
                        {selectedPOI && (
                            <View style={styles.miniCardContainer}>
                                <POICard
                                    poi={selectedPOI}
                                    isMini
                                    isAdded={activeTrip?.days?.[activeDayIndex]?.stops?.some(s => s.placeId === selectedPOI.placeId || s._id === selectedPOI.id)}
                                    onAdd={handleAddToTrip}
                                    onMoreDetails={openSource}
                                    onClose={() => setSelectedPOI(null)}
                                />
                            </View>
                        )}
                    </View>
                )}
            </View>

            {activeTrip && (
                <ItineraryBottomSheet
                    sheetRef={sheetRef as any}
                    snapPoints={snapPoints}
                    activeTrip={activeTrip as any}
                    activeDayIndex={activeDayIndex}
                    setActiveDay={setActiveDay}
                    handleAddDay={handleAddDay}
                    handleDeleteDay={handleDeleteDay}
                    handleStopPress={(stop) => {
                        setMode('map');
                        setViewMode('itinerary');
                        setSelectedPOI({ id: stop._id || stop.name, placeId: stop.placeId, name: stop.name, lat: stop.lat, lng: stop.lng, category: stop.category as any, photo: stop.photo, rating: stop.rating, address: stop.address, openingHours: (stop as any).openingHours, priceLevel: (stop as any).priceLevel } as POI);
                                                                                                setMapLat(stop.lat.toString());
                        setMapLng(stop.lng.toString());
                        searchCenterRef.current = { lat: stop.lat.toString(), lng: stop.lng.toString(), zoom: Math.max(searchCenterRef.current?.zoom || 15, 15) };
                        sheetRef.current?.snapToIndex(0);
                    }}
                    moveStop={moveStop}
                    removeStop={removeStop}
                    expandedStopId={expandedStopId}
                    handleExpandStop={handleExpandStop}
                    editTime={editTime} setEditTime={setEditTime}
                    editDuration={editDuration} setEditDuration={setEditDuration}
                    editCost={editCost} setEditCost={setEditCost}
                    editNotes={editNotes} setEditNotes={setEditNotes}
                    handleSaveStopDetails={handleSaveStopDetails as any}
                />
            )}

            <Snackbar visible={snackbarVisible} onDismiss={() => setSnackbarVisible(false)} duration={3000} style={{ bottom: 80 }}>
                {snackbarMessage}
            </Snackbar>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { flex: 1 },
    list: { padding: 16, paddingBottom: 100 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyContainer: { alignItems: 'center', paddingTop: 60 },
    miniCardContainer: { position: 'absolute', bottom: 100, left: 16, right: 16, zIndex: 20 },
});
