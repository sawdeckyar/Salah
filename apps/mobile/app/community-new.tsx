import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { CommunityCategory, CommunityPost } from '@salah/core';
import { addCommunity } from '../src/data/community';
import { useTheme } from '../src/theme';

const LABELS: Record<CommunityCategory, string> = {
  fun: 'Halal fun spot',
  event: 'Event',
  gathering: 'Gathering',
  meetup: 'Meetup',
};

export default function CommunityNewScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{
    category?: string;
    lat?: string;
    lon?: string;
    city?: string;
  }>();
  const category = (params.category as CommunityCategory) ?? 'fun';

  const [title, setTitle] = useState('');
  const [when, setWhen] = useState('');
  const [place, setPlace] = useState('');
  const [url, setUrl] = useState('');
  const [desc, setDesc] = useState('');
  const [error, setError] = useState<string | null>(null);

  const showWhen = category !== 'fun';

  const save = async () => {
    if (!title.trim()) {
      setError('Please add a title.');
      return;
    }
    const lat = params.lat ? Number.parseFloat(params.lat) : undefined;
    const lon = params.lon ? Number.parseFloat(params.lon) : undefined;
    const post: CommunityPost = {
      id: `c_${Date.now()}_${Math.round(Math.random() * 1e4)}`,
      category,
      title: title.trim(),
      description: desc.trim() || undefined,
      placeName: place.trim() || undefined,
      city: params.city,
      whenText: showWhen ? when.trim() || undefined : undefined,
      url: url.trim() || undefined,
      location:
        lat != null && lon != null && Number.isFinite(lat)
          ? { latitude: lat, longitude: lon }
          : undefined,
      createdAt: new Date().toISOString(),
    };
    await addCommunity(post);
    router.back();
  };

  const field = (
    label: string,
    value: string,
    setter: (v: string) => void,
    opts: { placeholder?: string; multiline?: boolean } = {},
  ) => (
    <>
      <Text style={[styles.label, { color: theme.text2 }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={setter}
        placeholder={opts.placeholder}
        placeholderTextColor={theme.text3}
        multiline={opts.multiline}
        style={[
          styles.input,
          { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface },
          opts.multiline && { height: 90, textAlignVertical: 'top' },
        ]}
      />
    </>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.heading, { color: theme.text }]}>
          Add a {LABELS[category]}
        </Text>
        <Text style={[styles.help, { color: theme.text3 }]}>
          Share something for the community{params.city ? ` in ${params.city}` : ''}.
        </Text>

        {field('Title', title, setTitle, { placeholder: 'e.g. Eid Carnival' })}
        {showWhen && field('When', when, setWhen, { placeholder: 'e.g. Sat Jun 27, 7:00 PM' })}
        {field('Place / venue', place, setPlace, { placeholder: 'e.g. Community Center' })}
        {field('Link (optional)', url, setUrl, { placeholder: 'https://…' })}
        {field('Details', desc, setDesc, { placeholder: 'Anything people should know…', multiline: true })}

        {error && <Text style={{ color: theme.danger, marginTop: 8 }}>{error}</Text>}

        <TouchableOpacity onPress={save} style={[styles.saveBtn, { backgroundColor: theme.primary }]}>
          <Text style={styles.saveText}>Post</Text>
        </TouchableOpacity>
        <Text style={[styles.note, { color: theme.text3 }]}>
          Visible to everyone once the shared backend is on; saved on this device
          otherwise.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48 },
  heading: { fontSize: 20, fontWeight: '800' },
  help: { fontSize: 13, marginTop: 4, marginBottom: 16, lineHeight: 19 },
  label: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5, marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  saveBtn: { borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 22 },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  note: { fontSize: 12, textAlign: 'center', marginTop: 14, lineHeight: 18 },
});
