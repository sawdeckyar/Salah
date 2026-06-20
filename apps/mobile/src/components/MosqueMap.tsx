import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { Coordinates, Mosque } from '@salah/core';
import { useTheme } from '../theme';

/**
 * A key-free OpenStreetMap map rendered with Leaflet inside a WebView. Avoids
 * native map modules (and Google API keys), and runs in Expo Go. Tapping a
 * marker posts the mosque id back to React Native.
 */
export function MosqueMap({
  center,
  mosques,
  onSelect,
  height = 240,
}: {
  center: Coordinates;
  mosques: Mosque[];
  onSelect?: (id: string) => void;
  height?: number;
}) {
  const theme = useTheme();
  const html = buildHtml(center, mosques, theme.primary);

  return (
    <View
      style={[styles.wrap, { height, borderColor: theme.border }]}
    >
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={{ backgroundColor: theme.surface2 }}
        onMessage={(e) => onSelect?.(e.nativeEvent.data)}
        scrollEnabled={false}
      />
    </View>
  );
}

function buildHtml(
  center: Coordinates,
  mosques: Mosque[],
  accent: string,
): string {
  const points = mosques
    .filter((m) => Number.isFinite(m.location.latitude))
    .map((m) => ({
      id: m.id,
      lat: m.location.latitude,
      lon: m.location.longitude,
      name: m.name,
    }));
  const data = JSON.stringify(points);
  const c = JSON.stringify([center.latitude, center.longitude]);

  return `<!DOCTYPE html><html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>html,body,#map{height:100%;margin:0;padding:0;background:#eef1ef}</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var center = ${c};
  var mosques = ${data};
  var map = L.map('map', { zoomControl: false, attributionControl: false }).setView(center, 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  L.circleMarker(center, { radius: 7, color: '#ffffff', weight: 2, fillColor: '${accent}', fillOpacity: 1 })
    .addTo(map).bindPopup('You are here');
  var group = [];
  mosques.forEach(function (m) {
    var mk = L.marker([m.lat, m.lon]).addTo(map).bindPopup(m.name);
    mk.on('click', function () {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(m.id);
    });
    group.push(mk);
  });
  if (group.length) {
    try { map.fitBounds(L.featureGroup(group.concat(L.circleMarker(center))).getBounds().pad(0.3)); } catch (e) {}
  }
</script>
</body></html>`;
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 14,
  },
});
