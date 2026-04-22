import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, ScrollView, Alert } from 'react-native';
import { Text, useTheme, Surface, Button, FAB, TextInput, SegmentedButtons, Chip, Portal, Modal, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useBudgetStore } from '@/stores/budgetStore';
import { useTripStore } from '@/stores/tripStore';
import { useActiveTripStore } from '@/stores/activeTripStore';
import { CategoryColors } from '@/constants/theme';
import { Expense } from '@/types';

const EXPENSE_CATEGORIES = ['accommodation', 'food', 'transport', 'activities', 'other'] as const;
const CATEGORY_LABELS: Record<string, string> = {
    accommodation: 'Accommodation',
    food: 'Food & Drink',
    transport: 'Transport',
    activities: 'Activities',
    other: 'Other',
};

const CATEGORY_EMOJI: Record<string, string> = {
    accommodation: '🏨',
    food: '🍽️',
    transport: '🚗',
    activities: '🎯',
    other: '📦',
};

export default function BudgetScreen() {
    const theme = useTheme();
    const { trips } = useTripStore();
    const { expenses, summary, isLoading, fetchBudget, addExpense, deleteExpense, subscribeBudgetUpdates } = useBudgetStore();
    const { activeTripId } = useActiveTripStore();

    const selectedTripId = activeTripId;
    const [showAddModal, setShowAddModal] = useState(false);
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState<string>('food');
    const [viewMode, setViewMode] = useState('list');

    useEffect(() => {
        if (selectedTripId) {
            fetchBudget(selectedTripId);
            const unsub = subscribeBudgetUpdates(selectedTripId);
            return unsub;
        }
    }, [selectedTripId]);

    const handleAddExpense = async () => {
        if (!description || !amount || !selectedTripId) return;

        await addExpense(selectedTripId, {
            description,
            amount: parseFloat(amount),
            category: category as any,
            date: new Date().toISOString(),
            dayNumber: 1,
        });

        setDescription('');
        setAmount('');
        setShowAddModal(false);
    };

    const handleDelete = (expenseId: string) => {
        if (!selectedTripId) return;
        Alert.alert('Delete Expense', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => deleteExpense(selectedTripId, expenseId) },
        ]);
    };

    const selectedTrip = trips.find(t => t._id === selectedTripId);

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {!selectedTrip ? (
                <View style={styles.emptyExpenses}>
                    <MaterialCommunityIcons name="wallet-outline" size={48} color={theme.colors.onSurfaceVariant} style={{ opacity: 0.4 }} />
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8, paddingHorizontal: 32, textAlign: 'center' }}>
                        Set an active trip to track your budget
                    </Text>
                </View>
            ) : null}

            {selectedTrip ? (
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    {/* Budget Summary Card */}
                    {summary ? (
                    <Surface style={[styles.summaryCard, { backgroundColor: theme.colors.primaryContainer }]} elevation={0}>
                        <Text variant="titleSmall" style={{ color: theme.colors.primary, fontWeight: '600' }}>
                            Total Budget
                        </Text>
                        <Text variant="headlineLarge" style={[styles.totalAmount, { color: theme.colors.primary }]}>
                            ${summary.total.toFixed(2)}
                        </Text>
                        <View style={styles.summaryRow}>
                            <View style={styles.summaryItem}>
                                <MaterialCommunityIcons name="account-group" size={16} color={theme.colors.primary} />
                                <Text variant="bodySmall" style={{ color: theme.colors.primary, marginLeft: 4 }}>
                                    {summary.participantCount} people
                                </Text>
                            </View>
                            <View style={styles.summaryItem}>
                                <MaterialCommunityIcons name="division" size={16} color={theme.colors.primary} />
                                <Text variant="bodySmall" style={{ color: theme.colors.primary, marginLeft: 4 }}>
                                    ${summary.perPerson.toFixed(2)}/person
                                </Text>
                            </View>
                        </View>
                    </Surface>
                ) : null}

                {/* Category Breakdown */}
                {summary && Object.keys(summary.byCategory).length > 0 ? (
                    <View style={styles.categoryBreakdown}>
                        <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                            By Category
                        </Text>
                        <View style={styles.categoryGrid}>
                            {EXPENSE_CATEGORIES.map((cat) => {
                                const catAmount = summary.byCategory[cat] || 0;
                                if (catAmount === 0) return null;
                                const percentage = summary.total > 0 ? (catAmount / summary.total) * 100 : 0;
                                return (
                                    <Surface key={cat} style={[styles.categoryCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
                                        <Text style={styles.categoryEmoji}>{CATEGORY_EMOJI[cat]}</Text>
                                        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                            {CATEGORY_LABELS[cat]}
                                        </Text>
                                        <Text variant="titleSmall" style={{ fontWeight: '700', color: theme.colors.onSurface }}>
                                            ${catAmount.toFixed(0)}
                                        </Text>
                                        <View style={[styles.progressBar, { backgroundColor: theme.colors.surfaceVariant }]}>
                                            <View style={[styles.progressFill, { width: `${percentage}%`, backgroundColor: CategoryColors[cat] || theme.colors.primary }]} />
                                        </View>
                                    </Surface>
                                );
                            })}
                        </View>
                    </View>
                ) : null}

                {/* Expense List */}
                <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                    Expenses
                </Text>
                {expenses.map((expense) => (
                    <Surface key={expense._id} style={[styles.expenseItem, { backgroundColor: theme.colors.surface }]} elevation={1}>
                        <View style={[styles.expenseCatDot, { backgroundColor: CategoryColors[expense.category] || '#95E1D3' }]} />
                        <View style={styles.expenseInfo}>
                            <Text variant="bodyMedium" style={{ fontWeight: '600', color: theme.colors.onSurface }}>
                                {expense.description}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                    {CATEGORY_LABELS[expense.category]}
                                </Text>
                                {expense.dayNumber ? (
                                    <View style={{ backgroundColor: theme.colors.surfaceVariant, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, fontSize: 10 }}>Day {expense.dayNumber}</Text>
                                    </View>
                                ) : null}
                            </View>
                        </View>
                        <Text variant="titleSmall" style={{ fontWeight: '700', color: theme.colors.onSurface }}>
                            ${expense.amount.toFixed(2)}
                        </Text>
                        <IconButton icon="delete-outline" size={18} onPress={() => handleDelete(expense._id)} />
                    </Surface>
                ))}

                {expenses.length === 0 ? (
                    <View style={styles.emptyExpenses}>
                        <MaterialCommunityIcons name="wallet-outline" size={48} color={theme.colors.onSurfaceVariant} style={{ opacity: 0.4 }} />
                        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
                            No expenses recorded yet
                        </Text>
                    </View>
                ) : null}
                </ScrollView>
            ) : null}

            {selectedTrip ? (
                <FAB
                    icon="plus"
                    style={[styles.fab, { backgroundColor: theme.colors.primary }]}
                    color={theme.colors.onPrimary}
                    onPress={() => setShowAddModal(true)}
                />
            ) : null}

            {/* Add Expense Modal */}
            <Portal>
                <Modal visible={showAddModal} onDismiss={() => setShowAddModal(false)} contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}>
                    <Text variant="titleLarge" style={{ fontWeight: '700', color: theme.colors.onSurface, marginBottom: 16 }}>
                        Add Expense
                    </Text>

                    <TextInput
                        label="Description"
                        value={description}
                        onChangeText={setDescription}
                        mode="outlined"
                        style={styles.input}
                    />
                    <TextInput
                        label="Amount ($)"
                        value={amount}
                        onChangeText={setAmount}
                        mode="outlined"
                        keyboardType="decimal-pad"
                        style={styles.input}
                    />

                    <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 8 }}>
                        Category
                    </Text>
                    <View style={styles.categorySelector}>
                        {EXPENSE_CATEGORIES.map((cat) => (
                            <Chip
                                key={cat}
                                selected={category === cat}
                                onPress={() => setCategory(cat)}
                                mode={category === cat ? 'flat' : 'outlined'}
                                compact
                                style={[
                                    styles.catChip,
                                    category === cat && { backgroundColor: (CategoryColors[cat] || '#95E1D3') + '30' },
                                ]}
                            >
                                {CATEGORY_EMOJI[cat]} {CATEGORY_LABELS[cat]}
                            </Chip>
                        ))}
                    </View>

                    <Button mode="contained" onPress={handleAddExpense} style={styles.addButton} disabled={!description || !amount}>
                        Add Expense
                    </Button>
                </Modal>
            </Portal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    tripSelector: { maxHeight: 50, paddingHorizontal: 16, paddingVertical: 8, flexGrow: 0 },
    tripChip: { marginRight: 8 },
    scrollContent: { padding: 16, paddingBottom: 80 },
    summaryCard: { borderRadius: 16, padding: 20, marginBottom: 16, alignItems: 'center' },
    totalAmount: { fontWeight: '800', marginTop: 4 },
    summaryRow: { flexDirection: 'row', gap: 24, marginTop: 12 },
    summaryItem: { flexDirection: 'row', alignItems: 'center' },
    categoryBreakdown: { marginBottom: 16 },
    sectionTitle: { fontWeight: '700', marginBottom: 12 },
    categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    categoryCard: { width: '47%', borderRadius: 12, padding: 12, alignItems: 'center' },
    categoryEmoji: { fontSize: 24, marginBottom: 4 },
    progressBar: { width: '100%', height: 4, borderRadius: 2, marginTop: 6 },
    progressFill: { height: '100%', borderRadius: 2 },
    expenseItem: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 12, marginBottom: 8 },
    expenseCatDot: { width: 8, height: 32, borderRadius: 4, marginRight: 12 },
    expenseInfo: { flex: 1 },
    emptyExpenses: { alignItems: 'center', paddingVertical: 32 },
    fab: { position: 'absolute', right: 20, bottom: 20, borderRadius: 16 },
    modal: { margin: 20, padding: 24, borderRadius: 20 },
    input: { marginBottom: 12 },
    categorySelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    catChip: { marginBottom: 4 },
    addButton: { marginTop: 8, borderRadius: 12 },
});
