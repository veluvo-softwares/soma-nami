import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { AppShell } from './AppShell';
import { FakeModelClient, flush, TEST_MANIFEST } from './model-store/testing';
import { FakeReaderServices } from './reader/testing';
import { themes } from './theme';

jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }));

let reader: FakeReaderServices;
beforeEach(() => {
  reader = new FakeReaderServices();
  reader.speech.autoFinish = true;
});

async function settle() {
  await act(async () => {
    await flush(30);
  });
}

describe('AppShell read gate', () => {
  it('goes straight to the read screen when every model is already on the phone', async () => {
    const client = new FakeModelClient();
    client.cached = new Set(['OCR_CRAFT', 'OCR_LATIN']);
    render(<AppShell client={client} manifest={TEST_MANIFEST} reader={reader} />);
    await settle();

    expect(screen.getByTestId('read-screen')).toBeTruthy();
    expect(client.started).toEqual([]);
  });

  it('shows the models screen and no read screen until the download finishes', async () => {
    const client = new FakeModelClient();
    render(<AppShell client={client} manifest={TEST_MANIFEST} reader={reader} />);
    await settle();

    // Nothing downloads until the user asks.
    expect(client.started).toEqual([]);
    expect(screen.queryByTestId('read-screen')).toBeNull();
    expect(screen.getByTestId('models-download')).toBeTruthy();

    fireEvent.press(screen.getByTestId('models-download'));
    await settle();
    expect(client.started).toEqual(['OCR_CRAFT']);
    expect(screen.queryByTestId('read-screen')).toBeNull();
    expect(screen.queryByTestId('models-download')).toBeNull(); // no double start

    await act(async () => {
      client.finish();
      await flush(30);
    });
    expect(screen.queryByTestId('read-screen')).toBeNull();

    await act(async () => {
      client.finish();
      await flush(30);
    });
    expect(screen.getByTestId('read-screen')).toBeTruthy();
  });

  it('shows the error and a retry that resumes, and stays gated meanwhile', async () => {
    const client = new FakeModelClient();
    render(<AppShell client={client} manifest={TEST_MANIFEST} reader={reader} />);
    await settle();

    fireEvent.press(screen.getByTestId('models-download'));
    await settle();
    await act(async () => {
      client.fail(new Error('Blob download timed out'));
      await flush(30);
    });

    expect(screen.getByTestId('models-error').props.children).toBe('Blob download timed out');
    expect(screen.queryByTestId('read-screen')).toBeNull();

    fireEvent.press(screen.getByTestId('models-download'));
    await settle();
    expect(client.started).toEqual(['OCR_CRAFT', 'OCR_CRAFT']);

    await act(async () => {
      client.finish();
      await flush(30);
    });
    await act(async () => {
      client.finish();
      await flush(30);
    });
    expect(screen.getByTestId('read-screen')).toBeTruthy();
  });

  it('paints the screens from the chosen theme, dark by default', async () => {
    const client = new FakeModelClient();
    client.cached = new Set(['OCR_CRAFT', 'OCR_LATIN']);
    const { rerender } = render(<AppShell client={client} manifest={TEST_MANIFEST} reader={reader} />);
    await settle();
    expect(screen.getByTestId('read-screen')).toHaveStyle({ backgroundColor: themes.dark.background });

    rerender(<AppShell client={client} manifest={TEST_MANIFEST} reader={reader} theme="light" />);
    await settle();
    expect(screen.getByTestId('read-screen')).toHaveStyle({
      backgroundColor: themes.light.background,
    });
  });

  it('cancels the download when the app unmounts', async () => {
    const client = new FakeModelClient();
    const { unmount } = render(<AppShell client={client} manifest={TEST_MANIFEST} reader={reader} />);
    await settle();
    fireEvent.press(screen.getByTestId('models-download'));
    await settle();
    const inFlight = client.current();

    unmount();
    await act(async () => {
      await flush(30);
    });

    expect(inFlight.cancelled).toBe(true);
    expect(client.started).toEqual(['OCR_CRAFT']);
  });
});

describe('AppShell caregiver setup and language', () => {
  async function openSetup() {
    const client = new FakeModelClient();
    client.cached = new Set(['OCR_CRAFT', 'OCR_LATIN']);
    render(<AppShell client={client} manifest={TEST_MANIFEST} reader={reader} />);
    await settle();
    fireEvent.press(screen.getByTestId('home-setup'));
    await settle();
    expect(screen.getByTestId('setup-screen')).toBeTruthy();
  }

  it('Swahili first by default: the button label is Swahili and the hint is English', async () => {
    await openSetup();
    const done = screen.getByTestId('setup-done');
    expect(done.props.accessibilityLabel).toBe('Tayari');
    expect(done.props.accessibilityHint).toBe('Done');
  });

  it('the language toggle swaps label and hint on every screen, and back', async () => {
    await openSetup();
    fireEvent.press(screen.getByTestId('language-en'));
    await settle();
    expect(screen.getByTestId('language-en').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('language-sw').props.accessibilityState.selected).toBe(false);
    expect(screen.getByTestId('setup-done').props.accessibilityLabel).toBe('Done');
    expect(screen.getByTestId('setup-done').props.accessibilityHint).toBe('Tayari');

    fireEvent.press(screen.getByTestId('setup-done'));
    await settle();
    expect(screen.getByTestId('home-read').props.accessibilityLabel).toBe('Tap to read');
    expect(screen.getByTestId('home-read').props.accessibilityHint).toBe('Gusa kusoma');

    fireEvent.press(screen.getByTestId('home-setup'));
    await settle();
    fireEvent.press(screen.getByTestId('language-sw'));
    await settle();
    expect(screen.getByTestId('setup-done').props.accessibilityLabel).toBe('Tayari');
  });

  it('voice speed, theme and the helper number are chosen here, and the number is cleaned', async () => {
    await openSetup();
    fireEvent.press(screen.getByTestId('speed-slow'));
    fireEvent.press(screen.getByTestId('theme-light'));
    fireEvent.changeText(screen.getByTestId('helper-number'), '0700 abc 123');
    await settle();
    expect(screen.getByTestId('speed-slow').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('theme-light').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('helper-number').props.value).toBe('0700  123');
  });
});
