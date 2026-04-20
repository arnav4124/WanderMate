import React, { useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text, Card, FAB, useTheme, Chip } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useTripStore } from '@/stores/tripStore';
import { useAuthStore } from '@/stores/authStore';
import { Trip } from '@/types';

function TripCard({ trip, onPress }: { trip: Trip; onPress: () => void }) {
  const theme = useTheme();
  const dayCount = Math.ceil(
    (new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / (1000 * 60 * 60 * 24)
  ) + 1;
  const stopCount = trip.days?.reduce((sum, d) => sum + (d.stops?.length || 0), 0) || 0;

  const statusColor = trip.status === 'active'
    ? theme.colors.secondary
    : trip.status === 'completed'
      ? '#8E8E93'
      : theme.colors.primary;

  return (
    <Card style={[styles.tripCard, { backgroundColor: theme.colors.surface }]} onPress={onPress} mode="elevated">
      {trip.coverImage ? (
        <Card.Cover source={{ uri: trip.coverImage }} style={styles.cardCover} />
      ) : (
        <View style={[styles.cardCoverPlaceholder, { backgroundColor: theme.colors.primaryContainer }]}>
          <MaterialCommunityIcons name="earth" size={56} color={theme.colors.primary} />
        </View>
      )}
      <Card.Content style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text variant="titleMedium" style={[styles.tripTitle, { color: theme.colors.onSurface }]} numberOfLines={1}>
            {trip.name}
          </Text>
          <Chip
            mode="flat"
            compact
            textStyle={{ fontSize: 11, color: statusColor }}
            style={[styles.statusChip, { backgroundColor: `${statusColor}18` }]}
          >
            {trip.status}
          </Chip>
        </View>

        <View style={styles.cardRow}>
          <MaterialCommunityIcons name="map-marker" size={16} color={theme.colors.onSurfaceVariant} />
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginLeft: 4 }}>
            {trip.destination}
          </Text>
        </View>

        <View style={styles.cardStats}>
          <View style={styles.stat}>
            <MaterialCommunityIcons name="calendar-range" size={14} color={theme.colors.primary} />
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginLeft: 4 }}>
              {format(new Date(trip.startDate), 'MMM d')} - {format(new Date(trip.endDate), 'MMM d, yyyy')}
            </Text>
          </View>
          <View style={styles.stat}>
            <MaterialCommunityIcons name="clock-outline" size={14} color={theme.colors.secondary} />
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginLeft: 4 }}>
              {dayCount} days
            </Text>
          </View>
          <View style={styles.stat}>
            <MaterialCommunityIcons name="map-marker-multiple" size={14} color={theme.colors.tertiary} />
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginLeft: 4 }}>
              {stopCount} stops
            </Text>
          </View>
        </View>

        {trip.collaborators.length > 0 && (
          <View style={styles.collaborators}>
            <MaterialCommunityIcons name="account-group" size={14} color={theme.colors.onSurfaceVariant} />
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginLeft: 4 }}>
              {trip.collaborators.length + 1} travelers
            </Text>
          </View>
        )}
      </Card.Content>
    </Card>
  );
}

export default function TripsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { trips, isLoading, fetchTrips } = useTripStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchTrips();
  }, [isAuthenticated, fetchTrips]);

  const onRefresh = useCallback(() => {
    if (!isAuthenticated) return;
    fetchTrips();
  }, [isAuthenticated, fetchTrips]);

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="airplane-takeoff" size={80} color={theme.colors.primary} style={{ opacity: 0.5 }} />
      <Text variant="titleLarge" style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
        No trips yet
      </Text>
      <Text variant="bodyMedium" style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
        Tap the + button to plan your first adventure!
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={trips}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <TripCard
            trip={item}
            onPress={() => router.push(`/trip/${item._id}`)}
          />
        )}
        contentContainerStyle={[
          styles.list,
          trips.length === 0 && styles.emptyList,
        ]}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={onRefresh} colors={[theme.colors.primary]} />
        }
        ListEmptyComponent={!isLoading ? renderEmpty : null}
        showsVerticalScrollIndicator={false}
      />
      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color={theme.colors.onPrimary}
        onPress={() => router.push('/trip/create')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, paddingBottom: 80 },
  emptyList: { flex: 1 },
  tripCard: { marginBottom: 16, borderRadius: 16, overflow: 'hidden' },
  cardCover: { height: 160 },
  cardCoverPlaceholder: { height: 160, justifyContent: 'center', alignItems: 'center' },
  cardContent: { padding: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  tripTitle: { fontWeight: '700', flex: 1, marginRight: 8 },
  statusChip: { height: 26 },
  cardRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cardStats: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  stat: { flexDirection: 'row', alignItems: 'center' },
  collaborators: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyTitle: { fontWeight: '700', marginTop: 16 },
  emptyText: { textAlign: 'center', marginTop: 8 },
  fab: { position: 'absolute', right: 20, bottom: 20, borderRadius: 16 },
});
