import { useState, useCallback } from 'react';
import api from '@/services/api';
import { POI } from '@/types';

export function usePOISearch() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<POI[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    const runSearch = useCallback(async (
        lat: string, 
        lng: string, 
        overrideCategory?: string | null, 
        isRefresh = false, 
        showMessage?: (msg: string) => void
    ) => {
        const activeCategory = overrideCategory !== undefined ? overrideCategory : selectedCategory;
        const activeQuery = activeCategory ? '' : query;

        if (!activeQuery && !activeCategory) return;

        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        try {
            let response;
            if (activeCategory) {
                response = await api.get(`/poi/category/${activeCategory}`, {
                    params: { lat, lng, radius: 5000, refresh: isRefresh },
                });
            } else {
                response = await api.get('/poi/search', {
                    params: { q: activeQuery, lat, lng, radius: 5000, refresh: isRefresh },
                });
            }
            setResults(response.data);
            return response.data;
        } catch (error) {
            console.error('Search error:', error);
            if (showMessage) {
                showMessage('Search failed. Please try again.');
            }
            return [];
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [query, selectedCategory]);

    return {
        query,
        setQuery,
        results,
        setResults,
        loading,
        refreshing,
        selectedCategory,
        setSelectedCategory,
        runSearch
    };
}
