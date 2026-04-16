import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, useTheme, Appbar, Chip, ActivityIndicator } from 'react-native-paper';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTripStore } from '@/stores/tripStore';
import api from '@/services/api';
import { CategoryColors } from '@/constants/theme';

export default function TripMapScreen() {
    const theme = useTheme();
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { currentTrip, fetchTrip } = useTripStore();
    const webViewRef = useRef<WebView>(null);

    const [selectedDay, setSelectedDay] = useState(0);
    const [routeData, setRouteData] = useState<any>(null);
    const [loadingRoute, setLoadingRoute] = useState(false);

    useEffect(() => {
        if (id && !currentTrip) {
            fetchTrip(id);
        }
    }, [id]);

    useEffect(() => {
        if (currentTrip?.days?.[selectedDay]?.stops?.length && currentTrip.days[selectedDay].stops.length >= 2) {
            computeRoute();
        }
    }, [selectedDay, currentTrip]);

    const computeRoute = async () => {
        const day = currentTrip?.days?.[selectedDay];
        if (!day || day.stops.length < 2) return;

        setLoadingRoute(true);
        try {
            const coordinates = day.stops
                .sort((a, b) => a.order - b.order)
                .map(s => ({ lat: s.lat, lng: s.lng }));

            const response = await api.post('/routes/optimize', { coordinates });
            setRouteData(response.data);
        } catch (error) {
            console.error('Route error:', error);
        } finally {
            setLoadingRoute(false);
        }
    };

    const currentDay = currentTrip?.days?.[selectedDay];
    const stops = currentDay?.stops?.sort((a, b) => a.order - b.order) || [];

    // Calculate map center
    const centerLat = stops.length > 0
        ? stops.reduce((sum, s) => sum + s.lat, 0) / stops.length
        : 48.8566;
    const centerLng = stops.length > 0
        ? stops.reduce((sum, s) => sum + s.lng, 0) / stops.length
        : 2.3522;

    const mapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        * { margin: 0; padding: 0; }
        body { overflow: hidden; }
        #map { width: 100%; height: 100vh; }
        .custom-marker {
          background-color: white;
          border-radius: 50%;
          border: 3px solid;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 14px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        }
        .popup-content h3 { margin: 0 0 4px; font-size: 14px; }
        .popup-content p { margin: 0; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map').setView([${centerLat}, ${centerLng}], ${stops.length > 0 ? 13 : 5});

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OSM contributors',
          maxZoom: 19,
        }).addTo(map);

        var markers = [];
        var stops = ${JSON.stringify(stops.map((s, i) => ({
        lat: s.lat,
        lng: s.lng,
        name: s.name,
        category: s.category,
        order: i + 1,
        color: CategoryColors[s.category] || '#95E1D3',
        address: s.address || '',
        notes: s.notes || '',
    })))};

        stops.forEach(function(stop) {
          var icon = L.divIcon({
            className: '',
            html: '<div class="custom-marker" style="border-color: ' + stop.color + '; color: ' + stop.color + ';">' + stop.order + '</div>',
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          });

          var marker = L.marker([stop.lat, stop.lng], { icon: icon }).addTo(map);
          marker.bindPopup(
            '<div class="popup-content"><h3>' + stop.order + '. ' + stop.name + '</h3>' +
            '<p>' + stop.category + '</p>' +
            (stop.address ? '<p>' + stop.address + '</p>' : '') +
            (stop.notes ? '<p><em>' + stop.notes + '</em></p>' : '') +
            '</div>'
          );
          markers.push(marker);
        });

        // Draw route if available
        var routeGeoJSON = ${routeData?.geometry ? JSON.stringify(routeData.geometry) : 'null'};
        if (routeGeoJSON) {
          L.geoJSON(routeGeoJSON, {
            style: {
              color: '#1B6EF3',
              weight: 4,
              opacity: 0.8,
              dashArray: null,
            }
          }).addTo(map);
        } else if (stops.length >= 2) {
          // Fallback: draw straight lines between stops
          var latlngs = stops.map(function(s) { return [s.lat, s.lng]; });
          L.polyline(latlngs, {
            color: '#1B6EF3',
            weight: 3,
            opacity: 0.6,
            dashArray: '8, 8',
          }).addTo(map);
        }

        // Fit bounds if markers exist
        if (markers.length > 0) {
          var group = L.featureGroup(markers);
          map.fitBounds(group.getBounds().pad(0.15));
        }

        // Route info
        var routeInfo = ${routeData ? JSON.stringify({ distance: routeData.distance, duration: routeData.duration }) : 'null'};
        if (routeInfo) {
          var infoDiv = L.control({ position: 'bottomleft' });
          infoDiv.onAdd = function() {
            var div = L.DomUtil.create('div', 'leaflet-bar');
            div.style.cssText = 'background:white;padding:8px 12px;border-radius:8px;font-size:13px;box-shadow:0 2px 6px rgba(0,0,0,0.2);';
            var km = (routeInfo.distance / 1000).toFixed(1);
            var mins = Math.round(routeInfo.duration / 60);
            div.innerHTML = '🚗 ' + km + ' km · ' + mins + ' min';
            return div;
          };
          infoDiv.addTo(map);
        }
      </script>
    </body>
    </html>
  `;

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
                <Appbar.BackAction onPress={() => router.back()} />
                <Appbar.Content title={currentTrip?.name || 'Map'} subtitle={`Day ${selectedDay + 1}`} titleStyle={{ fontWeight: '700' }} />
            </Appbar.Header>

            {/* Day Selector */}
            <View style={styles.dayRow}>
                {currentTrip?.days?.map((day, idx) => (
                    <Chip
                        key={idx}
                        selected={selectedDay === idx}
                        onPress={() => setSelectedDay(idx)}
                        compact
                        mode={selectedDay === idx ? 'flat' : 'outlined'}
                        style={[
                            styles.dayChip,
                            selectedDay === idx && { backgroundColor: theme.colors.primaryContainer },
                        ]}
                    >
                        Day {day.dayNumber}
                    </Chip>
                ))}
            </View>

            {loadingRoute && (
                <View style={styles.routeLoading}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                    <Text variant="bodySmall" style={{ marginLeft: 8, color: theme.colors.onSurfaceVariant }}>
                        Computing optimal route...
                    </Text>
                </View>
            )}

            <WebView
                ref={webViewRef}
                source={{ html: mapHtml }}
                style={styles.map}
                javaScriptEnabled
                domStorageEnabled
                startInLoadingState
                renderLoading={() => (
                    <View style={styles.mapLoading}>
                        <ActivityIndicator size="large" color={theme.colors.primary} />
                    </View>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    dayRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, gap: 6, flexWrap: 'wrap' },
    dayChip: {},
    map: { flex: 1 },
    routeLoading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
    mapLoading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
});
