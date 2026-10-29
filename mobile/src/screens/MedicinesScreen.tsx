import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BigButton } from '../components/BigButton';
import { isDueNow, TIME_LABELS, type SavedMedicine } from '../medicines/medicines';
import { useBi, useLanguage } from '../settings/SettingsContext';
import { fonts, radius, space, touch, type, usePalette, type Palette } from '../theme';

interface Props {
  medicines: readonly SavedMedicine[];
  /** Reads the saved label aloud from storage. No OCR. */
  onOpen: (medicine: SavedMedicine) => void;
  onBack: () => void;
  /** For tests. */
  now?: () => Date;
}

const realNow = () => new Date();

/** The current time, refreshed every minute so "Sasa" follows the clock. */
function useNow(now: () => Date): Date {
  const [t, setT] = useState(now);
  useEffect(() => {
    setT(now());
    const id = setInterval(() => setT(now()), 60_000);
    return () => clearInterval(id);
  }, [now]);
  return t;
}

/**
 * Screen 6 (docs/ui.md, Dawa zangu): saved medicines as large photo cards.
 * Tapping a card replays the saved label; setting times and deleting are in
 * caregiver setup, not here. "Sasa · Now" marks only a medicine whose
 * caregiver-set time matches the time of day.
 */
export function MedicinesScreen({ medicines, onOpen, onBack, now = realNow }: Props) {
  const p = usePalette();
  const styles = useMemo(() => makeStyles(p), [p]);
  const bi = useBi();
  const language = useLanguage();
  const current = useNow(now);
  const title = bi('Dawa zangu', 'My medicines');
  const empty = bi('Bado hakuna dawa zilizohifadhiwa.', 'No medicines saved yet.');
  const emptyHow = bi('Soma lebo, kisha bonyeza Hifadhi.', 'Read a label, then press Save.');
  const tapHint = bi('Gusa kusikia tena', 'Tap to hear again');
  const noName = bi('Dawa bila jina', 'Unnamed medicine');

  return (
    <View style={styles.container} testID="medicines-screen">
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title} accessibilityRole="header">
          {title.main}
        </Text>
        <Text style={styles.sub}>{title.sub}</Text>
        {medicines.length === 0 ? (
          <View accessible accessibilityLabel={`${empty.main} ${emptyHow.main}`} testID="medicines-empty">
            <Text style={styles.name}>{empty.main}</Text>
            <Text style={styles.sub}>{empty.sub}</Text>
            <Text style={styles.sub}>
              {emptyHow.main} · {emptyHow.sub}
            </Text>
          </View>
        ) : null}
        {medicines.map((m) => {
          const due = isDueNow(m.times, current);
          const name = m.name || noName.main;
          const timeText = m.times.map((t) => (language === 'sw' ? TIME_LABELS[t].sw : TIME_LABELS[t].en)).join(' · ');
          const label = [name, timeText, due ? 'Sasa' : ''].filter(Boolean).join('. ');
          return (
            <Pressable
              key={m.id}
              testID={`medicine-${m.id}`}
              onPress={() => onOpen(m)}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityHint={`${tapHint.main}. ${tapHint.sub}`}
              style={({ pressed }) => [styles.card, due && styles.due, pressed && { opacity: 0.8 }]}
            >
              <Image source={{ uri: m.photoUri }} style={styles.photo} accessibilityIgnoresInvertColors />
              <View style={styles.cardText}>
                {due ? (
                  <View style={styles.nowBadge} testID={`medicine-${m.id}-now`}>
                    <MaterialCommunityIcons name="clock-alert-outline" size={28} color={p.onAccent} />
                    <Text style={styles.nowText}>Sasa · Now</Text>
                  </View>
                ) : null}
                <Text style={styles.name}>{name}</Text>
                {m.times.length > 0 ? (
                  <Text style={styles.times} testID={`medicine-${m.id}-times`}>
                    {timeText}
                  </Text>
                ) : null}
                <Text style={styles.sub}>
                  {tapHint.main} · {tapHint.sub}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.actions}>
        <BigButton testID="medicines-back" tone="plain" icon="arrow-left" sw="Rudi" en="Back" onPress={onBack} />
      </View>
    </View>
  );
}

function makeStyles(p: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: p.background },
    content: { padding: space.lg, gap: space.md },
    title: { fontFamily: fonts.bold, fontSize: type.headingLarge, color: p.text },
    sub: { fontFamily: fonts.regular, fontSize: type.hint, color: p.textMuted },
    card: {
      minHeight: touch.minSize,
      borderRadius: radius.lg,
      borderWidth: 4,
      borderColor: p.outline,
      overflow: 'hidden',
    },
    due: { borderColor: p.primary, borderWidth: 8 },
    photo: { width: '100%', height: 180, backgroundColor: p.outline },
    cardText: { padding: space.md, gap: space.xs },
    name: { fontFamily: fonts.bold, fontSize: type.heading, color: p.text },
    times: { fontFamily: fonts.bold, fontSize: type.bodyLarge, color: p.text },
    nowBadge: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.xs,
      backgroundColor: p.primary,
      borderRadius: radius.md,
      paddingHorizontal: space.sm,
      paddingVertical: space.xs,
    },
    nowText: { fontFamily: fonts.bold, fontSize: type.body, color: p.onAccent },
    actions: { padding: space.md },
  });
}
