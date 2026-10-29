import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BigButton } from '../components/BigButton';
import { NOTE_MAX, type SavedMedicine } from '../medicines/medicines';
import { useBi } from '../settings/SettingsContext';
import { fonts, radius, space, touch, type, usePalette, type Palette } from '../theme';

interface Props {
  medicine: SavedMedicine;
  /** Saves the text (empty text deletes the note). Rejects when it could not be written. */
  onSave: (note: string) => Promise<void>;
  /** Back to the medicine, nothing changed. */
  onBack: () => void;
}

/**
 * Add, edit or delete the note of one saved medicine (Dawa zangu). The note
 * is text for the caregiver to read: it is never spoken (the phone has no
 * Swahili voice and notes are often Swahili).
 */
export function MedicineNoteScreen({ medicine, onSave, onBack }: Props) {
  const p = usePalette();
  const styles = useMemo(() => makeStyles(p), [p]);
  const bi = useBi();
  const hasNote = medicine.note !== '';
  const [text, setText] = useState(medicine.note);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const title = hasNote ? bi('Hariri maelezo', 'Edit the note') : bi('Ongeza maelezo', 'Add a note');
  const inputLabel = bi('Maelezo ya dawa hii', 'Note for this medicine');
  const inputHint = bi('Andika maelezo, kwa mfano wakati wa kunywa. Hayasomwi kwa sauti.', 'Type a note, for example when to take it. It is not read aloud.');
  const placeholder = bi('Andika hapa…', 'Type here…');
  const failText = bi('Haikuhifadhiwa. Jaribu tena.', "Couldn't save. Try again.");
  const sure = bi('Futa maelezo haya?', 'Delete this note?');

  const run = (note: string) => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    onSave(note).then(
      () => {
        if (mounted.current) onBack();
      },
      (e) => {
        console.warn('[soma] saving the note failed', e);
        if (mounted.current) {
          setBusy(false);
          setFailed(true);
          setConfirming(false);
        }
      },
    );
  };

  return (
    <View style={styles.container} testID="note-screen">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title} accessibilityRole="header">
          {title.main}
        </Text>
        <Text style={styles.sub}>{title.sub}</Text>
        <Text style={styles.name}>{medicine.name}</Text>
        <TextInput
          testID="note-input"
          style={styles.input}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={NOTE_MAX}
          editable={!busy}
          placeholder={placeholder.main}
          placeholderTextColor={p.textMuted}
          accessibilityLabel={`${inputLabel.main}. ${inputLabel.sub}`}
          accessibilityHint={`${inputHint.main} ${inputHint.sub}`}
          textAlignVertical="top"
        />
        {failed ? (
          <Text style={styles.fail} accessibilityRole="alert" testID="note-failed">
            {failText.main} · {failText.sub}
          </Text>
        ) : null}
      </ScrollView>
      <View style={styles.actions}>
        {confirming ? (
          <View style={styles.confirm} testID="note-confirm">
            <Text style={styles.name}>{sure.main}</Text>
            <Text style={styles.sub}>{sure.sub}</Text>
            <BigButton
              testID="note-delete-yes"
              tone="warning"
              icon="delete"
              sw="Ndiyo, futa"
              en="Yes, delete"
              disabled={busy}
              onPress={() => run('')}
            />
            <BigButton testID="note-delete-no" tone="plain" icon="close" sw="Ghairi" en="Cancel" onPress={() => setConfirming(false)} />
          </View>
        ) : (
          <>
            <BigButton
              testID="note-save"
              icon="content-save"
              sw="Hifadhi maelezo"
              en="Save note"
              disabled={busy || text.trim() === medicine.note}
              onPress={() => run(text)}
            />
            {hasNote ? (
              <BigButton
                testID="note-delete"
                tone="plain"
                icon="delete"
                sw="Futa maelezo"
                en="Delete note"
                disabled={busy}
                onPress={() => setConfirming(true)}
              />
            ) : null}
            <BigButton testID="note-back" tone="plain" icon="arrow-left" sw="Rudi" en="Back" disabled={busy} onPress={onBack} />
          </>
        )}
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
    name: { fontFamily: fonts.bold, fontSize: type.heading, color: p.text },
    input: {
      minHeight: touch.minSize * 2,
      borderWidth: 4,
      borderColor: p.outline,
      borderRadius: radius.lg,
      padding: space.md,
      fontFamily: fonts.regular,
      fontSize: type.bodyLarge,
      color: p.text,
    },
    fail: { fontFamily: fonts.bold, fontSize: type.body, color: p.warning },
    actions: { padding: space.md, gap: space.sm },
    confirm: { gap: space.sm },
  });
}
