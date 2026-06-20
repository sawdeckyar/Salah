import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import type { Coordinates, ParkingFeature, ParkingReport } from '@salah/core';
import { useTheme } from '../theme';
import type { MapStyle } from './MosqueMap';

export type ParkingMode = 'browse' | 'point' | 'area';

export interface ParkingMapHandle {
  setMode: (mode: ParkingMode) => void;
  undo: () => void;
  finish: () => void;
  cancel: () => void;
}

/**
 * Parking map (MapLibre GL JS in a WebView). Shows the mosque, OSM parking,
 * and crowdsourced reports as points OR drawn polygons (legal / no / private).
 * Supports drawing an area: tap to add vertices, then finish() to emit the ring.
 * Built once; data is injected; viewport preserved.
 */
export const ParkingMap = forwardRef<
  ParkingMapHandle,
  {
    center: Coordinates;
    osm: ParkingFeature[];
    reports: ParkingReport[];
    onTap?: (c: Coordinates) => void;
    onSelectReport?: (id: string) => void;
    onAddPolygon?: (ring: Coordinates[]) => void;
    style?: ViewStyle;
    height?: number;
    defaultStyle?: MapStyle;
  }
>(function ParkingMap(
  { center, osm, reports, onTap, onSelectReport, onAddPolygon, style, height },
  ref,
) {
  const theme = useTheme();
  const webRef = useRef<WebView>(null);

  const html = useMemo(
    () => buildHtml(center, theme.primary),
    [center.latitude, center.longitude, theme.primary],
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
          kind: r.kind,
          note: r.note || '',
          lat: r.location.latitude,
          lon: r.location.longitude,
          polygon: r.polygon
            ? r.polygon.map((c) => [c.longitude, c.latitude])
            : null,
        })),
      }),
    [osm, reports],
  );

  const run = (js: string) => webRef.current?.injectJavaScript(js + ' true;');
  const inject = () => run(`window.__recv && window.__recv(${payload});`);

  useEffect(() => {
    inject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload]);

  useImperativeHandle(ref, () => ({
    setMode: (m) => run(`window.__setMode && window.__setMode(${JSON.stringify(m)});`),
    undo: () => run('window.__undo && window.__undo();'),
    finish: () => run('window.__finish && window.__finish();'),
    cancel: () => run('window.__cancel && window.__cancel();'),
  }));

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
            else if (msg.t === 'polygon' && Array.isArray(msg.coords))
              onAddPolygon?.(
                msg.coords.map((p: [number, number]) => ({
                  longitude: p[0],
                  latitude: p[1],
                })),
              );
          } catch {
            // ignore
          }
        }}
        scrollEnabled={false}
      />
    </View>
  );
});

function buildHtml(center: Coordinates, accent: string): string {
  const c = JSON.stringify([center.longitude, center.latitude]);
  const KIND_COLOR =
    "['match',['get','kind'],'legal','#16a34a','no','#dc2626','private','#d97706','#888']";
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet" />
<style>
  html,body,#map{height:100%;margin:0;padding:0;background:#e9ece9}
  .mosque{width:18px;height:18px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${accent};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45)}
  .maplibregl-popup-content{font:600 13px -apple-system,system-ui,sans-serif;border-radius:10px;padding:8px 10px}
</style>
</head><body>
<div id="map"></div>
<script>
  window.__data = null; window.__mode = 'browse'; window.__draw = [];
  window.__recv = function (p) { window.__data = p; if (window.__render) window.__render(p); };
</script>
<script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
<script>
  var center = ${c};
  var KIND = ${KIND_COLOR};
  var EMPTY = { type: 'FeatureCollection', features: [] };
  var map = new maplibregl.Map({
    container: 'map', style: 'https://tiles.openfreemap.org/styles/liberty',
    center: center, zoom: 16, attributionControl: true
  });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-left');

  var mEl = document.createElement('div'); mEl.className = 'mosque';
  new maplibregl.Marker({ element: mEl, anchor: 'bottom' }).setLngLat(center)
    .setPopup(new maplibregl.Popup({ offset: 18, closeButton: false }).setHTML('Mosque')).addTo(map);

  window.post = function (o) { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(o)); };

  var didFit = false;
  map.on('load', function () {
    map.addSource('osm', { type: 'geojson', data: EMPTY });
    map.addLayer({ id: 'osm-pts', type: 'circle', source: 'osm',
      paint: { 'circle-radius': 7, 'circle-color': '#2563eb', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } });

    map.addSource('rpoly', { type: 'geojson', data: EMPTY });
    map.addLayer({ id: 'rpoly-fill', type: 'fill', source: 'rpoly', paint: { 'fill-color': KIND, 'fill-opacity': 0.3 } });
    map.addLayer({ id: 'rpoly-line', type: 'line', source: 'rpoly', paint: { 'line-color': KIND, 'line-width': 2 } });

    map.addSource('rpt', { type: 'geojson', data: EMPTY });
    map.addLayer({ id: 'rpt-circle', type: 'circle', source: 'rpt',
      paint: { 'circle-radius': 8, 'circle-color': KIND, 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } });

    map.addSource('draw', { type: 'geojson', data: EMPTY });
    map.addLayer({ id: 'draw-fill', type: 'fill', source: 'draw', filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': '#2563eb', 'fill-opacity': 0.2 } });
    map.addLayer({ id: 'draw-line', type: 'line', source: 'draw', filter: ['==', '$type', 'LineString'], paint: { 'line-color': '#2563eb', 'line-width': 2, 'line-dasharray': [2, 1] } });
    map.addLayer({ id: 'draw-verts', type: 'circle', source: 'draw', filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 5, 'circle-color': '#fff', 'circle-stroke-color': '#2563eb', 'circle-stroke-width': 2 } });

    map.on('click', 'osm-pts', function (e) {
      if (window.__mode !== 'browse') return;
      var f = e.features[0];
      new maplibregl.Popup({ closeButton: false }).setLngLat(f.geometry.coordinates)
        .setHTML(f.properties.name + (f.properties.access ? ' · ' + f.properties.access : '')).addTo(map);
    });
    function selectReport(e) {
      if (window.__mode !== 'browse') return;
      window.post({ t: 'report', id: e.features[0].properties.id });
    }
    map.on('click', 'rpt-circle', selectReport);
    map.on('click', 'rpoly-fill', selectReport);

    map.on('click', function (e) {
      var ll = [e.lngLat.lng, e.lngLat.lat];
      if (window.__mode === 'area') { window.__draw.push(ll); updateDraw(); }
      else if (window.__mode === 'point') { window.post({ t: 'tap', lat: e.lngLat.lat, lng: e.lngLat.lng }); }
    });

    if (window.__data) window.__render(window.__data);
  });

  function fcPoints(list, mapFn) { return { type: 'FeatureCollection', features: list.map(mapFn) }; }

  window.__render = function (p) {
    if (!map.getSource('osm')) return;
    var bounds = new maplibregl.LngLatBounds(); bounds.extend(center);

    map.getSource('osm').setData(fcPoints(p.osm || [], function (o) {
      bounds.extend([o.lon, o.lat]);
      return { type: 'Feature', geometry: { type: 'Point', coordinates: [o.lon, o.lat] }, properties: { name: o.name, access: o.access } };
    }));

    var pts = (p.reports || []).filter(function (r) { return !r.polygon; });
    var polys = (p.reports || []).filter(function (r) { return r.polygon && r.polygon.length >= 3; });

    map.getSource('rpt').setData(fcPoints(pts, function (r) {
      bounds.extend([r.lon, r.lat]);
      return { type: 'Feature', geometry: { type: 'Point', coordinates: [r.lon, r.lat] }, properties: { id: r.id, kind: r.kind } };
    }));
    map.getSource('rpoly').setData(fcPoints(polys, function (r) {
      var ring = r.polygon.slice(); ring.push(ring[0]);
      ring.forEach(function (pt) { bounds.extend(pt); });
      return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: { id: r.id, kind: r.kind } };
    }));

    if (!didFit) { didFit = true; if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 70, maxZoom: 17, duration: 0 }); }
  };

  function updateDraw() {
    if (!map.getSource('draw')) return;
    var feats = [];
    if (window.__draw.length >= 2) feats.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: window.__draw } });
    if (window.__draw.length >= 3) feats.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [window.__draw.concat([window.__draw[0]])] } });
    window.__draw.forEach(function (pt) { feats.push({ type: 'Feature', geometry: { type: 'Point', coordinates: pt } }); });
    map.getSource('draw').setData({ type: 'FeatureCollection', features: feats });
  }

  window.__setMode = function (m) { window.__mode = m; if (m !== 'area') { window.__draw = []; updateDraw(); } };
  window.__undo = function () { window.__draw.pop(); updateDraw(); };
  window.__cancel = function () { window.__draw = []; updateDraw(); };
  window.__finish = function () {
    if (window.__draw.length >= 3) window.post({ t: 'polygon', coords: window.__draw.slice() });
    window.__draw = []; updateDraw();
  };
</script>
</body></html>`;
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
});
