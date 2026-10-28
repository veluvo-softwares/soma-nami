import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { BigButton } from '../../components/BigButton';
import type { Photo } from '../../reader/types';
import { useBi } from '../../settings/SettingsContext';
import { PHRASES, type PhraseId } from '../../speech/phrases';
import type { SpeechSession } from '../../speech/session';
import { fonts, radius, space, type, usePalette, type Palette } from '../../theme';

interface Props {
  speech: SpeechSession;
  /** The spoken hint from the last photo, or null on first open. */
  hint: PhraseId | null;
  /** True when the last photo had readable text the user may read anyway. */
  canReadAnyway: boolean;
  onPhoto: (photo: Photo) => void;
  onPick: () => void;
  onReadAnyway: () => void;
  onBack: () => void;
}

/**
 * Screen 2 (docs/ui.md, Aiming): live camera, tap anywhere on it to take the
 * photo. Live per-frame guidance isn't realistic (OCR takes tens of seconds),
 * so guidance comes after each photo, from where the text sat in it.
 */
export function AimingScreen({ speech, hint, canReadAnyway, onPhoto, onPick, onReadAnyway, onBack }: Props) {
  const p = usePalette();
  const styles = useMemo(() => makeStyles(p), [p]);
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const granted = permission?.granted ?? false;
  const known = permission !== null;
  const bi = useBi();
  const captureLabel = bi('Gusa popote kupiga picha', 'Tap anywhere to take the photo');
  const hintText = hint ? bi(PHRASES[hint].sw, PHRASES[hint].en) : null;
  const permText = bi(PHRASES.camera_permission.sw, PHRASES.camera_permission.en);

  useEffect(() => {
    if (!known) return;
    void speech.say(hint ?? (granted ? 'aim_open' : 'camera_permission'));
  }, [speech, hint, known, granted]);

  const capture = async () => {
    if (!camera.current || !ready || capturing) return;
    setCapturing(true);
    try {
      speech.stop();
      const pic = await camera.current.takePictureAsync({ quality: 0.8 });
      if (pic) onPhoto({ uri: pic.uri, width: pic.width, height: pic.height });
    } catch (e) {
      console.warn('[soma] takePicture failed', e);
      void speech.say('error');
    } finally {
      setCapturing(false);
    }
  };

  const hintBanner = hintText ? (
    <View style={styles.banner} accessibilityLiveRegion="polite" testID="aiming-hint">
      <Text style={styles.bannerSw}>{hintText.main}</Text>
      <Text style={styles.bannerEn}>{hintText.sub}</Text>
    </View>
  ) : null;

  return (
    <View style={styles.container} testID="aiming-screen">
      {permission && !granted ? (
        <View style={styles.permission}>
          <Text style={styles.permissionSw}>{permText.main}</Text>
          <Text style={styles.permissionEn}>{permText.sub}</Text>
          <BigButton
            testID="aiming-allow-camera"
            icon="camera"
            sw="Ruhusu kamera"
            en="Allow the camera"
            onPress={() => {
              if (permission.canAskAgain) void requestPermission();
              else void Linking.openSettings();
            }}
          />
        </View>
      ) : (
        <Pressable
          testID="aiming-capture"
          style={styles.preview}
          onPress={capture}
          disabled={!granted || capturing}
          accessibilityRole="button"
          accessibilityLabel={captureLabel.main}
          accessibilityHint={captureLabel.sub}
        >
          {granted ? (
            <CameraView
              ref={camera}
              style={StyleSheet.absoluteFill}
              facing="back"
              onCameraReady={() => setReady(true)}
            />
          ) : null}
          <View pointerEvents="none" style={styles.frame} />
          {hintBanner}
        </Pressable>
      )}
      <View style={styles.actions}>
        {canReadAnyway ? (
          <BigButton testID="aiming-read-anyway" icon="text-box-outline" sw="Soma hii" en="Read this one" onPress={onReadAnyway} />
        ) : null}
        <View style={styles.row}>
          <BigButton
            testID="aiming-pick"
            tone="plain"
            icon="image-outline"
            sw="Chagua picha"
            en="Choose a photo"
            onPress={() => {
              void speech.say('btn_pick_photo');
              onPick();
            }}
            style={styles.half}
          />
          <BigButton testID="aiming-back" tone="plain" icon="arrow-left" sw="Rudi" en="Back" onPress={onBack} style={styles.half} />
        </View>
      </View>
    </View>
  );
}

function makeStyles(p: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: p.background },
    preview: { flex: 1, overflow: 'hidden', backgroundColor: '#000000' },
    frame: {
      position: 'absolute',
      top: '12%',
      left: '8%',
      right: '8%',
      bottom: '12%',
      borderWidth: 4,
      borderColor: p.primary,
      borderRadius: radius.lg,
    },
    banner: {
      position: 'absolute',
      left: space.md,
      right: space.md,
      top: space.md,
      backgroundColor: p.primary,
      borderRadius: radius.md,
      padding: space.md,
    },
    bannerSw: { fontFamily: fonts.bold, fontSize: type.heading, color: p.onAccent },
    bannerEn: { fontFamily: fonts.regular, fontSize: type.hint, color: p.onAccent },
    permission: { flex: 1, justifyContent: 'center', padding: space.lg, gap: space.md },
    permissionSw: { fontFamily: fonts.bold, fontSize: type.heading, color: p.text },
    permissionEn: { fontFamily: fonts.regular, fontSize: type.hint, color: p.textMuted },
    actions: { padding: space.md, gap: space.md },
    row: { flexDirection: 'row', gap: space.md },
    half: { flex: 1, paddingHorizontal: space.md },
  });
}
