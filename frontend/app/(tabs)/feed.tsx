import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { Text, Card, useTheme, IconButton, Button, SegmentedButtons, Chip, Avatar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useFeedStore } from '@/stores/feedStore';
import { useAuthStore } from '@/stores/authStore';
import { useRouter } from 'expo-router';
import { FeedPost } from '@/types';

function FeedCard({ post, onLike, onClone }: { post: FeedPost; onLike: () => void; onClone: () => void }) {
    const theme = useTheme();
    const { firebaseUser } = useAuthStore();
    const isLiked = post.likes?.includes(firebaseUser?.uid || '');

    return (
        <Card style={[styles.feedCard, { backgroundColor: theme.colors.surface }]} mode="elevated">
            {post.coverImage && (
                <Card.Cover source={{ uri: post.coverImage }} style={styles.coverImage} />
            )}
            {!post.coverImage && (
                <View style={[styles.coverPlaceholder, { backgroundColor: theme.colors.primaryContainer }]}>
                    <MaterialCommunityIcons name="earth" size={48} color={theme.colors.primary} />
                </View>
            )}

            <Card.Content style={styles.feedContent}>
                {/* Author info */}
                <View style={styles.authorRow}>
                    {post.authorAvatar ? (
                        <Avatar.Image size={32} source={{ uri: post.authorAvatar }} />
                    ) : (
                        <Avatar.Text size={32} label={post.authorName?.charAt(0) || 'T'} />
                    )}
                    <View style={styles.authorInfo}>
                        <Text variant="labelMedium" style={{ fontWeight: '700', color: theme.colors.onSurface }}>
                            {post.authorName}
                        </Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            {format(new Date(post.createdAt), 'MMM d, yyyy')}
                        </Text>
                    </View>
                </View>

                {/* Trip info */}
                <Text variant="titleMedium" style={[styles.tripName, { color: theme.colors.onSurface }]}>
                    {post.tripName}
                </Text>

                <View style={styles.chipRow}>
                    <Chip compact icon="map-marker" textStyle={{ fontSize: 11 }}>
                        {post.destination}
                    </Chip>
                    <Chip compact icon="calendar" textStyle={{ fontSize: 11 }}>
                        {post.duration} days
                    </Chip>
                    {post.participantCount > 1 && (
                        <Chip compact icon="account-group" textStyle={{ fontSize: 11 }}>
                            {post.participantCount}
                        </Chip>
                    )}
                </View>

                <View style={styles.statsRow}>
                    <View style={styles.stat}>
                        <MaterialCommunityIcons name="map-marker-check" size={14} color={theme.colors.secondary} />
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginLeft: 4 }}>
                            {post.stopCount} stops
                        </Text>
                    </View>
                    {post.totalBudget > 0 && (
                        <View style={styles.stat}>
                            <MaterialCommunityIcons name="wallet" size={14} color={theme.colors.tertiary} />
                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginLeft: 4 }}>
                                ${post.totalBudget.toFixed(0)}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Actions */}
                <View style={styles.actions}>
                    <View style={styles.likeContainer}>
                        <IconButton
                            icon={isLiked ? 'heart' : 'heart-outline'}
                            iconColor={isLiked ? theme.colors.error : theme.colors.onSurfaceVariant}
                            size={22}
                            onPress={onLike}
                        />
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            {post.likeCount}
                        </Text>
                    </View>
                    <Button
                        mode="contained-tonal"
                        compact
                        icon="content-copy"
                        onPress={onClone}
                        labelStyle={{ fontSize: 12 }}
                    >
                        Clone Trip
                    </Button>
                </View>
            </Card.Content>
        </Card>
    );
}

export default function FeedScreen() {
    const theme = useTheme();
    const router = useRouter();
    const { posts, isLoading, feedType, fetchFeed, loadMore, likePost, cloneTrip, setFeedType } = useFeedStore();
    const [feedTab, setFeedTab] = useState('discover');

    useEffect(() => {
        fetchFeed('discover');
    }, []);

    const handleClone = async (postId: string) => {
        const tripId = await cloneTrip(postId);
        if (tripId) {
            Alert.alert('Success!', 'Trip cloned to your trips.', [
                { text: 'View', onPress: () => router.push(`/trip/${tripId}`) },
                { text: 'OK' },
            ]);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {/* Feed Type Selector */}
            <View style={styles.tabContainer}>
                <SegmentedButtons
                    value={feedTab}
                    onValueChange={(val) => {
                        setFeedTab(val);
                        setFeedType(val as 'discover' | 'following');
                    }}
                    buttons={[
                        { value: 'discover', label: 'Discover', icon: 'compass' },
                        { value: 'following', label: 'Following', icon: 'account-group' },
                    ]}
                    style={styles.segmented}
                />
            </View>

            <FlatList
                data={posts}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => (
                    <FeedCard
                        post={item}
                        onLike={() => likePost(item._id)}
                        onClone={() => handleClone(item._id)}
                    />
                )}
                contentContainerStyle={styles.list}
                refreshControl={
                    <RefreshControl refreshing={isLoading} onRefresh={() => fetchFeed(feedType, 1)} colors={[theme.colors.primary]} />
                }
                onEndReached={loadMore}
                onEndReachedThreshold={0.3}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    !isLoading ? (
                        <View style={styles.emptyContainer}>
                            <MaterialCommunityIcons name="newspaper-variant-outline" size={64} color={theme.colors.primary} style={{ opacity: 0.4 }} />
                            <Text variant="titleMedium" style={{ color: theme.colors.onSurface, marginTop: 16, fontWeight: '600' }}>
                                {feedType === 'following' ? 'Follow travelers to see their trips' : 'No trips published yet'}
                            </Text>
                            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8, textAlign: 'center' }}>
                                {feedType === 'following'
                                    ? 'Visit the Discover tab to find interesting travelers'
                                    : 'Be the first to share your adventure!'}
                            </Text>
                        </View>
                    ) : null
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    tabContainer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
    segmented: { borderRadius: 12 },
    list: { padding: 16, paddingTop: 8 },
    feedCard: { marginBottom: 16, borderRadius: 16, overflow: 'hidden' },
    coverImage: { height: 180 },
    coverPlaceholder: { height: 120, justifyContent: 'center', alignItems: 'center' },
    feedContent: { padding: 14 },
    authorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    authorInfo: { marginLeft: 10 },
    tripName: { fontWeight: '700', marginBottom: 8 },
    chipRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 10 },
    statsRow: { flexDirection: 'row', gap: 16 },
    stat: { flexDirection: 'row', alignItems: 'center' },
    actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, borderTopWidth: 0.5, borderTopColor: '#E0E0E0', paddingTop: 4 },
    likeContainer: { flexDirection: 'row', alignItems: 'center' },
    emptyContainer: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
});
