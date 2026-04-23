import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_NINJAS_KEY } from '../config/env';

const CACHE_PREFIX = '@wandermate_trip_img_';
const API_URL = 'https://api.api-ninjas.com/v1/randomimage';

export function useTripImage(tripId: string, existingCoverImage?: string) {
    const [imageUri, setImageUri] = useState<string | null>(existingCoverImage || null);

    useEffect(() => {
        if (existingCoverImage) {
            setImageUri(existingCoverImage);
            return;
        }

        let cancelled = false;
        const cacheKey = CACHE_PREFIX + tripId;

        (async () => {
            // Return cached image immediately if available
            try {
                const cached = await AsyncStorage.getItem(cacheKey);
                if (cached) {
                    if (!cancelled) setImageUri(cached);
                    return;
                }
            } catch { }

            // Fetch a fresh random image from API Ninjas
            try {
                const response = await fetch(API_URL, {
                    headers: {
                        'X-Api-Key': API_NINJAS_KEY,
                        'Accept': 'image/jpg',
                    },
                });

                if (!response.ok || cancelled) return;

                const blob = await response.blob();

                // Convert binary blob to a base64 data URI
                const base64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });

                await AsyncStorage.setItem(cacheKey, base64);
                if (!cancelled) setImageUri(base64);
            } catch (e) {
                console.warn('useTripImage: fetch failed', e);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [tripId, existingCoverImage]);

    return imageUri;
}
