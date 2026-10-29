import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BigButton } from '../components/BigButton';
import { useMedicines } from '../medicines/MedicinesContext';
import { TIME_LABELS, TIMES_OF_DAY, type SavedMedicine, type TimeOfDay } from '../medicines/medicines';
import { useBi } from '../settings/SettingsContext';
import { fonts, radius, space, type, usePalette, type Palette } from '../theme';

const ICONS: Record<TimeOfDay, 'weather-sunset-up' | 'white-balance-sunny' | 'weather-sunset-down' | 'weather-night'> = {
  morning: 'weather-sunset-up',
  midday: 'white-balance-sunny',
  evening: 'weather-sunset-down',
  night: 'weather-night',
};

/**
 * Caregiver-only part of Dawa zangu (inside setup, never on the main list):
 * set the times of day for each saved medicine, and delete one after a
 * confirm. Times are only ever what the caregiver picks here.
 */
export function MedicinesSetup() {
  const { store, items } = useMedicines();
  const p = usePalette();
  const styles = useMemo(() => makeStyles(p), [p]);
  const bi = useBi();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const none = bi('Hakuna dawa zilizohifadhiwa.', 'No medicines saved.');
  const timesHeading = bi('Wakati wa kunywa', 'Times of day');
  const failText = bi('Haikuhifadhiwa. Jaribu tena.', "Couldn't save. Try again.");
  const noName = bi('Dawa bila jina', 'Unnamed medicine');
  const sure = bi('Futa dawa hii?', 'Delete this medicine?');

  const run = (job: Promise<void>) => {
    setFailed(false);
    job.catch((e) => {
      console.warn('[soma] medicines change failed', e);
      setFailed(true);
    });
  };

  const toggle = (m: SavedMedicine, t: TimeOfDay) =>
    run(store.setTimes(m.id, m.times.includes(t) ? m.times.filter((x) => x !== t) : [...m.times, t]));

  return (
    <View style={styles.wrap} testID="medicines-setup">
      {items.length === 0 ? (
        <Text style={styles.en}>
          {none.main} · {none.sub}
        </Text>
      ) : null}
      {failed ? (
        <Text style={styles.fail} accessibilityRole="alert" testID="medicines-setup-failed">
          {failText.main} · {failText.sub}
        </Text>
      ) : null}
      {items.map((m) => (
        <View key={m.id} style={styles.item} testID={`setup-medicine-${m.id}`}>
          <Text style={styles.name}>{m.name || noName.main}</Text>
          <Text style={styles.en}>
            {timesHeading.main} · {timesHeading.sub}
          </Text>
          <View style={styles.grid}>
            {TIMES_OF_DAY.map((t) => (
              <BigButton
                key={t}
                testID={`setup-${m.id}-${t}`}
                tone="plain"
                icon={ICONS[t]}
                sw={TIME_LABELS[t].sw}
                en={TIME_LABELS[t].en}
                selected={m.times.includes(t)}
                onPress={() => toggle(m, t)}
                style={styles.cell}
              />
            ))}
          </View>
          {confirming === m.id ? (
            <View style={styles.confirm} testID={`setup-${m.id}-confirm`}>
              <Text style={styles.name}>{sure.main}</Text>
              <Text style={styles.en}>{sure.sub}</Text>
              <BigButton
                testID={`setup-${m.id}-delete-yes`}
                tone="warning"
                icon="delete"
                sw="Ndiyo, futa"
                en="Yes, delete"
                onPress={() => {
                  setConfirming(null);
                  run(store.remove(m.id));
                }}
              />
              <BigButton
                testID={`setup-${m.id}-delete-no`}
                tone="plain"
                icon="close"
                sw="Ghairi"
                en="Cancel"
                onPress={() => setConfirming(null)}
              />
            </View>
          ) : (
            <BigButton
              testID={`setup-${m.id}-delete`}
              tone="plain"
              icon="delete"
              sw="Futa"
              en="Delete"
              onPress={() => setConfirming(m.id)}
            />
          )}
        </View>
      ))}
    </View>
  );
}

function makeStyles(p: Palette) {
  return StyleSheet.create({
    wrap: { gap: space.md },
    item: { gap: space.sm, borderWidth: 3, borderColor: p.outline, borderRadius: radius.lg, padding: space.md },
    name: { fontFamily: fonts.bold, fontSize: type.heading, color: p.text },
    en: { fontFamily: fonts.regular, fontSize: type.hint, color: p.textMuted },
    fail: { fontFamily: fonts.bold, fontSize: type.body, color: p.warning },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    cell: { flexBasis: '47%', flexGrow: 1, paddingHorizontal: space.md },
    confirm: { gap: space.sm },
  });
}
