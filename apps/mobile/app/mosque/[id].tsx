import { useMemo, useState } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import {
  applyConfirmation,
  calculatePrayerTimes,
  candidateFromExtraction,
} from '@salah/core';
import type { TimeCandidate } from '@salah/core';
import { Screen } from '../../src/components/Screen';
import { Card } from '../../src/components/Card';
import { PrayerList } from '../../src/components/PrayerList';
import { TrustBadge } from '../../src/components/TrustBadge';
import { Message } from '../../src/components/StateView';
import { getMosque } from '../../src/data/mosqueStore';
import { useTheme } from '../../src/theme';
import { DEFAULT_MADHAB, DEFAULT_METHOD } from '../../src/config';
import { formatDistance, formatHHmm } from '../../src/format';

export default function MosqueDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const mosque = id ? getMosque(id) : undefined;

  // Local, in-memory crowd-confirm state seeded from the mosque's times — this
  // exercises the real @salah/core trust ladder. A later iteration persists it.
  const [candidate, setCandidate] = useState<TimeCandidate | null>(() =>
    mosque?.times
      ? candidateFromExtraction(`local:${mosque.id}`, mosque.id, {
          times: mosque.times,
        })
      : null,
  );

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

  const vote = (v: 'confirm' | 'dispute') =>
    setCandidate((c) => (c ? applyConfirmation(c, { vote: v }) : c));

  const times = candidate?.times ?? mosque.times;
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

      {adhan && (
        <Card>
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            Prayer times
          </Text>
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
            {times.provenance?.sourceUrl
              ? ` Source: ${times.provenance.method}.`
              : ''}
          </Text>
          <View style={styles.voteRow}>
            <VoteButton
              label="✓ Correct"
              color={theme.success}
              onPress={() => vote('confirm')}
            />
            <VoteButton
              label="✗ Wrong"
              color={theme.danger}
              onPress={() => vote('dispute')}
            />
          </View>
          {candidate && (
            <Text style={{ color: theme.text3, fontSize: 12, marginTop: 10 }}>
              {candidate.confirms} confirmed · {candidate.disputes} disputed ·
              status: {candidate.status}
            </Text>
          )}
        </Card>
      ) : (
        <Card>
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            No congregation times yet
          </Text>
          <Text style={{ color: theme.text3, fontSize: 14 }}>
            This mosque’s iqama and Jumu‘ah times haven’t been submitted. A future
            update lets you add them for the community.
          </Text>
        </Card>
      )}
    </Screen>
  );
}

function LinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.linkBtn, { borderColor: theme.primary }]}
    >
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
});
