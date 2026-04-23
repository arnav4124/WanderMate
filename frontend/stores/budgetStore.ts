import { create } from 'zustand';
import api from '../services/api';
import { Expense, BudgetSummary } from '../types';
import { localCache, syncQueue } from '../services/syncQueue';
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
            await localCache.set(`budget_${tripId}`, response.data);
        } catch (error) {
            const cached = await localCache.get<{ expenses: Expense[]; summary: any }>(`budget_${tripId}`, Infinity);
            if (cached) {
                set({ expenses: cached.expenses, summary: cached.summary, isLoading: false });
            } else {
                console.error('Fetch budget error:', error);
                set({ isLoading: false });
            }
        }
    },

    addExpense: async (tripId, data) => {
        try {
            const response = await api.post(`/budget/${tripId}`, data);
            set((state) => ({
                expenses: [...state.expenses, response.data],
            }));
            get().fetchBudget(tripId);
            return response.data;
        } catch (error) {
            await syncQueue.add({ method: 'POST', url: `/budget/${tripId}`, data });
            console.error('Add expense error (queued offline):', error);
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
            await syncQueue.add({ method: 'PUT', url: `/budget/${tripId}/${expenseId}`, data });
            console.error('Update expense error (queued offline):', error);
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
            await syncQueue.add({ method: 'DELETE', url: `/budget/${tripId}/${expenseId}` });
            console.error('Delete expense error (queued offline):', error);
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
