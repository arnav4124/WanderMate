import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Searchbar, IconButton, Chip, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CategoryColors, CategoryIcons } from '@/constants/theme';

const CATEGORIES = ['hotel', 'restaurant', 'landmark', 'activity', 'shopping', 'transport', 'museum', 'park', 'nightlife', 'medical', 'grocery', 'finance'] as const;

interface SearchBarSectionProps {
    query: string;
    setQuery: (q: string) => void;
    onSearch: () => void;
    mode: 'list' | 'map';
    setMode: (mode: 'list' | 'map') => void;
    selectedCategory: string | null;
    onCategoryPress: (cat: string) => void;
}

export function SearchBarSection({
    query,
    setQuery,
    onSearch,
    mode,
    setMode,
    selectedCategory,
    onCategoryPress
}: SearchBarSectionProps) {
    const theme = useTheme();

    return (
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.outlineVariant }]}>
            <View style={styles.searchSection}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Searchbar
                        placeholder="Search places..."
                        value={query}
                        onChangeText={setQuery}
                        onSubmitEditing={onSearch}
                        style={[styles.searchbar, { backgroundColor: theme.colors.surfaceVariant, flex: 1 }]}
                        inputStyle={{ fontSize: 15, minHeight: 0, paddingVertical: 0, alignSelf: 'center', marginTop: -2 }}
                    />
                    <IconButton
                        icon={mode === 'list' ? 'map' : 'format-list-bulleted'}
                        mode="contained-tonal"
                        size={24}
                        style={{ margin: 0, height: 48, width: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' }}
                        onPress={() => setMode(mode === 'list' ? 'map' : 'list')}
                    />
                </View>

                {mode === 'list' && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
                        {CATEGORIES.map((cat) => (
                            <Chip
                                key={cat}
                                selected={selectedCategory === cat}
                                onPress={() => onCategoryPress(cat)}
                                mode="flat"
                                style={[styles.catChip, selectedCategory === cat && { backgroundColor: CategoryColors[cat] + '30' }]}
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
                    </ScrollView>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    header: { paddingBottom: 12, borderBottomWidth: 1, zIndex: 10 },
    searchSection: { paddingHorizontal: 16, gap: 12 },
    searchbar: { borderRadius: 12, elevation: 0, height: 48, justifyContent: 'center' },
    categoryRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    catChip: { borderRadius: 20 },
});
