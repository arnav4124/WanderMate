import React, { useMemo } from 'react';
import { WebView } from 'react-native-webview';
import { POI, Day } from '@/types';
import { CategoryColors } from '@/constants/theme';

interface MapViewProps {
    viewMode?: 'itinerary' | 'discover';
    discoverPOIs?: POI[];
    lat: string;
    lng: string;
    zoom?: number;
    mapCenterTick?: number;
    dayStops: any[];
    selectedPOI: POI | null;
    routeData: any;
    onMapMessage: (event: any) => void;
}

export function ExploreMapView({
    lat,
    lng,
    zoom = 13,
    mapCenterTick = 0,
    dayStops,
    selectedPOI,
    routeData,
    onMapMessage,
    viewMode = 'itinerary',
    discoverPOIs = []
}: MapViewProps) {

    const mapHtml = useMemo(() => {
        const discStops = discoverPOIs.map(s => ({ ...s, color: CategoryColors[s.category] || '#95E1D3' }));
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
        var initLat = ${lat};
        var initLng = ${lng};
        var initZoom = ${zoom};
        var selPOI = ${JSON.stringify(selectedPoint)};
        if (selPOI) { initLat = selPOI.lat; initLng = selPOI.lng; initZoom = Math.max(initZoom, 15); }
        var map = L.map('map').setView([initLat, initLng], initZoom);
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

        var viewMode = "${viewMode}";

        var routeInfo = ${JSON.stringify(routeInfo)};
        var discStops = ${JSON.stringify(discStops)};
        
        if (viewMode === 'discover') {
            discStops.forEach(function(stop) {
                var icon = L.divIcon({
                    className: '',
                    html: '<div class="custom-marker" style="border-color: ' + stop.color + '; color: ' + stop.color + ';"><div style="width:8px;height:8px;background-color:'+stop.color+';border-radius:50%;"></div></div>',
                    iconSize: [24, 24],
                    iconAnchor: [12, 12],
                });
                var marker = L.marker([stop.lat, stop.lng], { icon: icon }).addTo(map);
                marker.on('click', function() {
                    if (window.ReactNativeWebView) {
                        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'POI_CLICK', poi: stop }));
                    }
                });
                markers.push(marker);
            });
        }
        
        map.on('moveend', function() {
            var center = map.getCenter();
            if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'REGION_CHANGE', lat: center.lat, lng: center.lng, zoom: map.getZoom() }));
            }
        });
        
        
      </script>
    </body>
    </html>
  `;
    }, [lat, lng, zoom, mapCenterTick, dayStops, selectedPOI, routeData, viewMode, discoverPOIs]);

    const source = useMemo(() => ({ html: mapHtml }), [mapHtml]);

    return (
        <WebView
            source={source}
            style={{ flex: 1 }}
            javaScriptEnabled
            onMessage={onMapMessage}
        />
    );
}
