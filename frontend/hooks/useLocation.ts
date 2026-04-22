import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { useTripStore } from '@/stores/tripStore';
import { useActiveTripStore } from '@/stores/activeTripStore';

export function useLocation() {
    const { trips } = useTripStore();
    const { activeTripId } = useActiveTripStore();

    // Default: Hyderabad
    const [lat, setLat] = useState<string>('17.3616');
    const [lng, setLng] = useState<string>('78.4747');

    const activeTrip = trips.find(t => t._id === activeTripId);

    useEffect(() => {
        const updateLocation = async () => {
            if (activeTrip?.destination) {
                try {
                    const geocoded = await Location.geocodeAsync(activeTrip.destination);
                    if (geocoded && geocoded.length > 0) {
                        setLat(geocoded[0].latitude.toString());
                        setLng(geocoded[0].longitude.toString());
                        return;
                    }
                } catch (e) {
                    console.error("Geocoding failed", e);
                }
            }
            
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status === 'granted') {
                    const loc = await Location.getCurrentPositionAsync({});
                    setLat(loc.coords.latitude.toString());
                    setLng(loc.coords.longitude.toString());
                }
            } catch(e) {
                console.error("Error requesting location", e);
            }
        };
        updateLocation();
    }, [activeTrip?.destination]);

    return { lat, lng, setLat, setLng };
}
