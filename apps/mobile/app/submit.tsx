import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  IQAMA_PRAYERS,
  normalizeTime,
  validateMosqueTimes,
  type IqamaPrayer,
  type JumuahService,
  type MosqueTimes,
  type Prayer,
} from '@salah/core';
import { getMosque } from '../src/data/mosqueStore';
import { getLocalTimesFor, saveLocalTimes } from '../src/data/localSubmissions';
import { useTheme } from '../src/theme';
import { prayerLabel } from '../src/format';

type JEntry = { khutbahTime: string; language: string };

/** Parse a user time field. Returns 'HH:mm' | null (empty) | 'BAD'. */
function parseField(input: string, prayer: Prayer): string | null | 'BAD' {
  const v = input.trim();
  if (!v) return null;
  const m = v.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (!m) return 'BAD';
  return normalizeTime(m[1], m[2], m[3], prayer) ?? 'BAD';
}

export default function SubmitScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();

  const existing =
    (id ? getLocalTimesFor(id) : undefined) ??
    (id ? getMosque(id)?.times : undefined);

  const [iqama, setIqama] = useState<Record<IqamaPrayer, string>>(() => {
    const init = {} as Record<IqamaPrayer, string>;
    for (const p of IQAMA_PRAYERS) init[p] = existing?.iqama?.[p] ?? '';
    return init;
  });
  const [jumuah, setJumuah] = useState<JEntry[]>(() =>
    existing?.jumuah?.length
      ? existing.jumuah.map((j) => ({
          khutbahTime: j.khutbahTime,
          language: j.language ?? '',
        }))
      : [{ khutbahTime: '', language: '' }],
  );
  const [errors, setErrors] = useState<string[]>([]);

  const setIqamaField = (p: IqamaPrayer, v: string) =>
    setIqama((s) => ({ ...s, [p]: v }));

  const save = async () => {
    const errs: string[] = [];
    const iqamaOut: Partial<Record<IqamaPrayer, string>> = {};
    for (const p of IQAMA_PRAYERS) {
      const r = parseField(iqama[p], p);
      if (r === 'BAD') errs.push(`${prayerLabel(p)} time isn’t valid (use HH:mm).`);
      else if (r) iqamaOut[p] = r;
    }

    const jumuahOut: JumuahService[] = [];
    jumuah.forEach((j, i) => {
      const r = parseField(j.khutbahTime, 'dhuhr');
      if (r === 'BAD') errs.push(`Jumu‘ah #${i + 1} time isn’t valid (use HH:mm).`);
      else if (r)
        jumuahOut.push({
          khutbahTime: r,
          language: j.language.trim() || undefined,
        });
    });

    const times: MosqueTimes = {};
    if (Object.keys(iqamaOut).length) times.iqama = iqamaOut;
    if (jumuahOut.length) times.jumuah = jumuahOut;

    errs.push(...validateMosqueTimes(times));
    if (errs.length) {
      setErrors(errs);
      return;
    }
    if (id) {
      const m = getMosque(id);
      await saveLocalTimes(id, times, {
        name: m?.name,
        location: m?.location,
        city: m?.city,
        country: m?.country,
      });
    }
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {name ? (
          <Text style={[styles.mosque, { color: theme.text }]}>{name}</Text>
        ) : null}
        <Text style={[styles.help, { color: theme.text3 }]}>
          Enter the congregation (iqama) times this mosque holds. Use 24-hour
          HH:mm (e.g. 13:30) or h:mm am/pm. Leave a prayer blank if unknown.
        </Text>

        <Text style={[styles.section, { color: theme.text2 }]}>IQAMA TIMES</Text>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {IQAMA_PRAYERS.map((p) => (
            <View key={p} style={[styles.row, { borderTopColor: theme.border }]}>
              <Text style={[styles.label, { color: theme.text }]}>{prayerLabel(p)}</Text>
              <TextInput
                value={iqama[p]}
                onChangeText={(v) => setIqamaField(p, v)}
                placeholder="—"
                placeholderTextColor={theme.text3}
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                autoCapitalize="none"
              />
            </View>
          ))}
        </View>

        <Text style={[styles.section, { color: theme.text2 }]}>JUMU‘AH (FRIDAY)</Text>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {jumuah.map((j, i) => (
            <View key={i} style={[styles.jrow, { borderTopColor: theme.border }]}>
              <TextInput
                value={j.khutbahTime}
                onChangeText={(v) =>
                  setJumuah((s) => s.map((x, k) => (k === i ? { ...x, khutbahTime: v } : x)))
                }
                placeholder="13:30"
                placeholderTextColor={theme.text3}
                style={[styles.input, { flex: 0, width: 90, color: theme.text, borderColor: theme.border }]}
                autoCapitalize="none"
              />
              <TextInput
                value={j.language}
                onChangeText={(v) =>
                  setJumuah((s) => s.map((x, k) => (k === i ? { ...x, language: v } : x)))
                }
                placeholder="Language (optional)"
                placeholderTextColor={theme.text3}
                style={[styles.input, { flex: 1, color: theme.text, borderColor: theme.border }]}
              />
              {jumuah.length > 1 && (
                <TouchableOpacity
                  onPress={() => setJumuah((s) => s.filter((_, k) => k !== i))}
                  hitSlop={8}
                >
                  <Text style={{ color: theme.danger, fontWeight: '800', fontSize: 18 }}>×</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          <TouchableOpacity
            onPress={() => setJumuah((s) => [...s, { khutbahTime: '', language: '' }])}
            style={styles.addRow}
          >
            <Text style={{ color: theme.primary, fontWeight: '700' }}>+ Add another Jumu‘ah</Text>
          </TouchableOpacity>
        </View>

        {errors.length > 0 && (
          <View style={[styles.errorBox, { backgroundColor: theme.danger + '1A' }]}>
            {errors.map((e, i) => (
              <Text key={i} style={{ color: theme.danger, fontSize: 13 }}>
                • {e}
              </Text>
            ))}
          </View>
        )}

        <TouchableOpacity onPress={save} style={[styles.saveBtn, { backgroundColor: theme.primary }]}>
          <Text style={styles.saveText}>Save times</Text>
        </TouchableOpacity>

        <Text style={[styles.note, { color: theme.text3 }]}>
          Saved on this device for now. A shared community registry (with
          confirmation and mosque verification) is coming next.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48 },
  mosque: { fontSize: 20, fontWeight: '800', marginBottom: 6 },
  help: { fontSize: 13, lineHeight: 19, marginBottom: 18 },
  section: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, marginBottom: 8 },
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  label: { fontSize: 16, fontWeight: '600' },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    minWidth: 90,
    textAlign: 'center',
  },
  jrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  addRow: { paddingVertical: 12 },
  errorBox: { borderRadius: 10, padding: 12, marginBottom: 16, gap: 3 },
  saveBtn: { borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  note: { fontSize: 12, textAlign: 'center', marginTop: 14, lineHeight: 18 },
});
