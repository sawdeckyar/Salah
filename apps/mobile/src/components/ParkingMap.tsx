import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import type { Coordinates, ParkingFeature, ParkingReport } from '@salah/core';
import { useTheme } from '../theme';
import type { MapStyle } from './MosqueMap';

/**
 * Parking map (MapLibre GL JS in a WebView). Shows the mosque, OSM parking
 * facilities, and crowdsourced parking reports (legal / no-parking / private).
 * Tapping empty map posts the tapped coordinate (for adding a report); tapping
 * a report marker posts its id (for removal). Built once; data is injected.
 */
export function ParkingMap({
  center,
  osm,
  reports,
  onTap,
  onSelectReport,
  style,
  height,
  defaultStyle = 'Streets',
}: {
  center: Coordinates;
  osm: ParkingFeature[];
  reports: ParkingReport[];
  onTap?: (c: Coordinates) => void;
  onSelectReport?: (id: string) => void;
  style?: ViewStyle;
  height?: number;
  defaultStyle?: MapStyle;
}) {
  const theme = useTheme();
  const webRef = useRef<WebView>(null);

  const html = useMemo(
    () => buildHtml(center, theme.primary, defaultStyle),
    [center.latitude, center.longitude, theme.primary, defaultStyle],
  );

  const payload = useMemo(
    () =>
      JSON.stringify({
        osm: osm
          .filter((p) => Number.isFinite(p.location.latitude))
          .map((p) => ({
            lat: p.location.latitude,
            lon: p.location.longitude,
            name: p.name || 'Parking',
            access: p.access || '',
          })),
        reports: reports.map((r) => ({
          id: r.id,
          lat: r.location.latitude,
          lon: r.location.longitude,
          kind: r.kind,
          note: r.note || '',
        })),
      }),
    [osm, reports],
  );

  const inject = () => {
    webRef.current?.injectJavaScript(
      `window.__recv && window.__recv(${payload}); true;`,
    );
  };

  useEffect(() => {
    inject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload]);

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
        ref={webRef}
        originWhitelist={['*']}
        source={{ html }}
        style={{ backgroundColor: theme.surface2 }}
        onLoadEnd={inject}
        onMessage={(e) => {
          try {
            const msg = JSON.parse(e.nativeEvent.data);
            if (msg.t === 'tap') onTap?.({ latitude: msg.lat, longitude: msg.lng });
            else if (msg.t === 'report' && msg.id) onSelectReport?.(msg.id);
          } catch {
            // ignore
          }
        }}
        scrollEnabled={false}
      />
    </View>
  );
}

function buildHtml(center: Coordinates, accent: string, defaultStyle: MapStyle): string {
  const c = JSON.stringify([center.longitude, center.latitude]);
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet" />
<style>
  html,body,#map{height:100%;margin:0;padding:0;background:#e9ece9}
  .mosque{width:18px;height:18px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${accent};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45)}
  .dot{width:22px;height:22px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;color:#fff;font:800 12px -apple-system,system-ui,sans-serif;cursor:pointer}
  .dot.osm{background:#2563eb}
  .dot.legal{background:#16a34a}
  .dot.no{background:#dc2626}
  .dot.private{background:#d97706}
  .maplibregl-popup-content{font:600 13px -apple-system,system-ui,sans-serif;border-radius:10px;padding:8px 10px}
</style>
</head><body>
<div id="map"></div>
<script>
  window.__data = null;
  window.__recv = function (p) { window.__data = p; if (window.__render) window.__render(p); };
</script>
<script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
<script>
  var center = ${c};
  var map = new maplibregl.Map({
    container: 'map', style: 'https://tiles.openfreemap.org/styles/liberty',
    center: center, zoom: 16, attributionControl: true
  });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-left');

  var mEl = document.createElement('div'); mEl.className = 'mosque';
  new maplibregl.Marker({ element: mEl, anchor: 'bottom' }).setLngLat(center)
    .setPopup(new maplibregl.Popup({ offset: 18, closeButton: false }).setHTML('Mosque')).addTo(map);

  window.post = function (o) { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(o)); };

  var markers = [];
  var didFit = false;
  window.__render = function (p) {
    markers.forEach(function (mk) { mk.remove(); });
    markers = [];
    var bounds = new maplibregl.LngLatBounds();
    bounds.extend(center);

    (p.osm || []).forEach(function (o) {
      var el = document.createElement('div'); el.className = 'dot osm'; el.textContent = 'P';
      var mk = new maplibregl.Marker({ element: el })
        .setLngLat([o.lon, o.lat])
        .setPopup(new maplibregl.Popup({ offset: 14, closeButton: false })
          .setHTML(o.name + (o.access ? ' · ' + o.access : '')))
        .addTo(map);
      markers.push(mk); bounds.extend([o.lon, o.lat]);
    });

    (p.reports || []).forEach(function (r) {
      var el = document.createElement('div');
      el.className = 'dot ' + r.kind;
      el.textContent = r.kind === 'no' ? '⛔' : (r.kind === 'private' ? '!' : 'P');
      el.onclick = function () { window.post({ t: 'report', id: r.id }); };
      var label = (r.kind === 'no' ? 'No parking' : r.kind === 'private' ? 'Private/permit' : 'Legal parking') + (r.note ? ' — ' + r.note : '') + '<br><small>tap to remove</small>';
      var mk = new maplibregl.Marker({ element: el })
        .setLngLat([r.lon, r.lat])
        .setPopup(new maplibregl.Popup({ offset: 14, closeButton: false }).setHTML(label))
        .addTo(map);
      markers.push(mk); bounds.extend([r.lon, r.lat]);
    });

    if (!didFit) { didFit = true; if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 70, maxZoom: 17, duration: 0 }); }
  };

  map.on('load', function () { if (window.__data) window.__render(window.__data); });
  map.on('click', function (e) { window.post({ t: 'tap', lat: e.lngLat.lat, lng: e.lngLat.lng }); });
</script>
</body></html>`;
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
});
