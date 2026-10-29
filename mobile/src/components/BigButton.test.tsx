import { fireEvent, render, screen } from '@testing-library/react-native';

import { BigButton } from './BigButton';

describe('BigButton: words never break across lines', () => {
  it('shrinks its text to fit instead of splitting a word ("Kiswa/hili", "Polepol/e")', () => {
    render(<BigButton testID="b" icon="translate" sw="Kiingereza" en="English" onPress={() => undefined} layout="stacked" />);
    for (const word of ['Kiingereza', 'English']) {
      const text = screen.getByText(word);
      expect(text.props.adjustsFontSizeToFit).toBe(true);
      expect(text.props.minimumFontScale).toBeGreaterThan(0);
      expect(text.props.numberOfLines).toBe(2);
    }
  });

  it('keeps the label, a hint override and the open/closed state for a screen reader', () => {
    const onPress = jest.fn();
    render(<BigButton testID="b" icon="chevron-up" sw="Zaidi" en="More" hint="Opens more" expanded={false} onPress={onPress} />);
    const b = screen.getByTestId('b');
    expect(b.props.accessibilityLabel).toBe('Zaidi');
    expect(b.props.accessibilityHint).toBe('Opens more');
    expect(b.props.accessibilityState).toEqual({ disabled: false, expanded: false });
    fireEvent.press(b);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
