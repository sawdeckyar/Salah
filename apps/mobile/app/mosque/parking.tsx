import { useCallback, useEffect, useState } from 'react';
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
import { ParkingMap } from '../../src/components/ParkingMap';
import { Message } from '../../src/components/StateView';
import { getMosque } from '../../src/data/mosqueStore';
import {
  addParking,
  getParkingFor,
  removeParking,
  subscribeParking,
} from '../../src/data/parkingStore';
import { httpDeps } from '../../src/config';
import { useTheme } from '../../src/theme';

const KINDS: { kind: ParkingKind; label: string; color: (t: any) => string }[] = [
  { kind: 'legal', label: 'Legal', color: () => '#16a34a' },
  { kind: 'no', label: 'No parking', color: () => '#dc2626' },
  { kind: 'private', label: 'Private', color: () => '#d97706' },
];

export default function ParkingScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const mosque = id ? getMosque(id) : undefined;

  const [osm, setOsm] = useState<ParkingFeature[]>([]);
  const [addKind, setAddKind] = useState<ParkingKind | null>(null);
  const [note, setNote] = useState('');
  const [reports, setReports] = useState<ParkingReport[]>(
    id ? getParkingFor(id) : [],
  );

  // Keep reports in sync with the local store.
  useEffect(() => {
    if (!id) return;
    setReports(getParkingFor(id));
    return subscribeParking(() => setReports(getParkingFor(id)));
  }, [id]);

  // Fetch OSM parking around the mosque.
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
      if (!id || !addKind) return;
      addParking(id, addKind, coords, note);
      setNote('');
    },
    [id, addKind, note],
  );

  const onSelectReport = useCallback(
    (reportId: string) => {
      if (!id) return;
      Alert.alert('Remove report?', 'Delete this parking marker?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeParking(id, reportId),
        },
      ]);
    },
    [id],
  );

  if (!mosque) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <Stack.Screen options={{ title: 'Parking' }} />
        <Message
          title="Mosque not found"
          detail="Open this from a mosque’s detail screen."
        />
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <Stack.Screen options={{ title: 'Parking', headerShown: true }} />

      <ParkingMap
        center={mosque.location}
        osm={osm}
        reports={reports}
        onTap={onTap}
        onSelectReport={onSelectReport}
        style={{ flex: 1 }}
      />

      {/* Add-mode controls */}
      <View style={[styles.addBar, { top: insets.top + 8 }]} pointerEvents="box-none">
        <View style={[styles.chips, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {KINDS.map((k) => {
            const active = addKind === k.kind;
            return (
              <TouchableOpacity
                key={k.kind}
                onPress={() => setAddKind(active ? null : k.kind)}
                style={[
                  styles.chip,
                  { borderColor: k.color(theme) },
                  active && { backgroundColor: k.color(theme) },
                ]}
              >
                <Text style={{ color: active ? '#fff' : k.color(theme), fontWeight: '800', fontSize: 13 }}>
                  {k.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {addKind && (
          <View style={[styles.noteRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Optional note (e.g. street side, after 6pm)…"
              placeholderTextColor={theme.text3}
              style={[styles.noteInput, { color: theme.text }]}
            />
            <Text style={[styles.hint, { color: theme.text3 }]}>
              Tap the map to drop a “{KINDS.find((x) => x.kind === addKind)!.label}” pin.
            </Text>
          </View>
        )}
      </View>

      {/* Legend */}
      <View
        style={[
          styles.legend,
          { backgroundColor: theme.surface, borderColor: theme.border, bottom: insets.bottom + 12 },
        ]}
      >
        <Legend color="#2563eb" label={`${osm.length} OSM lots`} />
        <Legend color="#16a34a" label="Legal" />
        <Legend color="#dc2626" label="No" />
        <Legend color="#d97706" label="Private" />
      </View>
    </View>
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
  addBar: { position: 'absolute', left: 12, right: 12, gap: 8 },
  chips: {
    flexDirection: 'row',
    gap: 8,
    padding: 6,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'center',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9,
    borderWidth: 1.5,
  },
  noteRow: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
    gap: 4,
  },
  noteInput: { fontSize: 14, paddingVertical: 4 },
  hint: { fontSize: 12 },
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
