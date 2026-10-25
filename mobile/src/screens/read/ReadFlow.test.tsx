import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { ReadFlow } from './ReadFlow';
import { flush } from '../../model-store/testing';
import { blocksFor, FakeReaderServices } from '../../reader/testing';

const mockTakePicture = jest.fn();
let mockPermission: { granted: boolean; canAskAgain: boolean } | null = { granted: true, canAskAgain: true };

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
  return { CameraView, useCameraPermissions: () => [mockPermission, jest.fn()] };
});

const PHOTO = { uri: 'file:///camera/1.jpg', width: 1000, height: 800 };

async function settle() {
  await act(async () => {
    await flush(20);
  });
}

function setup() {
  const services = new FakeReaderServices();
  render(<ReadFlow services={services} />);
  return services;
}

async function takePhoto(services: FakeReaderServices) {
  fireEvent.press(screen.getByTestId('home-read'));
  await settle();
  fireEvent.press(screen.getByTestId('aiming-capture'));
  await settle();
  expect(screen.getByTestId('processing-screen')).toBeTruthy();
  expect(services.recognized).toEqual(['file:///camera/1.jpg#small']);
}

beforeEach(() => {
  mockTakePicture.mockReset();
  mockTakePicture.mockResolvedValue(PHOTO);
  mockPermission = { granted: true, canAskAgain: true };
  // ReadFlow logs OCR timings for the phone test; keep test output readable.
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('ReadFlow: photo -> OCR -> display and speech', () => {
  it('shows the label lines in large type and reads them aloud, unsure lines marked and never read', async () => {
    const services = setup();
    services.speech.autoFinish = false;
    await settle();
    expect(services.speech.playedNames()).toEqual(['home_open']);

    await takePhoto(services);
    expect(services.prepared).toEqual([PHOTO]);
    expect(services.speech.playedNames().at(-1)).toBe('reading_wait');

    await act(async () => {
      services.finishOcr(
        blocksFor(['PARACETAMOL', 'Tablets BP 500 mg', { text: 'Take 4 tablets', confidence: 0.3 }, 'Store below 30°C.']),
      );
      await flush(20);
    });

    expect(screen.getByTestId('reading-screen')).toBeTruthy();
    expect(screen.getByText('PARACETAMOL')).toBeTruthy();
    expect(screen.getByText('Tablets BP 500 mg')).toBeTruthy();
    expect(screen.getByText('Store below 30°C.')).toBeTruthy();
    // The unsure line is an orange "couldn't read" box: its OCR text is not shown.
    expect(screen.getByTestId('reading-line-2-unsure')).toBeTruthy();
    expect(screen.queryByText('Take 4 tablets')).toBeNull();

    // Drive the whole reading to the end.
    const sp = services.speech;
    await act(async () => {
      for (let i = 0; i < 20 && (sp.pendingPlays > 0 || sp.synthesized.length > sp.played.length); i++) {
        try {
          sp.finishSynth();
        } catch {
          // nothing to synthesise right now
        }
        await flush(5);
        if (sp.pendingPlays > 0) sp.finishPlay();
        await flush(5);
      }
    });

    expect(sp.synthesized).toEqual(['PARACETAMOL', 'Tablets BP 500 mg', 'Store below 30°C.']);
    expect(sp.playedNames().slice(sp.playedNames().indexOf('label_says'))).toEqual([
      'label_says',
      'file:///tts/1.wav',
      'file:///tts/2.wav',
      'line_unsure',
      'file:///tts/3.wav',
      'reading_end',
    ]);
  });

  it('batch, manufacturing and maker lines are shown under More details and never spoken; the expiry is', async () => {
    const services = setup();
    services.speech.autoFinish = true;
    await settle();
    await takePhoto(services);
    await act(async () => {
      services.finishOcr(
        blocksFor([
          'PARACETAMOL',
          'Tablets BP 500 mg',
          'Batch No: PX2417 Exp: 08/2028',
          'Mfg: 01/2026',
          'Manufactured by: Generic Pharma Ltd',
        ]),
      );
      await flush(40);
    });

    expect(screen.getByTestId('reading-screen')).toBeTruthy();
    // The batch line holds the expiry, so it stays with the read lines, in full.
    expect(screen.getByTestId('reading-line-2')).toBeTruthy();
    expect(screen.getByText('Batch No: PX2417 Exp: 08/2028')).toBeTruthy();
    expect(screen.getByTestId('reading-details')).toBeTruthy();
    expect(screen.getByTestId('reading-detail-3')).toBeTruthy();
    expect(screen.getByText('Mfg: 01/2026')).toBeTruthy();
    expect(screen.getByText('Manufactured by: Generic Pharma Ltd')).toBeTruthy();
    expect(screen.queryByTestId('reading-line-3')).toBeNull();
    expect(services.speech.synthesized).toEqual(['PARACETAMOL', 'Tablets BP 500 mg', 'Exp: 08/2028']);
  });

  it('highlights the line being spoken, and clears it when reading ends', async () => {
    const services = setup();
    await settle();
    await takePhoto(services);
    await act(async () => {
      services.finishOcr(blocksFor(['AMOXICILLIN', 'Capsules BP 250 mg']));
      await flush(20);
    });
    const sp = services.speech;
    await act(async () => {
      sp.finishSynth();
      sp.finishPlay(); // label_says
      await flush(10);
    });
    expect(screen.getByTestId('reading-line-0').props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByTestId('reading-line-1').props.accessibilityState).toEqual({ selected: false });

    await act(async () => {
      sp.autoFinish = true;
      sp.finishSynth();
      sp.finishPlay();
      await flush(20);
      sp.finishPlay();
      await flush(20);
    });
    expect(screen.getByTestId('reading-line-0').props.accessibilityState).toEqual({ selected: false });
    expect(screen.getByTestId('reading-line-1').props.accessibilityState).toEqual({ selected: false });
  });

  it('Polepole restarts the reading slower; Rudi stops the voice and goes home', async () => {
    const services = setup();
    services.speech.autoFinish = true;
    await settle();
    await takePhoto(services);
    await act(async () => {
      services.finishOcr(blocksFor(['AMOXICILLIN']));
      await flush(20);
    });
    fireEvent.press(screen.getByTestId('reading-slower'));
    await settle();
    const names = services.speech.playedNames();
    const from = names.lastIndexOf('btn_slower');
    expect(names.slice(from)).toEqual(['btn_slower', 'label_says', expect.stringMatching(/tts/), 'reading_end']);
    expect(services.speech.rates.at(-1)).toBe(0.8);

    const stopsBefore = services.speech.stops;
    fireEvent.press(screen.getByTestId('reading-back'));
    await settle();
    expect(services.speech.stops).toBeGreaterThan(stopsBefore);
    expect(screen.getByTestId('home-read')).toBeTruthy();
  });

  it('a handwritten dose label goes to Not sure: nothing from it is shown or spoken', async () => {
    const services = setup();
    services.speech.autoFinish = true;
    await settle();
    await takePhoto(services);
    await act(async () => {
      services.finishOcr(blocksFor([{ text: 'Tab 4 tds', confidence: 0.93 }, 'after food']));
      await flush(20);
    });
    expect(screen.getByTestId('not-sure-screen')).toBeTruthy();
    expect(screen.queryByText('Tab 4 tds')).toBeNull();
    expect(services.speech.synthesized).toEqual([]);
    expect(services.speech.playedNames().slice(-2)).toEqual(['not_sure', 'try_again_light']);

    fireEvent.press(screen.getByTestId('not-sure-try-again'));
    await settle();
    expect(screen.getByTestId('aiming-screen')).toBeTruthy();
  });

  it('text cut off at the edge: speaks the hint on the camera, and "Soma hii" reads it anyway', async () => {
    const services = setup();
    services.speech.autoFinish = true;
    await settle();
    await takePhoto(services);
    await act(async () => {
      services.finishOcr(blocksFor(['PARACETAMOL', 'Tablets BP 500 mg', '100 Tablets', 'Store below 30°C.'], { left: 0 }));
      await flush(20);
    });
    expect(screen.getByTestId('aiming-screen')).toBeTruthy();
    expect(screen.getByText('Sogeza kushoto kidogo.')).toBeTruthy();
    expect(services.speech.playedNames().at(-1)).toBe('hint_left');

    fireEvent.press(screen.getByTestId('aiming-read-anyway'));
    await settle();
    expect(screen.getByTestId('reading-screen')).toBeTruthy();
    expect(screen.getByText('PARACETAMOL')).toBeTruthy();
  });

  it('no text found: hint to point at the label, and no "Soma hii"', async () => {
    const services = setup();
    services.speech.autoFinish = true;
    await settle();
    await takePhoto(services);
    await act(async () => {
      services.finishOcr([]);
      await flush(20);
    });
    expect(screen.getByTestId('aiming-hint')).toBeTruthy();
    expect(services.speech.playedNames().at(-1)).toBe('hint_no_text');
    expect(screen.queryByTestId('aiming-read-anyway')).toBeNull();
  });

  it('going back while OCR runs drops its result: the app stays home and reads nothing', async () => {
    const services = setup();
    services.speech.autoFinish = true;
    await settle();
    await takePhoto(services);
    fireEvent.press(screen.getByTestId('processing-back'));
    await settle();
    expect(screen.getByTestId('home-read')).toBeTruthy();

    await act(async () => {
      services.finishOcr(blocksFor(['PARACETAMOL']));
      await flush(20);
    });
    expect(screen.getByTestId('home-read')).toBeTruthy();
    expect(screen.queryByTestId('reading-screen')).toBeNull();
    expect(services.speech.synthesized).toEqual([]);
  });

  it('pressing Back while the camera is still taking the photo: no read starts when it arrives', async () => {
    let deliver!: (p: typeof PHOTO) => void;
    mockTakePicture.mockReturnValue(new Promise((r) => (deliver = r)));
    const services = setup();
    services.speech.autoFinish = true;
    await settle();
    fireEvent.press(screen.getByTestId('home-read'));
    await settle();
    fireEvent.press(screen.getByTestId('aiming-capture'));
    await settle();
    fireEvent.press(screen.getByTestId('aiming-back'));
    await settle();
    await act(async () => {
      deliver(PHOTO);
      await flush(20);
    });
    expect(screen.getByTestId('home-read')).toBeTruthy();
    expect(services.prepared).toEqual([]);
    expect(services.recognized).toEqual([]);
  });

  it('an OCR failure returns to the camera and says something went wrong', async () => {
    const services = setup();
    services.speech.autoFinish = true;
    await settle();
    await takePhoto(services);
    await act(async () => {
      services.failOcr(new Error('worker died'));
      await flush(20);
    });
    expect(screen.getByTestId('aiming-screen')).toBeTruthy();
    expect(services.speech.playedNames().at(-1)).toBe('error');
  });

  it('a photo chosen from the library goes through the same reading', async () => {
    const services = setup();
    services.speech.autoFinish = true;
    services.pickResult = { uri: 'file:///library/label.jpg', width: 3024, height: 4032 };
    await settle();
    fireEvent.press(screen.getByTestId('home-read'));
    await settle();
    fireEvent.press(screen.getByTestId('aiming-pick'));
    await settle();
    expect(services.prepared).toEqual([services.pickResult]);
    expect(services.recognized).toEqual(['file:///library/label.jpg#small']);
  });

  it('asks for the camera when permission is missing, and takes no photo', async () => {
    mockPermission = { granted: false, canAskAgain: true };
    const services = setup();
    services.speech.autoFinish = true;
    await settle();
    fireEvent.press(screen.getByTestId('home-read'));
    await settle();
    expect(screen.getByTestId('aiming-allow-camera')).toBeTruthy();
    expect(screen.queryByTestId('aiming-capture')).toBeNull();
    expect(services.speech.playedNames().at(-1)).toBe('camera_permission');
  });

  it('stops the voice and frees the models when the reader goes away', async () => {
    const services = new FakeReaderServices();
    const { unmount } = render(<ReadFlow services={services} />);
    await settle();
    unmount();
    expect(services.speech.stops).toBeGreaterThan(0);
    expect(services.released).toBe(1);
  });
});
