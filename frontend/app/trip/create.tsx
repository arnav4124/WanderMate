import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';
import { Text, TextInput, Button, useTheme, Surface } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTripStore } from '@/stores/tripStore';
import { format } from 'date-fns';

export default function CreateTripScreen() {
    const theme = useTheme();
    const router = useRouter();
    const { createTrip } = useTripStore();

    const [name, setName] = useState('');
    const [destination, setDestination] = useState('');
    const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleCreate = async () => {
        if (!name.trim()) { setError('Please enter a trip name'); return; }
        if (!destination.trim()) { setError('Please enter a destination'); return; }
        if (!startDate || !endDate) { setError('Please set trip dates'); return; }

        const start = new Date(startDate);
        const end = new Date(endDate);
        if (end < start) { setError('End date must be after start date'); return; }

        setLoading(true);
        setError('');

        const trip = await createTrip({
            name: name.trim(),
            destination: destination.trim(),
            startDate: start.toISOString(),
            endDate: end.toISOString(),
        });

        setLoading(false);

        if (trip) {
            router.replace(`/trip/${trip._id}`);
        } else {
            setError('Failed to create trip. It will sync when online.');
            router.back();
        }
    };

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: theme.colors.background }]}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
        >
            <View style={[styles.iconContainer, { backgroundColor: theme.colors.primaryContainer }]}>
                <MaterialCommunityIcons name="airplane-takeoff" size={40} color={theme.colors.primary} />
            </View>

            <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onSurface }]}>
                Plan a New Trip
            </Text>
            <Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
                Where are you heading next?
            </Text>

            <Surface style={[styles.formCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
                <TextInput
                    label="Trip Name"
                    value={name}
                    onChangeText={setName}
                    mode="outlined"
                    placeholder="e.g., Summer in Paris"
                    left={<TextInput.Icon icon="tag-outline" />}
                    style={styles.input}
                />

                <TextInput
                    label="Destination"
                    value={destination}
                    onChangeText={setDestination}
                    mode="outlined"
                    placeholder="e.g., Paris, France"
                    left={<TextInput.Icon icon="map-marker-outline" />}
                    style={styles.input}
                />

                <TextInput
                    label="Start Date (YYYY-MM-DD)"
                    value={startDate}
                    onChangeText={setStartDate}
                    mode="outlined"
                    left={<TextInput.Icon icon="calendar-start" />}
                    style={styles.input}
                />

                <TextInput
                    label="End Date (YYYY-MM-DD)"
                    value={endDate}
                    onChangeText={setEndDate}
                    mode="outlined"
                    left={<TextInput.Icon icon="calendar-end" />}
                    style={styles.input}
                />

                {error ? (
                    <Text style={[styles.error, { color: theme.colors.error }]}>{error}</Text>
                ) : null}

                <Button
                    mode="contained"
                    onPress={handleCreate}
                    loading={loading}
                    disabled={loading}
                    style={styles.createButton}
                    contentStyle={styles.buttonContent}
                    icon="plus"
                >
                    Create Trip
                </Button>
            </Surface>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 24, alignItems: 'center' },
    iconContainer: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
    title: { fontWeight: '700', marginTop: 16 },
    subtitle: { marginTop: 4, marginBottom: 24 },
    formCard: { width: '100%', borderRadius: 20, padding: 20 },
    input: { marginBottom: 12 },
    error: { textAlign: 'center', marginBottom: 8, fontSize: 13 },
    createButton: { marginTop: 8, borderRadius: 12 },
    buttonContent: { paddingVertical: 4 },
});
