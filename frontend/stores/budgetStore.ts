import { create } from 'zustand';
import api from '../services/api';
import { Expense, BudgetSummary } from '../types';
import { ref, onValue, off } from 'firebase/database';
import { database } from '../config/firebase';

interface BudgetState {
    expenses: Expense[];
    summary: BudgetSummary['summary'] | null;
    isLoading: boolean;

    fetchBudget: (tripId: string) => Promise<void>;
    addExpense: (tripId: string, data: Partial<Expense>) => Promise<Expense | undefined>;
    updateExpense: (tripId: string, expenseId: string, data: Partial<Expense>) => Promise<Expense | undefined>;
    deleteExpense: (tripId: string, expenseId: string) => Promise<void>;
    subscribeBudgetUpdates: (tripId: string) => () => void;
}

export const useBudgetStore = create<BudgetState>((set, get) => ({
    expenses: [],
    summary: null,
    isLoading: false,

    fetchBudget: async (tripId) => {
        set({ isLoading: true });
        try {
            const response = await api.get(`/budget/${tripId}`);
            set({
                expenses: response.data.expenses,
                summary: response.data.summary,
                isLoading: false,
            });
        } catch (error) {
            console.error('Fetch budget error:', error);
            set({ isLoading: false });
        }
    },

    addExpense: async (tripId, data) => {
        try {
            const response = await api.post(`/budget/${tripId}`, data);
            set((state) => ({
                expenses: [...state.expenses, response.data],
            }));
            // Re-fetch to update summary
            get().fetchBudget(tripId);
            return response.data;
        } catch (error) {
            console.error('Add expense error:', error);
            return undefined;
        }
    },

    updateExpense: async (tripId, expenseId, data) => {
        try {
            const response = await api.put(`/budget/${tripId}/${expenseId}`, data);
            set((state) => ({
                expenses: state.expenses.map(e => e._id === expenseId ? response.data : e),
            }));
            get().fetchBudget(tripId);
            return response.data;
        } catch (error) {
            console.error('Update expense error:', error);
            return undefined;
        }
    },

    deleteExpense: async (tripId, expenseId) => {
        try {
            await api.delete(`/budget/${tripId}/${expenseId}`);
            set((state) => ({
                expenses: state.expenses.filter(e => e._id !== expenseId),
            }));
            get().fetchBudget(tripId);
        } catch (error) {
            console.error('Delete expense error:', error);
        }
    },

    // Observer pattern: real-time budget updates (FR-15)
    subscribeBudgetUpdates: (tripId) => {
        const budgetRef = ref(database, `budgets/${tripId}/lastUpdate`);
        const listener = onValue(budgetRef, () => {
            get().fetchBudget(tripId);
        });

        return () => off(budgetRef, 'value', listener);
    },
}));
