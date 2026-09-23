import { traitementColors } from '@/components/traitement/tokens';

type Hex = `#${string}`;

function hexToRgb(hex: Hex) {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((char) => char + char).join('')
    : normalized;

  const number = Number.parseInt(value, 16);
  return {
    r: (number >> 16) & 255,
    g: (number >> 8) & 255,
    b: number & 255,
  };
}

function luminance(hex: Hex) {
  const { r, g, b } = hexToRgb(hex);
  const channels = [r, g, b].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground: Hex, background: Hex) {
  const lumA = luminance(foreground);
  const lumB = luminance(background);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('traitementColors', () => {
  it('maintient un contraste suffisant sur fond clair pour la lisibilité en plein soleil', () => {
    expect(contrastRatio(traitementColors.texteTitre, traitementColors.fondApp)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(traitementColors.texteSecondaire, traitementColors.fondApp)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(traitementColors.texteLabel, traitementColors.fondApp)).toBeGreaterThanOrEqual(4.5);
  });
});
