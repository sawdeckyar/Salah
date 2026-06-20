import { StyleSheet, View, type ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import type { Coordinates, Mosque } from '@salah/core';
import { useTheme } from '../theme';

/**
 * A key-free OpenStreetMap map rendered with Leaflet inside a WebView. Avoids
 * native map modules (and Google API keys), and runs in Expo Go. Tapping a
 * marker posts the mosque id back to React Native.
 *
 * Pass `style={{ flex: 1 }}` for a full-screen map, or `height` for a fixed box.
 */
export function MosqueMap({
  center,
  mosques,
  onSelect,
  height,
  style,
  interactive = true,
}: {
  center: Coordinates;
  mosques: Mosque[];
  onSelect?: (id: string) => void;
  height?: number;
  style?: ViewStyle;
  interactive?: boolean;
}) {
  const theme = useTheme();
  const html = buildHtml(center, mosques, theme.primary, interactive);

  return (
    <View
      style={[
        styles.wrap,
        height != null ? { height } : { flex: 1 },
        { borderColor: theme.border },
        style,
      ]}
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
  interactive: boolean,
): string {
  const points = mosques
    .filter((m) => Number.isFinite(m.location.latitude))
    .map((m) => ({
      id: m.id,
      lat: m.location.latitude,
      lon: m.location.longitude,
      name: m.name,
      hasTimes:
        !!m.times?.iqama || (m.times?.jumuah?.length ?? 0) > 0,
      dist:
        m.distanceMeters != null
          ? m.distanceMeters < 1000
            ? `${Math.round(m.distanceMeters)} m`
            : `${(m.distanceMeters / 1000).toFixed(1)} km`
          : '',
    }));
  const data = JSON.stringify(points);
  const c = JSON.stringify([center.latitude, center.longitude]);
  const interactionOpts = interactive
    ? 'zoomControl: true'
    : 'zoomControl: false, dragging: false, touchZoom: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, tap: false';

  // Two pin colors: green = has community times, grey = times not submitted.
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html,body,#map{height:100%;margin:0;padding:0;background:#eef1ef}
  .pin{width:18px;height:18px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)}
  .pin.has{background:${accent}}
  .pin.no{background:#9aa6a0}
  .leaflet-popup-content{font:600 14px -apple-system,system-ui,sans-serif;margin:10px 12px}
  .leaflet-popup-content .d{font-weight:500;color:#667;font-size:12px}
</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var center = ${c};
  var mosques = ${data};
  var map = L.map('map', { ${interactionOpts}, attributionControl: true }).setView(center, 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  L.circleMarker(center, { radius: 7, color: '#ffffff', weight: 2, fillColor: '${accent}', fillOpacity: 1 })
    .addTo(map).bindPopup('You are here');

  function pinIcon(hasTimes) {
    return L.divIcon({
      className: '',
      html: '<div class="pin ' + (hasTimes ? 'has' : 'no') + '"></div>',
      iconSize: [18, 18], iconAnchor: [9, 18], popupAnchor: [0, -16]
    });
  }

  var group = [];
  mosques.forEach(function (m) {
    var mk = L.marker([m.lat, m.lon], { icon: pinIcon(m.hasTimes) }).addTo(map);
    var popup = '<div>' + m.name + '</div>' + (m.dist ? '<div class="d">' + m.dist + ' away — tap pin again to open</div>' : '');
    mk.bindPopup(popup);
    mk.on('click', function () {
      if (mk.isPopupOpen && mk.isPopupOpen()) {
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(m.id);
      } else {
        mk.openPopup();
      }
    });
    group.push(mk);
  });

  if (group.length) {
    try {
      var fg = L.featureGroup(group.concat(L.circleMarker(center)));
      map.fitBounds(fg.getBounds().pad(0.3), { maxZoom: 15 });
    } catch (e) {}
  }
</script>
</body></html>`;
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
  },
});
