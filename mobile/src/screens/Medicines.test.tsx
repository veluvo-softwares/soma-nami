import { act, fireEvent, render, screen, within } from '@testing-library/react-native';

import { AppShell } from '../AppShell';
import { MedicinesProvider } from '../medicines/MedicinesContext';
import { MemoryMedicineStorage } from '../medicines/medicines';
import { FakeModelClient, flush, TEST_MANIFEST } from '../model-store/testing';
import { blocksFor, FakeReaderServices } from '../reader/testing';
import { ReadFlow } from './read/ReadFlow';

jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }));

const mockTakePicture = jest.fn();
jest.mock('expo-camera', () => {
  const React = jest.requireActual('react');
  const CameraView = React.forwardRef(({ onCameraReady }: { onCameraReady?: () => void }, ref: unknown) => {
    React.useImperativeHandle(ref, () => ({ takePictureAsync: mockTakePicture }));
    React.useEffect(() => {
      onCameraReady?.();
    }, [onCameraReady]);
    return null;
  });
  CameraView.displayName = 'MockCameraView';
  return { CameraView, useCameraPermissions: () => [{ granted: true, canAskAgain: true }, jest.fn()] };
});

const PHOTO = { uri: 'file:///camera/1.jpg', width: 1000, height: 800 };

async function settle() {
  await act(async () => {
    await flush(30);
  });
}

beforeEach(() => {
  mockTakePicture.mockReset();
  mockTakePicture.mockResolvedValue(PHOTO);
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

/** Takes a photo and finishes OCR with a synthetic label, landing on the Reading screen. */
async function readLabel(services: FakeReaderServices, label: Parameters<typeof blocksFor>[0]) {
  fireEvent.press(screen.getByTestId('home-read'));
  await settle();
  fireEvent.press(screen.getByTestId('aiming-capture'));
  await settle();
  await act(async () => {
    services.finishOcr(blocksFor(label));
    await flush(30);
  });
  expect(screen.getByTestId('reading-screen')).toBeTruthy();
}

const LABEL = ['PARACETAMOL', 'Tablets BP 500 mg', { text: 'Take 4 tablets', confidence: 0.3 }, 'Store below 30°C.'];

function setup(storage = new MemoryMedicineStorage(), now?: () => Date) {
  const services = new FakeReaderServices();
  services.speech.autoFinish = true;
  const utils = render(
    <MedicinesProvider storage={storage}>
      <ReadFlow services={services} now={now} />
    </MedicinesProvider>,
  );
  return { services, storage, ...utils };
}

describe('Dawa zangu: save, list, hear again', () => {
  it('saves a read label, lists it with no times, and replays it from storage without OCR', async () => {
    const { services, storage } = setup();
    await settle();
    await readLabel(services, LABEL);

    fireEvent.press(screen.getByTestId('reading-more'));
    fireEvent.press(screen.getByTestId('reading-save'));
    await settle();
    expect(storage.saved.at(-1)).toHaveLength(1);
    expect(storage.saved.at(-1)![0]).toMatchObject({ name: 'PARACETAMOL', times: [] });
    expect(storage.photos.get('file:///medicines/' + storage.saved.at(-1)![0]!.id + '.jpg')).toBe('file:///camera/1.jpg#small');
    // Can't be saved twice.
    expect(screen.getByTestId('reading-save').props.accessibilityState.disabled).toBe(true);

    fireEvent.press(screen.getByTestId('reading-back'));
    await settle();
    fireEvent.press(screen.getByTestId('home-medicines'));
    await settle();

    const card = screen.getByTestId(`medicine-${storage.saved.at(-1)![0]!.id}`);
    expect(within(card).getByText('PARACETAMOL')).toBeTruthy();
    expect(screen.queryByText(/Sasa/)).toBeNull();
    expect(screen.queryByTestId(/-times$/)).toBeNull();
    // Large target, labelled in Swahili with the English hint under it.
    expect(card.props.accessibilityRole).toBe('button');
    expect(card.props.accessibilityHint).toContain('Tap to hear again');

    const ocrBefore = services.recognized.length;
    const playedBefore = services.speech.played.length;
    fireEvent.press(card);
    await settle();

    expect(services.recognized.length).toBe(ocrBefore); // no OCR again
    // Storage is under More details, so the replay reads name and strength only (card A).
    expect(services.speech.synthesized.slice(-2)).toEqual(['PARACETAMOL', 'Tablets BP 500 mg']);
    expect(services.speech.played.length).toBeGreaterThan(playedBefore);
    // The saved text is on screen; the unsure line kept its state and is neither shown nor read.
    expect(screen.getByText('Tablets BP 500 mg')).toBeTruthy();
    expect(screen.queryByText('Take 4 tablets')).toBeNull();
    expect(screen.getByTestId('reading-line-2-unsure')).toBeTruthy();
    expect(services.speech.synthesized).not.toContain('Take 4 tablets');
    // A replay is not offered for saving again.
    fireEvent.press(screen.getByTestId('reading-more'));
    expect(screen.queryByTestId('reading-save')).toBeNull();

    fireEvent.press(screen.getByTestId('reading-back'));
    await settle();
    expect(screen.getByTestId('medicines-screen')).toBeTruthy();
  });

  it('says so when saving fails, and lets the user try again', async () => {
    const storage = new MemoryMedicineStorage();
    storage.failSave = true;
    const { services } = setup(storage);
    await settle();
    await readLabel(services, LABEL);

    fireEvent.press(screen.getByTestId('reading-more'));
    fireEvent.press(screen.getByTestId('reading-save'));
    await settle();
    expect(screen.getByTestId('reading-save-failed')).toBeTruthy();
    expect(storage.saved).toEqual([]);
    expect(storage.photos.size).toBe(0);

    storage.failSave = false;
    fireEvent.press(screen.getByTestId('reading-save'));
    await settle();
    expect(screen.queryByTestId('reading-save-failed')).toBeNull();
    expect(storage.saved).toHaveLength(1);
  });

  it('shows an empty list kindly', async () => {
    setup();
    await settle();
    fireEvent.press(screen.getByTestId('home-medicines'));
    await settle();
    expect(screen.getByTestId('medicines-empty')).toBeTruthy();
  });
});

describe('Dawa zangu: "Sasa · Now"', () => {
  async function seeded(times: ('morning' | 'midday' | 'evening' | 'night')[], hour: number) {
    const storage = new MemoryMedicineStorage({
      medicines: [
        {
          id: 'a',
          name: 'PARACETAMOL',
          photoUri: 'file:///medicines/a.jpg',
          savedAt: '2026-10-29T08:00:00.000Z',
          times,
          lines: [{ text: 'PARACETAMOL', minConfidence: 0.9, lowConfidence: false, language: 'en', box: null }],
        },
        {
          id: 'b',
          name: 'IBUPROFEN',
          photoUri: 'file:///medicines/b.jpg',
          savedAt: '2026-10-29T08:00:00.000Z',
          times: [],
          lines: [{ text: 'IBUPROFEN', minConfidence: 0.9, lowConfidence: false, language: 'en', box: null }],
        },
      ],
    });
    setup(storage, () => new Date(2026, 9, 29, hour));
    await settle();
    fireEvent.press(screen.getByTestId('home-medicines'));
    await settle();
  }

  it('marks only the medicine whose caregiver-set time matches now', async () => {
    await seeded(['morning'], 9);
    expect(screen.getByTestId('medicine-a-now')).toBeTruthy();
    expect(screen.getByText('Sasa · Now')).toBeTruthy();
    expect(screen.getByTestId('medicine-a-times')).toHaveTextContent('Asubuhi');
    expect(screen.queryByTestId('medicine-b-now')).toBeNull(); // no times set: never marked
    expect(screen.queryByTestId('medicine-b-times')).toBeNull();
    expect(screen.getByTestId('medicine-a').props.accessibilityLabel).toBe('PARACETAMOL. Asubuhi. Sasa');
  });

  it('marks nothing when the set time is a different part of the day', async () => {
    await seeded(['evening'], 9);
    expect(screen.queryByTestId('medicine-a-now')).toBeNull();
    expect(screen.getByTestId('medicine-a-times')).toHaveTextContent('Jioni');
  });

  it('has no setting or delete on the main list: those are in caregiver setup', async () => {
    await seeded(['morning'], 9);
    expect(screen.queryByTestId('setup-a-delete')).toBeNull();
    expect(screen.queryByTestId('setup-a-morning')).toBeNull();
  });
});

describe('Dawa zangu in caregiver setup', () => {
  async function openSetup(storage: MemoryMedicineStorage) {
    const client = new FakeModelClient();
    client.cached = new Set(['OCR_CRAFT', 'OCR_LATIN']);
    const reader = new FakeReaderServices();
    reader.speech.autoFinish = true;
    render(<AppShell client={client} manifest={TEST_MANIFEST} reader={reader} medicineStorage={storage} />);
    await settle();
    fireEvent.press(screen.getByTestId('home-setup'));
    await settle();
  }

  const seed = () =>
    new MemoryMedicineStorage({
      medicines: [
        {
          id: 'a',
          name: 'PARACETAMOL',
          photoUri: 'file:///medicines/a.jpg',
          savedAt: '2026-10-29T08:00:00.000Z',
          times: [],
          lines: [{ text: 'PARACETAMOL', minConfidence: 0.9, lowConfidence: false, language: 'en', box: null }],
        },
      ],
    });

  it('lets the caregiver set and clear times, saved on the phone', async () => {
    const storage = seed();
    await openSetup(storage);
    fireEvent.press(screen.getByTestId('setup-a-night'));
    await settle();
    fireEvent.press(screen.getByTestId('setup-a-morning'));
    await settle();
    expect(storage.saved.at(-1)![0]!.times).toEqual(['morning', 'night']);
    expect(screen.getByTestId('setup-a-morning').props.accessibilityState.selected).toBe(true);

    fireEvent.press(screen.getByTestId('setup-a-night'));
    await settle();
    expect(storage.saved.at(-1)![0]!.times).toEqual(['morning']);
  });

  it('deletes only after a confirm, and cancel keeps it', async () => {
    const storage = seed();
    await openSetup(storage);

    fireEvent.press(screen.getByTestId('setup-a-delete'));
    await settle();
    expect(screen.getByTestId('setup-a-confirm')).toBeTruthy();
    expect(storage.saved).toEqual([]); // nothing yet

    fireEvent.press(screen.getByTestId('setup-a-delete-no'));
    await settle();
    expect(screen.queryByTestId('setup-a-confirm')).toBeNull();
    expect(screen.getByTestId('setup-medicine-a')).toBeTruthy();

    fireEvent.press(screen.getByTestId('setup-a-delete'));
    await settle();
    fireEvent.press(screen.getByTestId('setup-a-delete-yes'));
    await settle();
    expect(storage.saved.at(-1)).toEqual([]);
    expect(screen.queryByTestId('setup-medicine-a')).toBeNull();
  });

  it('says when a change could not be saved', async () => {
    const storage = seed();
    await openSetup(storage);
    storage.failSave = true;
    fireEvent.press(screen.getByTestId('setup-a-morning'));
    await settle();
    expect(screen.getByTestId('medicines-setup-failed')).toBeTruthy();
    expect(screen.getByTestId('setup-a-morning').props.accessibilityState.selected).toBe(false);
  });
});
