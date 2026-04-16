import React from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, useTheme, Avatar, Button, Surface, Divider, List } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import { useTripStore } from '@/stores/tripStore';
import { syncQueue } from '@/services/syncQueue';

export default function ProfileScreen() {
    const theme = useTheme();
    const { firebaseUser, profile, signOut } = useAuthStore();
    const { trips } = useTripStore();

    const completedTrips = trips.filter(t => t.status === 'completed').length;
    const activeTrips = trips.filter(t => t.status === 'active' || t.status === 'planning').length;
    const publishedTrips = trips.filter(t => t.isPublished).length;

    const handleSignOut = () => {
        Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign Out', style: 'destructive', onPress: signOut },
        ]);
    };

    const handleSyncNow = async () => {
        try {
            const result = await syncQueue.flush();
            Alert.alert('Sync Complete', `${result.success} synced, ${result.failed} failed`);
        } catch (error) {
            Alert.alert('Sync Error', 'Failed to sync offline changes');
        }
    };

    return (
        <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]} contentContainerStyle={styles.contentContainer}>
            {/* Profile Header */}
            <Surface style={[styles.profileCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
                <View style={styles.avatarSection}>
                    {profile?.avatarUrl ? (
                        <Avatar.Image size={80} source={{ uri: profile.avatarUrl }} />
                    ) : (
                        <Avatar.Text
                            size={80}
                            label={profile?.displayName?.charAt(0) || firebaseUser?.email?.charAt(0) || 'U'}
                            style={{ backgroundColor: theme.colors.primaryContainer }}
                            labelStyle={{ color: theme.colors.primary }}
                        />
                    )}
                    <Text variant="headlineSmall" style={[styles.displayName, { color: theme.colors.onSurface }]}>
                        {profile?.displayName || firebaseUser?.displayName || 'Traveler'}
                    </Text>
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                        {firebaseUser?.email}
                    </Text>
                </View>

                {/* Stats Row */}
                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Text variant="headlineSmall" style={[styles.statNumber, { color: theme.colors.primary }]}>
                            {trips.length}
                        </Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            Trips
                        </Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text variant="headlineSmall" style={[styles.statNumber, { color: theme.colors.secondary }]}>
                            {profile?.followers?.length || 0}
                        </Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            Followers
                        </Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text variant="headlineSmall" style={[styles.statNumber, { color: theme.colors.tertiary }]}>
                            {profile?.following?.length || 0}
                        </Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            Following
                        </Text>
                    </View>
                </View>
            </Surface>

            {/* Quick Stats */}
            <View style={styles.quickStats}>
                <Surface style={[styles.quickStatCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
                    <MaterialCommunityIcons name="airplane-check" size={28} color={theme.colors.secondary} />
                    <Text variant="titleLarge" style={{ fontWeight: '700', color: theme.colors.onSurface }}>
                        {completedTrips}
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Completed</Text>
                </Surface>
                <Surface style={[styles.quickStatCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
                    <MaterialCommunityIcons name="airplane" size={28} color={theme.colors.primary} />
                    <Text variant="titleLarge" style={{ fontWeight: '700', color: theme.colors.onSurface }}>
                        {activeTrips}
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Active</Text>
                </Surface>
                <Surface style={[styles.quickStatCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
                    <MaterialCommunityIcons name="share-variant" size={28} color={theme.colors.tertiary} />
                    <Text variant="titleLarge" style={{ fontWeight: '700', color: theme.colors.onSurface }}>
                        {publishedTrips}
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Published</Text>
                </Surface>
            </View>

            {/* Settings */}
            <Surface style={[styles.settingsCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
                <List.Item
                    title="Sync Offline Changes"
                    description="Push pending changes to server"
                    left={(props) => <List.Icon {...props} icon="cloud-sync" color={theme.colors.primary} />}
                    onPress={handleSyncNow}
                />
                <Divider />
                <List.Item
                    title="About WanderMate"
                    description="Version 1.0.0"
                    left={(props) => <List.Icon {...props} icon="information-outline" color={theme.colors.onSurfaceVariant} />}
                />
            </Surface>

            <Button
                mode="outlined"
                onPress={handleSignOut}
                style={styles.signOutButton}
                textColor={theme.colors.error}
                icon="logout"
            >
                Sign Out
            </Button>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    contentContainer: { padding: 16, paddingBottom: 32 },
    profileCard: { borderRadius: 20, padding: 24, marginBottom: 16 },
    avatarSection: { alignItems: 'center', marginBottom: 20 },
    displayName: { fontWeight: '700', marginTop: 12 },
    statsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
    statItem: { alignItems: 'center' },
    statNumber: { fontWeight: '800' },
    statDivider: { width: 1, height: 32, backgroundColor: '#E0E0E0' },
    quickStats: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    quickStatCard: { flex: 1, borderRadius: 14, padding: 14, alignItems: 'center', gap: 4 },
    settingsCard: { borderRadius: 14, overflow: 'hidden', marginBottom: 16 },
    signOutButton: { borderRadius: 12, borderColor: '#FF5252' },
});
