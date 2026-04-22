import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Button, Chip, IconButton, TextInput, useTheme } from 'react-native-paper';
import BottomSheet, { BottomSheetView, BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { Trip, Day, Stop } from '@/types';
import { CategoryColors } from '@/constants/theme';
import { useRouter } from 'expo-router';

interface ItineraryBottomSheetProps {
    sheetRef: React.RefObject<BottomSheet>;
    snapPoints: string[];
    activeTrip: Trip;
    activeDayIndex: number;
    setActiveDay: (index: number) => void;
    handleAddDay: () => void;
    handleDeleteDay: () => void;
    handleStopPress: (stop: Stop) => void;
    moveStop: (index: number, direction: 'up' | 'down') => void;
    removeStop: (tripId: string, dayIndex: number, stopId: string) => void;
    expandedStopId: string | null;
    handleExpandStop: (stop: Stop) => void;
    editTime: string;
    setEditTime: (time: string) => void;
    editDuration: string;
    setEditDuration: (duration: string) => void;
    editCost: string;
    setEditCost: (cost: string) => void;
    editNotes: string;
    setEditNotes: (notes: string) => void;
    handleSaveStopDetails: (stop: Stop) => void;
}

export function ItineraryBottomSheet({
    sheetRef,
    snapPoints,
    activeTrip,
    activeDayIndex,
    setActiveDay,
    handleAddDay,
    handleDeleteDay,
    handleStopPress,
    moveStop,
    removeStop,
    expandedStopId,
    handleExpandStop,
    editTime,
    setEditTime,
    editDuration,
    setEditDuration,
    editCost,
    setEditCost,
    editNotes,
    setEditNotes,
    handleSaveStopDetails
}: ItineraryBottomSheetProps) {
    const theme = useTheme();
    const router = useRouter();

    return (
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
                <BottomSheetFlatList
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
                data={activeTrip.days[activeDayIndex]?.stops ? [...activeTrip.days[activeDayIndex].stops].sort((a, b) => a.order - b.order) : []}
                keyExtractor={(item, index) => item._id || index.toString()}
                contentContainerStyle={styles.sheetList}
                renderItem={({ item, index }) => (
                    <View style={styles.stopItemContainer}>
                        <View style={styles.stopItem}>
                            <TouchableOpacity
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}
                                onPress={() => handleStopPress(item)}
                            >
                                <View style={[styles.stopNumber, { backgroundColor: CategoryColors[item.category] || theme.colors.primary }]}>
                                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{index + 1}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text variant="bodyMedium" style={{ fontWeight: '600' }} numberOfLines={1}>{item.name}</Text>
                                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, textTransform: 'capitalize' }}>{item.category}</Text>
                                </View>
                            </TouchableOpacity>
                            <View style={styles.stopControls}>
                                <IconButton
                                    icon={expandedStopId === item._id ? "chevron-up" : "chevron-down"}
                                    size={20}
                                    onPress={() => handleExpandStop(item)}
                                    style={{ margin: 0, marginRight: -4 }}
                                />
                                <View style={styles.moveButtons}>
                                    <IconButton
                                        icon="menu-up"
                                        size={20}
                                        disabled={index === 0}
                                        onPress={() => moveStop(index, 'up')}
                                        style={styles.tightIcon}
                                    />
                                    <IconButton
                                        icon="menu-down"
                                        size={20}
                                        disabled={index === ((activeTrip.days[activeDayIndex]?.stops.length || 0) - 1)}
                                        onPress={() => moveStop(index, 'down')}
                                        style={styles.tightIcon}
                                    />
                                </View>
                                <IconButton
                                    icon="delete-outline"
                                    iconColor={theme.colors.error}
                                    size={20}
                                    onPress={() => item._id && removeStop(activeTrip._id, activeDayIndex, item._id)}
                                    style={{ margin: 0 }}
                                />
                            </View>
                        </View>
                        {expandedStopId === item._id && (
                            <View style={styles.expandedContent}>
                                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                                    <TextInput
                                        label="Arrival (e.g. 10:00 AM)"
                                        value={editTime}
                                        onChangeText={setEditTime}
                                        mode="outlined"
                                        style={{ flex: 1, backgroundColor: theme.colors.surface }}
                                        dense
                                    />
                                    <TextInput
                                        label="Duration (mins)"
                                        value={editDuration}
                                        onChangeText={setEditDuration}
                                        keyboardType="numeric"
                                        mode="outlined"
                                        style={{ flex: 1, backgroundColor: theme.colors.surface }}
                                        dense
                                    />
                                </View>
                                <TextInput
                                    label="Estimated Cost ($)"
                                    value={editCost}
                                    onChangeText={setEditCost}
                                    keyboardType="decimal-pad"
                                    mode="outlined"
                                    style={{ marginBottom: 12, backgroundColor: theme.colors.surface }}
                                    dense
                                />
                                <TextInput
                                    label="Notes (Optional)"
                                    value={editNotes}
                                    onChangeText={setEditNotes}
                                    mode="outlined"
                                    multiline
                                    numberOfLines={2}
                                    style={{ marginBottom: 12, backgroundColor: theme.colors.surface }}
                                    dense
                                />
                                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                                    <Button mode="text" onPress={() => handleExpandStop(item)}>Cancel</Button>
                                    <Button mode="contained" onPress={() => handleSaveStopDetails(item)}>Save Details</Button>
                                </View>
                            </View>
                        )}
                    </View>
                )}
                ListEmptyComponent={
                    <View style={styles.emptyStops}>
                        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>No stops for this day yet.</Text>
                        <Button
                            mode="text"
                            icon="delete"
                            textColor={theme.colors.error}
                            onPress={handleDeleteDay}
                            style={{ marginTop: 12 }}
                        >
                            Delete Empty Day
                        </Button>
                    </View>
                }
            />
        </BottomSheet>
    );
}

const styles = StyleSheet.create({
    sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, paddingTop: 8 },
    dayTabs: { paddingHorizontal: 16, paddingBottom: 16 },
    sheetList: { paddingHorizontal: 16, paddingBottom: 24 },
    stopItemContainer: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ccc' },
    stopItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
    expandedContent: { paddingLeft: 48, paddingRight: 16, paddingBottom: 16 },
    stopNumber: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    stopControls: { flexDirection: 'row', alignItems: 'center' },
    moveButtons: { flexDirection: 'column', marginRight: -8 },
    tightIcon: { margin: -6, width: 24, height: 24 },
    emptyStops: { padding: 24, alignItems: 'center' },
});
