import React, { useMemo } from 'react';
import { WebView } from 'react-native-webview';
import { POI, Day } from '@/types';
import { CategoryColors } from '@/constants/theme';

interface MapViewProps {
    lat: string;
    lng: string;
    dayStops: any[];
    selectedPOI: POI | null;
    routeData: any;
    onMapMessage: (event: any) => void;
}

export function ExploreMapView({
    lat,
    lng,
    dayStops,
    selectedPOI,
    routeData,
    onMapMessage
}: MapViewProps) {

    const mapHtml = useMemo(() => {
        const sortedStops = [...(dayStops || [])].sort((a, b) => a.order - b.order).map((s, i) => ({
            id: s._id,
            placeId: s.placeId,
            lat: s.lat,
            lng: s.lng,
            name: s.name,
            category: s.category,
            photo: s.photo,
            rating: s.rating,
            address: s.address,
            openingHours: s.openingHours,
            priceLevel: s.priceLevel,
            order: i + 1,
            color: CategoryColors[s.category] || '#95E1D3',
        }));

        const selectedPoint = selectedPOI ? {
            id: selectedPOI.id,
            lat: selectedPOI.lat,
            lng: selectedPOI.lng,
            name: selectedPOI.name,
            color: CategoryColors[selectedPOI.category] || '#FF5722'
        } : null;

        const routeGeoJSON = routeData?.geometry ? routeData.geometry : null;
        const routeInfo = routeData ? { distance: routeData.distance, duration: routeData.duration } : null;

        return `
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
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map').setView([${lat}, ${lng}], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

        var markers = [];
        var stops = ${JSON.stringify(sortedStops)};

        stops.forEach(function(stop) {
            var icon = L.divIcon({
                className: '',
                html: '<div class="custom-marker" style="border-color: ' + stop.color + '; color: ' + stop.color + ';">' + stop.order + '</div>',
                iconSize: [32, 32],
                iconAnchor: [16, 16],
            });
            var marker = L.marker([stop.lat, stop.lng], { icon: icon }).addTo(map);
            marker.on('click', function() {
                if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'STOP_CLICK', stop: stop }));
                }
            });
            markers.push(marker);
        });

        // Draw polyline connecting stops
        var routeGeoJSON = ${JSON.stringify(routeGeoJSON)};
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
            var latlngs = stops.map(function(s) { return [s.lat, s.lng]; });
            L.polyline(latlngs, {
                color: '#1B6EF3',
                weight: 3,
                opacity: 0.6,
                dashArray: '8, 8',
            }).addTo(map);
        }

        // Add selected POI
        var selectedPOI = ${JSON.stringify(selectedPoint)};
        if (selectedPOI) {
            var icon = L.divIcon({
                className: '',
                html: '<div class="custom-marker" style="border-color: ' + selectedPOI.color + '; color: ' + selectedPOI.color + ';">' + '<div style="width:12px;height:12px;background-color:'+selectedPOI.color+';border-radius:50%;"></div>' + '</div>',
                iconSize: [36, 36],
                iconAnchor: [18, 18],
            });
            var marker = L.marker([selectedPOI.lat, selectedPOI.lng], { icon: icon, zIndexOffset: 1000 }).addTo(map);
            markers.push(marker);
        }

        if (markers.length > 0) {
            var group = L.featureGroup(markers);
            map.fitBounds(group.getBounds().pad(0.1));
        } else if (stops.length === 0 && !selectedPOI) {
            map.setView([${lat}, ${lng}], 13);
        }

        var routeInfo = ${JSON.stringify(routeInfo)};
        if (routeInfo) {
            var infoDiv = L.control({ position: 'topright' });
            infoDiv.onAdd = function() {
                var div = L.DomUtil.create('div', 'leaflet-bar');
                div.style.cssText = 'background:white;padding:8px 12px;border-radius:8px;font-size:13px;box-shadow:0 2px 6px rgba(0,0,0,0.2); margin-top: 10px; margin-right: 10px; font-weight: bold;';
                var km = (routeInfo.distance).toFixed(1);
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
    }, [lat, lng, dayStops, selectedPOI, routeData]);

    return (
        <WebView
            source={{ html: mapHtml }}
            style={{ flex: 1 }}
            javaScriptEnabled
            onMessage={onMapMessage}
        />
    );
}
