import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import {
    Text, useTheme, Appbar, Surface, Button, IconButton, FAB, Portal, Modal,
    TextInput, Chip, Menu, Divider,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { format } from 'date-fns';
import DraggableFlatList, { ScaleDecorator, RenderItemParams } from 'react-native-draggable-flatlist';
import * as Location from 'expo-location';
import { useTripStore } from '@/stores/tripStore';
import { useFeedStore } from '@/stores/feedStore';
import { CategoryColors, CategoryIcons } from '@/constants/theme';
import { Stop } from '@/types';

export default function TripDetailScreen() {
    const theme = useTheme();
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const {
        currentTrip, isLoading, fetchTrip, updateTrip, deleteTrip,
        addStop, removeStop, reorderStops, addCollaborator,
        undo, redo, undoStack, redoStack, subscribeTripUpdates,
    } = useTripStore();
    const { publishTrip } = useFeedStore();

    const [selectedDay, setSelectedDay] = useState(0);
    const [showAddStop, setShowAddStop] = useState(false);
    const [showInvite, setShowInvite] = useState(false);
    const [stopName, setStopName] = useState('');
    const [stopLat, setStopLat] = useState('');
    const [stopLng, setStopLng] = useState('');
    const [stopCategory, setStopCategory] = useState('other');
    const [stopNotes, setStopNotes] = useState('');
    const [manualCoordinates, setManualCoordinates] = useState(false);
    const [addingStop, setAddingStop] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [menuVisible, setMenuVisible] = useState(false);

    useEffect(() => {
        if (id) {
            fetchTrip(id);
            const unsub = subscribeTripUpdates(id);
            return unsub;
        }
    }, [id]);

    const handleAddStop = async () => {
        if (!id) return;

        const trimmedName = stopName.trim();
        if (!trimmedName) {
            Alert.alert('Missing Name', 'Please enter a stop name.');
            return;
        }

        let lat: number | null = null;
        let lng: number | null = null;
        const usingManualCoordinates = manualCoordinates || stopLat.trim().length > 0 || stopLng.trim().length > 0;

        if (usingManualCoordinates) {
            if (!stopLat.trim() || !stopLng.trim()) {
                Alert.alert('Coordinates Required', 'Enter both latitude and longitude, or turn off manual coordinates.');
                return;
            }

            const parsedLat = parseFloat(stopLat);
            const parsedLng = parseFloat(stopLng);
            if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
                Alert.alert('Invalid Coordinates', 'Please enter valid numeric latitude and longitude values.');
                return;
            }

            lat = parsedLat;
            lng = parsedLng;
        } else {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert(
                        'Location Permission Needed',
                        'Allow location access to auto-fill coordinates, or enable manual coordinates in this form.'
                    );
                    return;
                }

                const loc = await Location.getCurrentPositionAsync({});
                lat = loc.coords.latitude;
                lng = loc.coords.longitude;
            } catch (error) {
                console.error('Could not fetch current location for stop:', error);
                Alert.alert('Location Error', 'Could not get your current location. Enable manual coordinates and try again.');
                return;
            }
        }

        setAddingStop(true);
        const updatedTrip = await addStop(id, selectedDay, {
            name: trimmedName,
            lat,
            lng,
            category: stopCategory as any,
            notes: stopNotes || undefined,
            order: 0,
        });

        setAddingStop(false);
        if (!updatedTrip) {
            Alert.alert('Could Not Add Stop', 'The stop was not saved. Please try again.');
            return;
        }

        setShowAddStop(false);
        setStopName('');
        setStopLat('');
        setStopLng('');
        setStopNotes('');
        setStopCategory('other');
        setManualCoordinates(false);
        Alert.alert('Stop Added', `${trimmedName} was added to Day ${selectedDay + 1}.`);
    };

    const handleRemoveStop = (stopId: string) => {
        if (!id) return;
        Alert.alert('Remove Stop', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: () => removeStop(id, selectedDay, stopId) },
        ]);
    };

    const handleReorder = async (data: Stop[]) => {
        if (!id) return;
        const stopOrder = data.map(s => s._id!).filter(Boolean);
        await reorderStops(id, selectedDay, stopOrder);
    };

    const handlePublish = () => {
        if (!id) return;
        Alert.alert('Publish Trip', 'Share this trip on the social feed?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Publish',
                onPress: async () => {
                    await publishTrip(id);
                    Alert.alert('Published!', 'Your trip is now visible on the feed.');
                },
            },
        ]);
    };

    const handleDelete = () => {
        if (!id) return;
        Alert.alert('Delete Trip', 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    await deleteTrip(id);
                    router.replace('/(tabs)');
                },
            },
        ]);
    };

    const currentDay = currentTrip?.days?.[selectedDay];

    const renderStop = useCallback(({ item, drag, isActive }: RenderItemParams<Stop>) => (
        <ScaleDecorator>
            <TouchableOpacity
                onLongPress={drag}
                disabled={isActive}
                style={[
                    styles.stopItem,
                    {
                        backgroundColor: isActive ? theme.colors.primaryContainer : theme.colors.surface,
                        borderColor: isActive ? theme.colors.primary : theme.colors.outline,
                    },
                ]}
            >
                <View style={[styles.stopDot, { backgroundColor: CategoryColors[item.category] || '#95E1D3' }]}>
                    <MaterialCommunityIcons
                        name={(CategoryIcons[item.category] || 'map-marker') as any}
                        size={16}
                        color="#FFF"
                    />
                </View>
                <View style={styles.stopInfo}>
                    <Text variant="bodyLarge" style={{ fontWeight: '600', color: theme.colors.onSurface }}>
                        {item.name}
                    </Text>
                    {item.address && (
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }} numberOfLines={1}>
                            {item.address}
                        </Text>
                    )}
                    {item.notes && (
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, fontStyle: 'italic' }} numberOfLines={1}>
                            {item.notes}
                        </Text>
                    )}
                    <View style={styles.stopMeta}>
                        {item.rating && (
                            <View style={styles.ratingBadge}>
                                <MaterialCommunityIcons name="star" size={12} color="#FFD93D" />
                                <Text variant="bodySmall" style={{ marginLeft: 2, fontSize: 11 }}>{item.rating}</Text>
                            </View>
                        )}
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, textTransform: 'capitalize', fontSize: 11, marginRight: 8 }}>
                            {item.category}
                        </Text>
                    </View>
                    {(item.arrivalTime || item.duration || item.cost) && (
                        <View style={[styles.stopMeta, { marginTop: 4 }]}>
                            {item.arrivalTime && (
                                <Text variant="bodySmall" style={{ color: theme.colors.primary, fontSize: 11, marginRight: 8, fontWeight: '600' }}>
                                    🕒 {item.arrivalTime}
                                </Text>
                            )}
                            {item.duration && (
                                <Text variant="bodySmall" style={{ color: theme.colors.primary, fontSize: 11, marginRight: 8, fontWeight: '600' }}>
                                    ⏳ {item.duration} mins
                                </Text>
                            )}
                            {item.cost && (
                                <Text variant="bodySmall" style={{ color: '#4CAF50', fontSize: 11, fontWeight: '600' }}>
                                    💰 ${item.cost}
                                </Text>
                            )}
                        </View>
                    )}
                </View>
                <View style={styles.stopActions}>
                    <IconButton icon="drag" size={18} style={{ opacity: 0.5 }} />
                    <IconButton
                        icon="close"
                        size={16}
                        iconColor={theme.colors.error}
                        onPress={() => item._id && handleRemoveStop(item._id)}
                    />
                </View>
            </TouchableOpacity>
        </ScaleDecorator>
    ), [selectedDay, id, theme]);

    if (!currentTrip) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
                <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>Loading trip...</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {/* Header */}
            <Appbar.Header style={{ backgroundColor: theme.colors.surface }} elevated>
                <Appbar.BackAction onPress={() => router.back()} />
                <Appbar.Content title={currentTrip.name} titleStyle={{ fontWeight: '700' }} />
                <Appbar.Action icon="undo" onPress={undo} disabled={undoStack.length === 0} />
                <Appbar.Action icon="redo" onPress={redo} disabled={redoStack.length === 0} />
                <Menu
                    visible={menuVisible}
                    onDismiss={() => setMenuVisible(false)}
                    anchor={<Appbar.Action icon="dots-vertical" onPress={() => setMenuVisible(true)} />}
                >
                    <Menu.Item onPress={() => { setMenuVisible(false); router.push(`/trip/map/${id}`); }} title="View Map" leadingIcon="map" />
                    <Menu.Item onPress={() => { setMenuVisible(false); setShowInvite(true); }} title="Invite Collaborator" leadingIcon="account-plus" />
                    <Menu.Item onPress={() => { setMenuVisible(false); handlePublish(); }} title="Publish to Feed" leadingIcon="share" />
                    <Divider />
                    <Menu.Item onPress={() => { setMenuVisible(false); handleDelete(); }} title="Delete Trip" leadingIcon="delete" titleStyle={{ color: theme.colors.error }} />
                </Menu>
            </Appbar.Header>

            {/* Trip Info Bar */}
            <Surface style={[styles.infoBar, { backgroundColor: theme.colors.surfaceVariant }]} elevation={0}>
                <View style={styles.infoRow}>
                    <MaterialCommunityIcons name="map-marker" size={16} color={theme.colors.primary} />
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurface, marginLeft: 4, fontWeight: '600' }}>
                        {currentTrip.destination}
                    </Text>
                </View>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {format(new Date(currentTrip.startDate), 'MMM d')} - {format(new Date(currentTrip.endDate), 'MMM d, yyyy')}
                </Text>
            </Surface>

            {/* Day Selector */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.daySelector}>
                {currentTrip.days?.map((day, index) => (
                    <TouchableOpacity
                        key={index}
                        onPress={() => setSelectedDay(index)}
                        style={[
                            styles.dayChip,
                            {
                                backgroundColor: selectedDay === index ? theme.colors.primary : theme.colors.surface,
                                borderColor: theme.colors.outline,
                            },
                        ]}
                    >
                        <Text
                            variant="labelMedium"
                            style={{
                                color: selectedDay === index ? theme.colors.onPrimary : theme.colors.onSurface,
                                fontWeight: '700',
                            }}
                        >
                            Day {day.dayNumber}
                        </Text>
                        <Text
                            variant="bodySmall"
                            style={{
                                color: selectedDay === index ? theme.colors.onPrimary : theme.colors.onSurfaceVariant,
                                fontSize: 10,
                            }}
                        >
                            {format(new Date(day.date), 'MMM d')}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Stops List with Drag&Drop */}
            <View style={styles.stopsContainer}>
                {currentDay && currentDay.stops.length > 0 ? (
                    <DraggableFlatList
                        data={currentDay.stops}
                        keyExtractor={(item) => item._id || `${item.order}`}
                        renderItem={renderStop}
                        onDragEnd={({ data }) => handleReorder(data)}
                        contentContainerStyle={styles.stopsList}
                    />
                ) : (
                    <View style={styles.emptyDay}>
                        <MaterialCommunityIcons name="map-marker-plus" size={48} color={theme.colors.onSurfaceVariant} style={{ opacity: 0.4 }} />
                        <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>
                            No stops for this day
                        </Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            Add stops or search in the Explore tab
                        </Text>
                    </View>
                )}
            </View>

            <FAB
                icon="plus"
                style={[styles.fab, { backgroundColor: theme.colors.primary }]}
                color={theme.colors.onPrimary}
                onPress={() => setShowAddStop(true)}
            />

            {/* Add Stop Modal */}
            <Portal>
                <Modal visible={showAddStop} onDismiss={() => setShowAddStop(false)} contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}>
                    <Text variant="titleLarge" style={{ fontWeight: '700', marginBottom: 16, color: theme.colors.onSurface }}>
                        Add Stop
                    </Text>
                    <TextInput label="Place Name" value={stopName} onChangeText={setStopName} mode="outlined" style={styles.input} />
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 10 }}>
                        Coordinates are optional. We can auto-use your current location.
                    </Text>
                    <Button
                        mode={manualCoordinates ? 'contained-tonal' : 'outlined'}
                        compact
                        onPress={() => {
                            setManualCoordinates(!manualCoordinates);
                            if (manualCoordinates) {
                                setStopLat('');
                                setStopLng('');
                            }
                        }}
                        style={{ marginBottom: 10 }}
                        icon={manualCoordinates ? 'crosshairs-gps' : 'map-marker-edit'}
                    >
                        {manualCoordinates ? 'Using Manual Coordinates' : 'Set Coordinates Manually'}
                    </Button>

                    {manualCoordinates && (
                        <View style={styles.coordRow}>
                            <TextInput label="Latitude" value={stopLat} onChangeText={setStopLat} mode="outlined" keyboardType="decimal-pad" style={[styles.input, { flex: 1 }]} />
                            <TextInput label="Longitude" value={stopLng} onChangeText={setStopLng} mode="outlined" keyboardType="decimal-pad" style={[styles.input, { flex: 1, marginLeft: 8 }]} />
                        </View>
                    )}
                    <TextInput label="Notes (optional)" value={stopNotes} onChangeText={setStopNotes} mode="outlined" style={styles.input} multiline />

                    <View style={styles.categoryPicker}>
                        {['hotel', 'restaurant', 'landmark', 'activity', 'other'].map((cat) => (
                            <Chip
                                key={cat}
                                selected={stopCategory === cat}
                                onPress={() => setStopCategory(cat)}
                                compact
                                mode={stopCategory === cat ? 'flat' : 'outlined'}
                                style={[styles.catChip, stopCategory === cat && { backgroundColor: (CategoryColors[cat] || '#95E1D3') + '30' }]}
                            >
                                {cat}
                            </Chip>
                        ))}
                    </View>

                    <Button mode="contained" onPress={handleAddStop} style={styles.addButton} disabled={!stopName.trim() || addingStop} loading={addingStop}>
                        Add Stop
                    </Button>
                </Modal>
            </Portal>

            {/* Invite Collaborator Modal */}
            <Portal>
                <Modal visible={showInvite} onDismiss={() => setShowInvite(false)} contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}>
                    <Text variant="titleLarge" style={{ fontWeight: '700', marginBottom: 16, color: theme.colors.onSurface }}>
                        Invite Collaborator
                    </Text>
                    <TextInput label="User ID or Email" value={inviteEmail} onChangeText={setInviteEmail} mode="outlined" style={styles.input} />
                    <Button
                        mode="contained"
                        onPress={async () => {
                            if (id && inviteEmail) {
                                await addCollaborator(id, inviteEmail.trim());
                                setShowInvite(false);
                                setInviteEmail('');
                                Alert.alert('Invited!', 'Collaborator has been added.');
                            }
                        }}
                        style={styles.addButton}
                        disabled={!inviteEmail}
                    >
                        Send Invite
                    </Button>
                </Modal>
            </Portal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    infoBar: { paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    infoRow: { flexDirection: 'row', alignItems: 'center' },
    daySelector: { maxHeight: 64, paddingHorizontal: 12, paddingVertical: 8, flexGrow: 0 },
    dayChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, marginHorizontal: 4, alignItems: 'center', borderWidth: 1 },
    stopsContainer: { flex: 1 },
    stopsList: { padding: 16, paddingBottom: 80 },
    stopItem: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1 },
    stopDot: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    stopInfo: { flex: 1 },
    stopMeta: { flexDirection: 'row', gap: 8, marginTop: 4 },
    ratingBadge: { flexDirection: 'row', alignItems: 'center' },
    stopActions: { flexDirection: 'row', alignItems: 'center' },
    emptyDay: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
    fab: { position: 'absolute', right: 20, bottom: 20, borderRadius: 16 },
    modal: { margin: 20, padding: 24, borderRadius: 20 },
    input: { marginBottom: 12 },
    coordRow: { flexDirection: 'row' },
    categoryPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
    catChip: {},
    addButton: { borderRadius: 12, marginTop: 4 },
});
