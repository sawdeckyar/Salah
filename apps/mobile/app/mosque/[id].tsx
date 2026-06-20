import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  applyConfirmation,
  calculatePrayerTimes,
  candidateFromExtraction,
} from '@salah/core';
import type { MosqueTimes, TimeCandidate } from '@salah/core';
import { Screen } from '../../src/components/Screen';
import { Card } from '../../src/components/Card';
import { PrayerList } from '../../src/components/PrayerList';
import { TrustBadge } from '../../src/components/TrustBadge';
import { Message } from '../../src/components/StateView';
import { getMosque } from '../../src/data/mosqueStore';
import { getLocalTimesFor } from '../../src/data/localSubmissions';
import { confirmTimes } from '../../src/data/remote';
import { useTheme } from '../../src/theme';
import { DEFAULT_MADHAB, DEFAULT_METHOD } from '../../src/config';
import { formatDistance, formatHHmm } from '../../src/format';

export default function MosqueDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const mosque = id ? getMosque(id) : undefined;

  // Re-read local submissions whenever the screen regains focus (e.g. after
  // returning from the submit form).
  const [tick, setTick] = useState(0);
  useFocusEffect(useCallback(() => setTick((t) => t + 1), []));

  // Effective times = local crowdsourced submission (if any) over registry/OSM.
  const effectiveTimes: MosqueTimes | undefined = useMemo(
    () => (id ? getLocalTimesFor(id) : undefined) ?? mosque?.times,
    [id, tick, mosque],
  );

  // Crowd-confirm candidate, re-seeded when the effective times change. This
  // drives the real @salah/core trust ladder.
  const [candidate, setCandidate] = useState<TimeCandidate | null>(null);
  useEffect(() => {
    setCandidate(
      effectiveTimes && id
        ? candidateFromExtraction(`local:${id}`, id, { times: effectiveTimes })
        : null,
    );
  }, [effectiveTimes, id]);

  const adhan = useMemo(
    () =>
      mosque
        ? calculatePrayerTimes(mosque.location, new Date(), {
            method: DEFAULT_METHOD,
            madhab: DEFAULT_MADHAB,
          })
        : null,
    [mosque?.location.latitude, mosque?.location.longitude],
  );

  if (!mosque) {
    return (
      <Screen title="Mosque">
        <Stack.Screen options={{ title: 'Mosque' }} />
        <Message
          title="Mosque not found"
          detail="Open this mosque from the Nearby tab to view its details."
        />
      </Screen>
    );
  }

  const vote = (v: 'confirm' | 'dispute') => {
    setCandidate((c) => (c ? applyConfirmation(c, { vote: v }) : c));
    confirmTimes(mosque.id, v).catch(() => {}); // shared trust ladder (no-op offline)
  };

  const goEdit = () =>
    router.push({ pathname: '/submit', params: { id: mosque.id, name: mosque.name } });

  const times = candidate?.times ?? effectiveTimes;
  const jumuah = times?.jumuah ?? [];

  return (
    <Screen title={mosque.name} subtitle={mosque.address ?? mosque.city}>
      <Stack.Screen options={{ title: mosque.name }} />

      <View style={styles.metaRow}>
        {mosque.distanceMeters != null && (
          <Text style={[styles.meta, { color: theme.primary }]}>
            {formatDistance(mosque.distanceMeters)} away
          </Text>
        )}
        <TrustBadge times={times} />
      </View>

      {(mosque.contact?.website || mosque.contact?.phone) && (
        <View style={styles.links}>
          {mosque.contact?.website && (
            <LinkButton
              label="Website"
              onPress={() => Linking.openURL(mosque.contact!.website!)}
            />
          )}
          {mosque.contact?.phone && (
            <LinkButton
              label="Call"
              onPress={() => Linking.openURL(`tel:${mosque.contact!.phone}`)}
            />
          )}
        </View>
      )}

      <TouchableOpacity
        onPress={() =>
          router.push({ pathname: '/mosque/parking', params: { id: mosque.id } })
        }
        style={[styles.parkingBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        <Text style={[styles.parkingText, { color: theme.text }]}>🅿️  Parking nearby</Text>
        <Text style={{ color: theme.text3 }}>›</Text>
      </TouchableOpacity>

      {adhan && (
        <Card>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Prayer times</Text>
          <PrayerList times={adhan.times} iqama={times?.iqama} />
        </Card>
      )}

      {jumuah.length > 0 && (
        <Card>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Jumu‘ah</Text>
          {jumuah.map((j, i) => (
            <View key={i} style={[styles.jRow, { borderTopColor: theme.border }]}>
              <Text style={[styles.jLabel, { color: theme.text }]}>
                {j.label ?? `Service ${i + 1}`}
                {j.language ? ` · ${j.language}` : ''}
              </Text>
              <Text style={[styles.jTime, { color: theme.text2 }]}>
                {formatHHmm(j.khutbahTime)}
              </Text>
            </View>
          ))}
        </Card>
      )}

      {times ? (
        <Card>
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            Are these times correct?
          </Text>
          <Text style={{ color: theme.text3, fontSize: 13, marginBottom: 12 }}>
            Community confirmations help others trust these times.
          </Text>
          <View style={styles.voteRow}>
            <VoteButton label="✓ Correct" color={theme.success} onPress={() => vote('confirm')} />
            <VoteButton label="✗ Wrong" color={theme.danger} onPress={() => vote('dispute')} />
          </View>
          {candidate && (
            <Text style={{ color: theme.text3, fontSize: 12, marginTop: 10 }}>
              {candidate.confirms} confirmed · {candidate.disputes} disputed · status:{' '}
              {candidate.status}
            </Text>
          )}
          <TouchableOpacity onPress={goEdit} style={styles.editLink}>
            <Text style={{ color: theme.primary, fontWeight: '700' }}>Edit these times ›</Text>
          </TouchableOpacity>
        </Card>
      ) : (
        <Card>
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            No congregation times yet
          </Text>
          <Text style={{ color: theme.text3, fontSize: 14, marginBottom: 14 }}>
            This mosque’s iqama and Jumu‘ah times haven’t been submitted. Add them
            to help the community.
          </Text>
          <TouchableOpacity onPress={goEdit} style={[styles.addBtn, { backgroundColor: theme.primary }]}>
            <Text style={styles.addText}>+ Add times</Text>
          </TouchableOpacity>
        </Card>
      )}
    </Screen>
  );
}

function LinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <TouchableOpacity onPress={onPress} style={[styles.linkBtn, { borderColor: theme.primary }]}>
      <Text style={{ color: theme.primary, fontWeight: '700' }}>{label}</Text>
    </TouchableOpacity>
  );
}

function VoteButton({
  label,
  color,
  onPress,
}: {
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.voteBtn, { backgroundColor: color + '1A', borderColor: color }]}
    >
      <Text style={{ color, fontWeight: '800' }}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  meta: { fontSize: 15, fontWeight: '700' },
  links: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  linkBtn: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  cardTitle: { fontSize: 17, fontWeight: '800', marginBottom: 10 },
  jRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  jLabel: { fontSize: 15, fontWeight: '600' },
  jTime: { fontSize: 15, fontVariant: ['tabular-nums'] },
  voteRow: { flexDirection: 'row', gap: 12 },
  voteBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  parkingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
  },
  parkingText: { fontSize: 16, fontWeight: '700' },
  editLink: { marginTop: 14, alignItems: 'center' },
  addBtn: { borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  addText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
