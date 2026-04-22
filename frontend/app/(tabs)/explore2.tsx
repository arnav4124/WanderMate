import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Linking } from 'react-native';
import { Text, useTheme, ActivityIndicator, Snackbar } from 'react-native-paper';
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

    const { lat, lng } = useLocation();
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
    }, [navigation, activeTrip]);

    useEffect(() => {
        if (activeTrip?.days?.[activeDayIndex]?.stops?.length && activeTrip.days[activeDayIndex].stops.length >= 2) {
            computeRoute();
        } else {
            setRouteData(null);
        }
    }, [activeDayIndex, activeTrip]);

    const computeRoute = async () => {
        const day = activeTrip?.days?.[activeDayIndex];
        if (!day || day.stops.length < 2) return;
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
            category: ['hotel', 'restaurant', 'landmark', 'activity', 'transport', 'other'].includes(poi.category) ? poi.category as any : 'other',
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
        if (currentDay.stops.length > 0) return;
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

    const handleMapMessage = (event: any) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'PIN_CLICK' && data.id) {
                const poi = results.find(r => r.id === data.id);
                if (poi) setSelectedPOI(poi);
            } else if (data.type === 'STOP_CLICK' && data.stop) {
                setSelectedPOI({ id: data.stop.id || data.stop._id || data.stop.name, placeId: data.stop.placeId, name: data.stop.name, lat: data.stop.lat, lng: data.stop.lng, category: data.stop.category, photo: data.stop.photo, rating: data.stop.rating, address: data.stop.address, openingHours: data.stop.openingHours, priceLevel: data.stop.priceLevel } as POI);
            }
        } catch (e) {
            console.error("Failed to parse map message", e);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <SearchBarSection
                query={query} setQuery={setQuery}
                onSearch={() => runSearch(lat, lng, undefined, false, showMessage)}
                mode={mode} setMode={setMode}
                selectedCategory={selectedCategory}
                onCategoryPress={(cat) => {
                    const nextCat = selectedCategory === cat ? null : cat;
                    setSelectedCategory(nextCat);
                    setQuery('');
                    if (nextCat) runSearch(lat, lng, nextCat, false, showMessage);
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
                        renderItem={({ item }) => <POICard poi={item} onAdd={handleAddToTrip} onMap={(p) => { setMode('map'); setSelectedPOI(p); }} />}
                        contentContainerStyle={styles.list}
                        showsVerticalScrollIndicator={false}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => runSearch(lat, lng, undefined, true, showMessage)} colors={[theme.colors.primary]} />}
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
                            lat={lat} lng={lng}
                            dayStops={activeTrip?.days?.[activeDayIndex]?.stops || []}
                            selectedPOI={selectedPOI}
                            routeData={routeData}
                            onMapMessage={handleMapMessage}
                        />
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
                    sheetRef={sheetRef}
                    snapPoints={snapPoints}
                    activeTrip={activeTrip as any}
                    activeDayIndex={activeDayIndex}
                    setActiveDay={setActiveDay}
                    handleAddDay={handleAddDay}
                    handleDeleteDay={handleDeleteDay}
                    handleStopPress={(stop) => {
                        setMode('map');
                        setSelectedPOI({ id: stop._id || stop.name, placeId: stop.placeId, name: stop.name, lat: stop.lat, lng: stop.lng, category: stop.category as any, photo: stop.photo, rating: stop.rating, address: stop.address, openingHours: stop.openingHours, priceLevel: stop.priceLevel } as POI);
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
