import { PHENOTYPES, Phenotype } from './prospection-fiche-lecture';

export function accouplementInsight(ponte: string | null, dominant: Phenotype | null): string | null {
  if (!ponte || ponte === 'Néant') return null;
  if (dominant !== 'transiens' && dominant !== 'gregaire') return null;
  const label = PHENOTYPES.find((p) => p.value === dominant)?.label ?? dominant;
  return `Ponte ${ponte} + phase ${label} → signal de reproduction à surveiller.`;
}
