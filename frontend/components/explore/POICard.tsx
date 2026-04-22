import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, Chip, Button, IconButton, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { POI } from '@/types';
import { CategoryColors, CategoryIcons } from '@/constants/theme';

interface POICardProps {
    poi: POI;
    onAdd: (poi: POI) => void;
    onMap?: (poi: POI) => void;
    onMoreDetails?: (poi: POI) => void;
    onClose?: () => void;
    isMini?: boolean;
    isAdded?: boolean;
}

export function POICard({
    poi,
    onAdd,
    onMap,
    onMoreDetails,
    onClose,
    isMini = false,
    isAdded = false
}: POICardProps) {
    const theme = useTheme();

    const renderPriceLevel = (level?: number) => {
        if (level === undefined) return null;
        if (level === 0) return 'FREE';
        return Array(level).fill('$').join('');
    };

    return (
        <Card style={[styles.poiCard, { backgroundColor: theme.colors.surface, marginBottom: isMini ? 0 : 12 }]} mode="elevated">
            {poi.photo && (
                <Card.Cover source={{ uri: poi.photo }} style={isMini ? { height: 100 } : styles.poiImage} />
            )}
            <Card.Content style={styles.poiContent}>
                <View style={styles.poiHeader}>
                    <View style={[styles.categoryBadge, { backgroundColor: CategoryColors[poi.category] || '#95E1D3' }]}>
                        <MaterialCommunityIcons
                            name={(CategoryIcons[poi.category] || 'map-marker') as any}
                            size={14}
                            color="#FFF"
                        />
                    </View>
                    <Text variant="titleSmall" style={{ flex: 1, fontWeight: '700', color: theme.colors.onSurface }} numberOfLines={1}>
                        {poi.name}
                    </Text>
                    {poi.rating && (
                        <View style={styles.ratingContainer}>
                            <MaterialCommunityIcons name="star" size={14} color="#FFD93D" />
                            <Text variant="bodySmall" style={{ marginLeft: 2, fontWeight: '600', color: theme.colors.onSurface }}>
                                {poi.rating.toFixed(1)}
                            </Text>
                        </View>
                    )}
                    {isMini && onClose && (
                        <IconButton icon="close" size={20} onPress={onClose} style={{ margin: 0, marginLeft: 4 }} />
                    )}
                </View>

                {/* Badges for distance, hours, price */}
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    {(poi.openingHours === 'Open 24 hours' || poi.openingHours) && (
                        <Chip compact textStyle={{ fontSize: 10 }} icon="clock-outline" style={{ height: 24 }}>
                            {Array.isArray(poi.openingHours) ? 'Open Today' : (poi.openingHours || 'Open')}
                        </Chip>
                    )}
                    {poi.priceLevel !== undefined && (
                        <Chip compact textStyle={{ fontSize: 10 }} icon="cash" style={{ height: 24, backgroundColor: poi.priceLevel === 0 ? '#E8F5E9' : undefined }}>
                            {renderPriceLevel(poi.priceLevel)}
                        </Chip>
                    )}
                </View>

                {poi.address && (
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }} numberOfLines={2}>
                        {poi.address}
                    </Text>
                )}

                <View style={styles.poiActions}>
                    {!isMini ? (
                        <>
                            <Button
                                mode="contained"
                                compact
                                onPress={() => onAdd(poi)}
                                icon="plus"
                                style={{ flex: 1, marginRight: 8 }}
                            >
                                Add to Trip
                            </Button>
                            {onMap && (
                                <Button
                                    mode="outlined"
                                    compact
                                    onPress={() => onMap(poi)}
                                    icon="map"
                                >
                                    Map View
                                </Button>
                            )}
                        </>
                    ) : (
                        <>
                            {!isAdded && (
                                <Button mode="contained" compact onPress={() => onAdd(poi)} icon="plus" style={{ marginRight: 8 }}>
                                    Add
                                </Button>
                            )}
                            {onMoreDetails && (
                                <Button mode="outlined" compact onPress={() => onMoreDetails(poi)} style={{ flex: 1 }}>
                                    More Details
                                </Button>
                            )}
                        </>
                    )}
                </View>
            </Card.Content>
        </Card>
    );
}

const styles = StyleSheet.create({
    poiCard: { borderRadius: 14, overflow: 'hidden' },
    poiImage: { height: 140 },
    poiContent: { padding: 12 },
    poiHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    categoryBadge: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    ratingContainer: { flexDirection: 'row', alignItems: 'center' },
    poiActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
});
