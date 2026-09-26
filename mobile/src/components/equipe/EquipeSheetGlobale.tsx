import { useRouter } from 'expo-router';
import { useAuthStore } from '@/lib/auth-store';
import { peutCreerEquipe } from '@/lib/equipe-aerienne-access';
import { useEquipeSheetStore } from '@/lib/equipe-sheet-store';
import { useEquipesDeTravail } from '@/hooks/use-equipes-de-travail';
import { EquipeSheet } from './EquipeSheet';

/** La feuille de choix de l'équipe de travail, montée une fois à la racine (#678). */
export function EquipeSheetGlobale() {
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const visible = useEquipeSheetStore((s) => s.visible);
  const fermer = useEquipeSheetStore((s) => s.fermer);
  const { equipes, courante, choisir } = useEquipesDeTravail();

  return (
    <EquipeSheet
      visible={visible}
      equipes={equipes}
      equipeId={courante?.id ?? null}
      peutCreer={peutCreerEquipe(role)}
      onFermer={fermer}
      onConfirmer={(id) => {
        void choisir(id);
        fermer();
      }}
      onCreer={() => {
        fermer();
        router.push('/(app)/equipe-nouvelle' as any);
      }}
    />
  );
}
