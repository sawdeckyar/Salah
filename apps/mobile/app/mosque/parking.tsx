import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams } from 'expo-router';
import {
  fetchNearbyParking,
  type Coordinates,
  type ParkingFeature,
  type ParkingKind,
  type ParkingReport,
} from '@salah/core';
import {
  ParkingMap,
  type ParkingMapHandle,
} from '../../src/components/ParkingMap';
import { Message } from '../../src/components/StateView';
import { getMosque } from '../../src/data/mosqueStore';
import {
  addParking,
  addParkingArea,
  getParkingFor,
  refreshParking,
  removeParking,
  subscribeParking,
} from '../../src/data/parkingStore';
import { httpDeps } from '../../src/config';
import { useTheme } from '../../src/theme';

const KINDS: { kind: ParkingKind; label: string; color: string }[] = [
  { kind: 'legal', label: 'Legal', color: '#16a34a' },
  { kind: 'no', label: 'No parking', color: '#dc2626' },
  { kind: 'private', label: 'Private', color: '#d97706' },
];

export default function ParkingScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const mosque = id ? getMosque(id) : undefined;
  const mapRef = useRef<ParkingMapHandle>(null);

  const [osm, setOsm] = useState<ParkingFeature[]>([]);
  const [kind, setKind] = useState<ParkingKind | null>(null);
  const [tool, setTool] = useState<'point' | 'area'>('point');
  const [note, setNote] = useState('');
  const [reports, setReports] = useState<ParkingReport[]>(
    id ? getParkingFor(id) : [],
  );

  const mode = kind ? tool : 'browse';
  useEffect(() => {
    mapRef.current?.setMode(mode);
  }, [mode]);

  useEffect(() => {
    if (!id) return;
    setReports(getParkingFor(id));
    refreshParking(id); // pull from backend when configured
    return subscribeParking(() => setReports(getParkingFor(id)));
  }, [id]);

  useEffect(() => {
    if (!mosque) return;
    let active = true;
    fetchNearbyParking(mosque.location, { radiusMeters: 700 }, httpDeps)
      .then((p) => active && setOsm(p))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [mosque?.location.latitude, mosque?.location.longitude]);

  const onTap = useCallback(
    (coords: Coordinates) => {
      if (!id || !kind || tool !== 'point') return;
      addParking(id, kind, coords, note);
      setNote('');
    },
    [id, kind, tool, note],
  );

  const onAddPolygon = useCallback(
    (ring: Coordinates[]) => {
      if (!id || !kind) return;
      addParkingArea(id, kind, ring, note);
      setNote('');
    },
    [id, kind, note],
  );

  const onSelectReport = useCallback(
    (reportId: string) => {
      if (!id) return;
      Alert.alert('Remove report?', 'Delete this parking marker/area?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeParking(id, reportId) },
      ]);
    },
    [id],
  );

  if (!mosque) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <Stack.Screen options={{ title: 'Parking' }} />
        <Message title="Mosque not found" detail="Open this from a mosque’s detail screen." />
      </View>
    );
  }

  const activeColor = KINDS.find((k) => k.kind === kind)?.color ?? theme.primary;

  return (
    <View style={styles.fill}>
      <Stack.Screen options={{ title: 'Parking', headerShown: true }} />

      <ParkingMap
        ref={mapRef}
        center={mosque.location}
        osm={osm}
        reports={reports}
        onTap={onTap}
        onAddPolygon={onAddPolygon}
        onSelectReport={onSelectReport}
        style={{ flex: 1 }}
      />

      {/* Controls */}
      <View style={[styles.bar, { top: insets.top + 8 }]} pointerEvents="box-none">
        <View style={[styles.chips, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {KINDS.map((k) => {
            const active = kind === k.kind;
            return (
              <TouchableOpacity
                key={k.kind}
                onPress={() => setKind(active ? null : k.kind)}
                style={[styles.chip, { borderColor: k.color }, active && { backgroundColor: k.color }]}
              >
                <Text style={{ color: active ? '#fff' : k.color, fontWeight: '800', fontSize: 13 }}>
                  {k.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {kind && (
          <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.toolRow}>
              <ToolBtn label="📍 Drop pin" active={tool === 'point'} color={activeColor} onPress={() => setTool('point')} />
              <ToolBtn label="✏️ Draw area" active={tool === 'area'} color={activeColor} onPress={() => setTool('area')} />
            </View>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Optional note (e.g. after 6pm, street side)…"
              placeholderTextColor={theme.text3}
              style={[styles.note, { color: theme.text, borderColor: theme.border }]}
            />
            <Text style={[styles.hint, { color: theme.text3 }]}>
              {tool === 'point'
                ? 'Tap the map to drop a pin.'
                : 'Tap to add corners, then Finish (3+ points).'}
            </Text>
            {tool === 'area' && (
              <View style={styles.drawRow}>
                <SmallBtn label="Undo" onPress={() => mapRef.current?.undo()} color={theme.text2} border={theme.border} />
                <SmallBtn label="Cancel" onPress={() => mapRef.current?.cancel()} color={theme.danger} border={theme.border} />
                <SmallBtn label="Finish" onPress={() => mapRef.current?.finish()} color="#fff" bg={activeColor} border={activeColor} />
              </View>
            )}
          </View>
        )}
      </View>

      {/* Legend */}
      <View style={[styles.legend, { backgroundColor: theme.surface, borderColor: theme.border, bottom: insets.bottom + 12 }]}>
        <Legend color="#2563eb" label={`${osm.length} lots`} />
        <Legend color="#16a34a" label="Legal" />
        <Legend color="#dc2626" label="No" />
        <Legend color="#d97706" label="Private" />
      </View>
    </View>
  );
}

function ToolBtn({ label, active, color, onPress }: { label: string; active: boolean; color: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.toolBtn, { borderColor: active ? color : theme.border }, active && { backgroundColor: color + '22' }]}
    >
      <Text style={{ color: active ? color : theme.text2, fontWeight: '700', fontSize: 13 }}>{label}</Text>
    </TouchableOpacity>
  );
}

function SmallBtn({ label, onPress, color, bg, border }: { label: string; onPress: () => void; color: string; bg?: string; border: string }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.smallBtn, { borderColor: border, backgroundColor: bg ?? 'transparent' }]}
    >
      <Text style={{ color, fontWeight: '800', fontSize: 13 }}>{label}</Text>
    </TouchableOpacity>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  const theme = useTheme();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={{ color: theme.text2, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bar: { position: 'absolute', left: 12, right: 12, gap: 8 },
  chips: {
    flexDirection: 'row',
    gap: 8,
    padding: 6,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'center',
  },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9, borderWidth: 1.5 },
  panel: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 10, gap: 8 },
  toolRow: { flexDirection: 'row', gap: 8 },
  toolBtn: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 9, borderWidth: 1.5 },
  note: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  hint: { fontSize: 12 },
  drawRow: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  smallBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 9, borderWidth: 1.5 },
  legend: {
    position: 'absolute',
    left: 12,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
});
