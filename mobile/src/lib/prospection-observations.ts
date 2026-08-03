export const ENNEMIS_OPTIONS = ['Oiseaux', 'Fourmis', 'Reptiles', 'Mantes'] as const;

export interface EnnemisSelection {
  selected: string[];
  autre: string;
}

/** Persisté comme texte libre côté backend (`ennemis_naturels`) : les presets et le texte "autre" sont joints par ", ". */
export function serializeEnnemis(selected: string[], autre: string): string | null {
  const tokens = [...selected, ...(autre.trim() ? [autre.trim()] : [])];
  return tokens.length ? tokens.join(', ') : null;
}

export function parseEnnemis(raw: string | null): EnnemisSelection {
  if (!raw) return { selected: [], autre: '' };
  const tokens = raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  const selected = tokens.filter((t) => (ENNEMIS_OPTIONS as readonly string[]).includes(t));
  const autre = tokens.filter((t) => !(ENNEMIS_OPTIONS as readonly string[]).includes(t)).join(', ');
  return { selected, autre };
}
