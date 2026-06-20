import { useMemo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import {
  getPrayerStatus,
  type Coordinates,
  type Mosque,
} from '@salah/core';
import { useTheme } from '../theme';
import { DEFAULT_MADHAB, DEFAULT_METHOD } from '../config';
import { formatHHmm, formatTime, prayerLabel } from '../format';

/**
 * Vector map rendered with MapLibre GL JS inside a WebView. Vector tiles give
 * smooth zoom, rotation and tilt, and a Google/Apple-like look — while staying
 * key-free (OpenFreeMap) and runnable in Expo Go (no native module).
 *
 * Tapping a marker opens a popup showing the next prayer; "Open" posts the id
 * back to RN. Panning posts the new center so the screen can offer "search this
 * area". Pass `style={{ flex: 1 }}` for a full-screen map.
 */
export type MapStyle = 'Streets' | 'Light' | 'Bright' | 'Satellite';

export function MosqueMap({
  center,
  mosques,
  onSelect,
  onMove,
  height,
  style,
  interactive = true,
  defaultStyle = 'Streets',
}: {
  center: Coordinates;
  mosques: Mosque[];
  onSelect?: (id: string) => void;
  onMove?: (center: Coordinates) => void;
  height?: number;
  style?: ViewStyle;
  interactive?: boolean;
  defaultStyle?: MapStyle;
}) {
  const theme = useTheme();

  // Memoize so panning / parent re-renders don't rebuild & reload the WebView.
  const html = useMemo(
    () => buildHtml(center, mosques, theme.primary, interactive, defaultStyle),
    [center.latitude, center.longitude, mosques, theme.primary, interactive, defaultStyle],
  );

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
        onMessage={(e) => {
          try {
            const msg = JSON.parse(e.nativeEvent.data);
            if (msg.t === 'open' && msg.id) onSelect?.(msg.id);
            else if (msg.t === 'move')
              onMove?.({ latitude: msg.lat, longitude: msg.lng });
          } catch {
            // ignore malformed messages
          }
        }}
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
  defaultStyle: MapStyle,
): string {
  const now = new Date();
  const points = mosques
    .filter((m) => Number.isFinite(m.location.latitude))
    .map((m) => {
      const status = getPrayerStatus(m.location, now, {
        method: DEFAULT_METHOD,
        madhab: DEFAULT_MADHAB,
      });
      const nextName = status.next === 'none' ? '' : prayerLabel(status.next);
      const nextAdhan = status.nextTime ? formatTime(status.nextTime) : '';
      const iqamaRaw =
        status.next !== 'none' && status.next !== 'sunrise'
          ? m.times?.iqama?.[status.next]
          : undefined;
      return {
        id: m.id,
        lat: m.location.latitude,
        lon: m.location.longitude,
        name: m.name,
        hasTimes: !!m.times?.iqama || (m.times?.jumuah?.length ?? 0) > 0,
        dist:
          m.distanceMeters != null
            ? m.distanceMeters < 1000
              ? `${Math.round(m.distanceMeters)} m`
              : `${(m.distanceMeters / 1000).toFixed(1)} km`
            : '',
        next: nextName,
        nextAdhan,
        nextIqama: iqamaRaw ? formatHHmm(iqamaRaw) : '',
      };
    });
  const data = JSON.stringify(points);
  const c = JSON.stringify([center.longitude, center.latitude]); // MapLibre = [lng, lat]

  return `<!DOCTYPE html><html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet" />
<style>
  html,body,#map{height:100%;margin:0;padding:0;background:#e9ece9}
  .pin{width:18px;height:18px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45);cursor:pointer}
  .pin.has{background:${accent}}
  .pin.no{background:#9aa6a0}
  .me{width:16px;height:16px;border-radius:50%;background:${accent};border:3px solid #fff;box-shadow:0 0 0 2px rgba(0,0,0,.15)}
  .maplibregl-popup-content{font:600 14px -apple-system,system-ui,sans-serif;border-radius:12px;padding:10px 12px;min-width:140px}
  .maplibregl-popup-content .d{font-weight:500;color:#667;font-size:12px;margin-top:2px}
  .maplibregl-popup-content .n{font-weight:700;color:${accent};font-size:13px;margin-top:6px}
  .maplibregl-popup-content .n small{color:#667;font-weight:500}
  .maplibregl-popup-content .open{display:inline-block;margin-top:8px;color:${accent};font-weight:800}
  .styler{position:absolute;left:10px;bottom:24px;z-index:2;display:flex;gap:6px;background:rgba(255,255,255,.92);padding:5px;border-radius:10px;box-shadow:0 1px 5px rgba(0,0,0,.25)}
  .styler button{border:0;background:#eef1ef;border-radius:7px;padding:6px 9px;font:700 12px -apple-system,system-ui,sans-serif;color:#334}
  .styler button.active{background:${accent};color:#fff}
</style>
</head><body>
<div id="map"></div>
<div class="styler" id="styler"></div>
<script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
<script>
  var center = ${c};
  var mosques = ${data};

  var SAT = {
    version: 8,
    sources: { sat: { type: 'raster', tileSize: 256,
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      attribution: 'Imagery &copy; Esri' } },
    layers: [{ id: 'sat', type: 'raster', source: 'sat' }]
  };
  var STYLES = {
    'Streets': 'https://tiles.openfreemap.org/styles/liberty',
    'Light': 'https://tiles.openfreemap.org/styles/positron',
    'Bright': 'https://tiles.openfreemap.org/styles/bright',
    'Satellite': SAT
  };

  var map = new maplibregl.Map({
    container: 'map',
    style: STYLES['${defaultStyle}'] || STYLES['Streets'],
    center: center,
    zoom: 12,
    attributionControl: true,
    interactive: ${interactive ? 'true' : 'false'}
  });
  ${interactive ? "map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-left');" : ''}

  var meEl = document.createElement('div'); meEl.className = 'me';
  new maplibregl.Marker({ element: meEl }).setLngLat(center).addTo(map);

  window.openMosque = function (id) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({ t: 'open', id: id }));
  };

  var bounds = new maplibregl.LngLatBounds();
  bounds.extend(center);
  mosques.forEach(function (m) {
    var el = document.createElement('div');
    el.className = 'pin ' + (m.hasTimes ? 'has' : 'no');
    var idJson = JSON.stringify(m.id);
    var nextLine = m.next
      ? '<div class="n">Next: ' + m.next + ' ' + m.nextAdhan +
        (m.nextIqama ? ' <small>· Iqama ' + m.nextIqama + '</small>' : '') + '</div>'
      : '';
    var html = '<div>' + m.name + '</div>' +
      (m.dist ? '<div class="d">' + m.dist + ' away</div>' : '') +
      nextLine +
      '<div class="open" onclick=\\'openMosque(' + idJson + ')\\'>Open details &rsaquo;</div>';
    var popup = new maplibregl.Popup({ offset: 22, closeButton: false }).setHTML(html);
    new maplibregl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([m.lon, m.lat]).setPopup(popup).addTo(map);
    bounds.extend([m.lon, m.lat]);
  });

  map.on('load', function () {
    if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 0 });
  });

  // Report user-initiated pans so the app can offer "search this area".
  ${interactive ? `
  map.on('moveend', function (e) {
    if (!e.originalEvent) return; // ignore programmatic moves (fitBounds)
    var ctr = map.getCenter();
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({ t: 'move', lat: ctr.lat, lng: ctr.lng }));
  });
  ` : ''}

  // Style switcher.
  ${interactive ? `
  var current = '${defaultStyle}';
  var styler = document.getElementById('styler');
  Object.keys(STYLES).forEach(function (name) {
    var b = document.createElement('button');
    b.textContent = name;
    if (name === current) b.className = 'active';
    b.onclick = function () {
      if (name === current) return;
      current = name;
      map.setStyle(STYLES[name]);
      Array.prototype.forEach.call(styler.children, function (ch) {
        ch.className = (ch.textContent === name) ? 'active' : '';
      });
    };
    styler.appendChild(b);
  });
  ` : "document.getElementById('styler').style.display='none';"}
</script>
</body></html>`;
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
  },
});
