import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { cn } from '@/lib/utils'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { ErrorBanner } from '@/components/ui/error-banner'
import { NavTabs } from '@/components/ui/nav-tabs'
import { StatusBadge } from '@/components/ui/status-badge'
import { STATUS_LABELS } from '@/lib/traitement-labels'
import { formatHeure } from '@/lib/traitement-fiche'
import { formatDureeMinutes, ROLE_SIGNATURE_LABELS, TYPE_VOL_LABELS } from '@/lib/fiche-vol'
import {
  buildLignesBlocs,
  essaimsIndicateur,
  type BlocDetail,
} from '@/lib/fiche-vol-fiche-lecture'
import { useAnnuaire } from '@/lib/use-annuaire'

interface Vol {
  id: string
  numero: number
  type_vol: string
  heure_debut: string
  heure_fin: string
  rotation_id: string | null
  prospection_id: string | null
  observations: string | null
  duree_minutes: number
  // Résolus par jointure côté backend (jamais saisis) — null pour un vol sans
  // rotation (convoyage) ou dont la rotation n'a pas encore de bloc rattaché.
  numero_cuve: string | null
  produit_nom: string | null
  bloc: BlocDetail | null
}

interface SignatureVol {
  id: string
  role: string
  signataire_nom: string
  horodatage: string | null
}

interface FicheVolDetail {
  id: string
  numero_fiche: string
  date_vol: string
  compagnie: string
  immatriculation: string
  base_code: string
  base_nom: string
  stand_nom: string
  // Champs bruts renvoyés par l'API (fiche_vol_schemas.FicheVolRead), utilisés
  // uniquement par la vue imprimable A4 — base_code/base_nom/stand_nom ci-dessus
  // restent ceux déjà consommés par l'en-tête à l'écran.
  base_numero: string | null
  base_localite: string | null
  stand_numero: string | null
  stand_localite: string | null
  pilote: string
  mecanicien: string
  chef_de_base_id: string
  // Équipe aérienne choisie à la création (migration 0075) — null pour une fiche antérieure.
  equipe_aerienne_nom?: string | null
  consultant_international: string | null
  pesticide_nom_commercial: string | null
  pesticide_quantite_disponible: number | null
  pesticide_quantite_recue: number | null
  pesticide_quantite_utilisee: number | null
  pesticide_quantite_restante: number | null
  futs_disponible: number | null
  futs_recues: number | null
  futs_pleins: number | null
  futs_vides: number | null
  observations: string | null
  statut: string
  vols: Vol[]
  signatures: SignatureVol[]
  duree_totale_minutes: number
}

interface Cumuls {
  jour: number
  semaine: number
  mois: number
  total: number
}

/** Carte blanche de la maquette — même rayon/bordure que la liste (FichesVolPage). */
function Carte({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-[11px] border border-[#e7e0cd] bg-card', className)}>
      {children}
    </section>
  )
}

function Champ({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="font-sans text-[11.5px] font-medium text-ifvm-text-tertiary">{label}</span>
      <span className="font-mono text-[12px] font-semibold text-[#16201a]">{value ?? '—'}</span>
    </div>
  )
}

export function FicheVolDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { nomAgent } = useAnnuaire()
  const [showPrintView, setShowPrintView] = useState(false)

  const {
    data: fiche,
    isLoading,
    isError,
    error,
  } = useQuery<FicheVolDetail>({
    queryKey: ['fiche-vol', id],
    queryFn: () => api.get(`/fiches-vol/${id}`).then((r) => r.data),
    enabled: !!id,
  })

  // Cumuls (jour/semaine/mois/total, cf. #suivi-heures-de-vol) pour le même
  // appareil, calculés côté serveur — jamais dérivés côté client, une simple
  // correction d'horaire ne doit rien désynchroniser (cf. domaine backend).
  const { data: cumuls } = useQuery<Cumuls>({
    queryKey: ['fiche-vol-cumuls', fiche?.immatriculation, fiche?.date_vol],
    queryFn: () =>
      api
        .get('/fiches-vol/cumuls', {
          params: { reference: fiche!.date_vol, immatriculation: fiche!.immatriculation },
        })
        .then((r) => r.data),
    enabled: !!fiche,
  })

  // Même mécanisme que ProspectionDetailPage (#19) : bascule showPrintView,
  // déclenche l'impression navigateur, puis revient à l'écran normal une fois la
  // boîte de dialogue d'impression fermée (événement `afterprint`).
  useEffect(() => {
    if (!showPrintView) return
    const handleAfterPrint = () => setShowPrintView(false)
    window.addEventListener('afterprint', handleAfterPrint)
    window.print()
    return () => window.removeEventListener('afterprint', handleAfterPrint)
  }, [showPrintView])

  const volsColumns: DataTableColumn<Vol>[] = [
    { key: 'numero', header: 'N°', mono: true, render: (v) => v.numero },
    { key: 'type', header: 'Type', render: (v) => TYPE_VOL_LABELS[v.type_vol] ?? v.type_vol },
    {
      key: 'horaire',
      header: 'Horaire',
      align: 'right',
      mono: true,
      render: (v) => `${formatHeure(v.heure_debut)} → ${formatHeure(v.heure_fin)}`,
    },
    {
      key: 'duree',
      header: 'Durée',
      align: 'right',
      mono: true,
      render: (v) => formatDureeMinutes(v.duree_minutes),
    },
    {
      key: 'rattachement',
      header: 'Rattachement',
      render: (v) =>
        v.prospection_id ? (
          // Libellé distinct de « Prospection » (déjà le libellé du type de vol
          // sur cette même ligne, cf. colonne Type) — sinon la ligne répète le
          // même mot deux fois pour un vol PROSPECTION rattaché.
          <Link to={`/prospections/${v.prospection_id}`} className="font-mono text-[11.5px] underline">
            Voir la fiche ›
          </Link>
        ) : v.rotation_id ? (
          <span className="font-mono text-[11.5px] text-ifvm-text-tertiary">Rotation</span>
        ) : (
          <span className="text-ifvm-text-tertiary">—</span>
        ),
    },
    {
      key: 'observations',
      header: 'Observations',
      render: (v) => <span className="text-ifvm-text-tertiary">{v.observations ?? '—'}</span>,
    },
  ]

  const signaturesColumns: DataTableColumn<SignatureVol>[] = [
    { key: 'role', header: 'Rôle', render: (s) => ROLE_SIGNATURE_LABELS[s.role] ?? s.role },
    { key: 'signataire', header: 'Signataire', render: (s) => s.signataire_nom },
    {
      key: 'horodatage',
      header: 'Signée le',
      align: 'right',
      mono: true,
      render: (s) => (s.horodatage ? new Date(s.horodatage).toLocaleString('fr-FR') : '—'),
    },
  ]

  if (isLoading) {
    return (
      <div className="px-7 pb-10 pt-[26px]">
        <p className="font-sans text-[12px] text-ifvm-text-tertiary">Chargement…</p>
      </div>
    )
  }

  if (isError || !fiche) {
    const status = (error as { response?: { status?: number } })?.response?.status
    const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
    const label = status ? STATUS_LABELS[status] ?? `Erreur ${status}` : 'Erreur'
    const message = detail ?? 'Impossible de charger cette fiche de vol.'
    return (
      <div className="flex flex-col gap-4 px-7 pb-10 pt-[26px]">
        <NavTabs
          ariaLabel="Vues des fiches de vol"
          items={[{ label: 'Liste des fiches', to: '/fiches-vol', active: false }]}
        />
        <ErrorBanner label={label} message={message} />
      </div>
    )
  }

  const lectureSeule = fiche.statut === 'validee'

  return (
    <div className="flex flex-col gap-4 px-7 pb-10 pt-[26px]">
      <NavTabs
        ariaLabel="Vues des fiches de vol"
        items={[
          { label: 'Liste des fiches', to: '/fiches-vol', active: false },
          { label: `Détail · ${fiche.numero_fiche}`, to: `/fiches-vol/${fiche.id}`, active: true },
        ]}
      />

      <header
        data-testid="fiche-vol-header"
        className="flex items-center gap-[18px] rounded-[12px] bg-ifvm-green-text px-[22px] py-5 text-white"
      >
        <div className="min-w-0 flex-1">
          <h1 className="font-mono text-[17px] font-bold">{fiche.numero_fiche}</h1>
          <p className="mt-1 font-sans text-[12px] font-medium text-white/75">
            {fiche.date_vol} · {fiche.immatriculation} · {fiche.compagnie}
          </p>
        </div>
        <StatusBadge statut={fiche.statut} />
        {lectureSeule && (
          <span className="shrink-0 rounded-full bg-white/[.16] px-3 py-[6px] font-sans text-[11px] font-bold">
            🔒 Lecture seule
          </span>
        )}
        {lectureSeule && (
          <button
            type="button"
            onClick={() => setShowPrintView(true)}
            className="shrink-0 rounded-[9px] bg-white px-[14px] py-[9px] font-sans text-[11.5px] font-bold text-ifvm-green-text"
          >
            Imprimer A4
          </button>
        )}
      </header>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1fr_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Carte className="overflow-hidden">
            <div className="flex items-baseline gap-3 border-b border-[#f1ecdd] px-5 py-[15px]">
              <h2 className="font-sans text-[14px] font-bold">Vols</h2>
              <div className="flex-1" />
              <p className="font-mono text-[12px] font-semibold text-ifvm-green-text">
                {formatDureeMinutes(fiche.duree_totale_minutes)}
              </p>
            </div>
            <DataTable
              columns={volsColumns}
              rows={fiche.vols}
              getRowKey={(v) => v.id}
              emptyMessage="Aucun vol enregistré sur cette fiche."
            />
          </Carte>

          <Carte className="overflow-hidden">
            <div className="border-b border-[#f1ecdd] px-5 py-[15px]">
              <h2 className="font-sans text-[14px] font-bold">Signatures</h2>
            </div>
            <DataTable
              columns={signaturesColumns}
              rows={fiche.signatures}
              getRowKey={(s) => s.id}
              emptyMessage="Aucune signature enregistrée."
            />
          </Carte>

          {fiche.observations && (
            <Carte className="p-5">
              <h2 className="mb-2 font-sans text-[14px] font-bold">Observations</h2>
              <p className="whitespace-pre-wrap font-sans text-[12.5px] text-[#3a3a2f]">
                {fiche.observations}
              </p>
            </Carte>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Carte className="flex flex-col gap-2 p-5">
            <h2 className="mb-1 font-sans text-[13px] font-bold">Appareil &amp; équipage</h2>
            <Champ label="Équipe" value={fiche.equipe_aerienne_nom ?? null} />
            <Champ label="Base" value={`${fiche.base_code} · ${fiche.base_nom}`} />
            <Champ label="Stand" value={fiche.stand_nom} />
            <Champ label="Pilote" value={fiche.pilote} />
            <Champ label="Mécanicien" value={fiche.mecanicien} />
            <Champ label="Chef de base" value={nomAgent(fiche.chef_de_base_id)} />
            <Champ label="Consultant international" value={fiche.consultant_international} />
          </Carte>

          <Carte className="flex flex-col gap-2 p-5">
            <h2 className="mb-1 font-sans text-[13px] font-bold">
              Cumuls · {fiche.immatriculation}
            </h2>
            <p className="mb-1 font-sans text-[10.5px] text-ifvm-text-weak">
              Calculés en référence au {fiche.date_vol} — jamais stockés, recalculés à chaque
              consultation.
            </p>
            {cumuls ? (
              <>
                <Champ label="Jour" value={formatDureeMinutes(cumuls.jour)} />
                <Champ label="Semaine (ISO)" value={formatDureeMinutes(cumuls.semaine)} />
                <Champ label="Mois" value={formatDureeMinutes(cumuls.mois)} />
                <Champ label="Total" value={formatDureeMinutes(cumuls.total)} />
              </>
            ) : (
              <p className="font-sans text-[11.5px] text-ifvm-text-tertiary">Chargement…</p>
            )}
          </Carte>
        </div>
      </div>

      {showPrintView && <FicheImprimable fiche={fiche} cumuls={cumuls} nomAgent={nomAgent} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Vue imprimable A4 (#fiche-vol-impression) — reprend la mise en page papier
// « FICHE QUOTIDIENNE DE COMPTE RENDU DE VOL », même patron que la vue
// imprimable de ProspectionDetailPage (#19) : dérivée de la fiche déjà chargée,
// aucun nouvel appel API.
// ---------------------------------------------------------------------------

function ChampImprimable({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{value ?? '—'}</dd>
    </div>
  )
}

function FicheImprimable({
  fiche,
  cumuls,
  nomAgent,
}: {
  fiche: FicheVolDetail
  cumuls: Cumuls | undefined
  nomAgent: (id: string) => string
}) {
  const lignesBlocs = buildLignesBlocs(fiche.vols)
  const essaims = essaimsIndicateur(fiche.vols)

  return (
    <div data-testid="fiche-imprimable" className="fiche-imprimable">
      <header className="mb-6 text-center">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          IFVM — Fiche quotidienne de compte rendu de vol
        </p>
        <h2 className="text-xl font-bold">Fiche n° {fiche.numero_fiche}</h2>
        <p className="mt-1 text-sm font-medium">
          {fiche.date_vol} · {fiche.immatriculation} · {fiche.compagnie}
        </p>
      </header>

      <dl className="mb-4 grid grid-cols-2 gap-4 text-sm">
        <ChampImprimable label="Équipe" value={fiche.equipe_aerienne_nom ?? null} />
        <ChampImprimable
          label="Base"
          value={[fiche.base_numero, fiche.base_localite].filter(Boolean).join(' · ') || null}
        />
        <ChampImprimable
          label="Stand"
          value={[fiche.stand_numero, fiche.stand_localite].filter(Boolean).join(' · ') || null}
        />
        <ChampImprimable label="Pilote" value={fiche.pilote} />
        <ChampImprimable label="Mécanicien" value={fiche.mecanicien} />
        <ChampImprimable label="Chef de base" value={nomAgent(fiche.chef_de_base_id)} />
        <ChampImprimable
          label="Consultant international"
          value={fiche.consultant_international}
        />
      </dl>

      <h3 className="mb-2 mt-4 text-sm font-semibold">Blocs traités</h3>
      <table className="w-full border text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-2 py-1 text-left">Bloc</th>
            <th className="px-2 py-1 text-left">Cuve</th>
            <th className="px-2 py-1 text-left">Localité</th>
            <th className="px-2 py-1 text-left">Espèce</th>
            <th className="px-2 py-1 text-right">Surf. théo.</th>
            <th className="px-2 py-1 text-right">Surf. protégée</th>
            <th className="px-2 py-1 text-right">Surf. traitée</th>
            <th className="px-2 py-1 text-right">Andain</th>
            <th className="px-2 py-1 text-right">Interpasse</th>
            <th className="px-2 py-1 text-right">Hauteur de vol</th>
            <th className="px-2 py-1 text-left">Observation</th>
          </tr>
        </thead>
        <tbody>
          {lignesBlocs.length === 0 ? (
            <tr>
              <td colSpan={11} className="px-2 py-2 text-center text-muted-foreground">
                Aucun vol rattaché à un bloc traité.
              </td>
            </tr>
          ) : (
            lignesBlocs.map((l) => (
              <tr key={l.volId} className="border-b">
                <td className="px-2 py-1 font-medium">
                  {l.blocNumero} — {l.blocNom}
                </td>
                <td className="px-2 py-1">{l.numeroCuve}</td>
                <td className="px-2 py-1">{l.localite}</td>
                <td className="px-2 py-1">{l.espece}</td>
                <td className="px-2 py-1 text-right">{l.surfaceTheoriqueHa}</td>
                <td className="px-2 py-1 text-right">{l.surfaceProtegeeHa}</td>
                <td className="px-2 py-1 text-right">{l.surfaceTraiteeHa}</td>
                <td className="px-2 py-1 text-right">{l.largeurAndainM}</td>
                <td className="px-2 py-1 text-right">{l.interpasseM}</td>
                <td className="px-2 py-1 text-right">{l.hauteurVol}</td>
                <td className="px-2 py-1">{l.observation}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted-foreground">
        Essaims observés durant le traitement (indicateur global au traitement, non
        détaillé par bloc) : {essaims ?? '—'}
      </p>

      <h3 className="mb-2 mt-4 text-sm font-semibold">
        Cumuls d'heures de vol · {fiche.immatriculation}
      </h3>
      {cumuls ? (
        <dl className="grid grid-cols-4 gap-4 text-sm">
          <ChampImprimable label="Jour" value={formatDureeMinutes(cumuls.jour)} />
          <ChampImprimable label="Semaine (ISO)" value={formatDureeMinutes(cumuls.semaine)} />
          <ChampImprimable label="Mois" value={formatDureeMinutes(cumuls.mois)} />
          <ChampImprimable label="Total" value={formatDureeMinutes(cumuls.total)} />
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">Cumuls non disponibles.</p>
      )}

      <h3 className="mb-2 mt-4 text-sm font-semibold">Pesticide</h3>
      <dl className="grid grid-cols-2 gap-4 text-sm">
        <ChampImprimable label="Produit" value={fiche.pesticide_nom_commercial} />
        <ChampImprimable
          label="Disponible / reçue"
          value={`${fiche.pesticide_quantite_disponible ?? '—'} / ${fiche.pesticide_quantite_recue ?? '—'}`}
        />
        <ChampImprimable
          label="Utilisée / restante"
          value={`${fiche.pesticide_quantite_utilisee ?? '—'} / ${fiche.pesticide_quantite_restante ?? '—'}`}
        />
        <ChampImprimable
          label="Fûts (disponibles / reçus / pleins / vides)"
          value={`${fiche.futs_disponible ?? '—'} / ${fiche.futs_recues ?? '—'} / ${fiche.futs_pleins ?? '—'} / ${fiche.futs_vides ?? '—'}`}
        />
      </dl>

      {fiche.observations && (
        <>
          <h3 className="mb-2 mt-4 text-sm font-semibold">Remarques</h3>
          <p className="whitespace-pre-wrap text-sm">{fiche.observations}</p>
        </>
      )}

      <h3 className="mb-2 mt-4 text-sm font-semibold">Signatures</h3>
      <table className="w-full border text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-2 py-1 text-left">Rôle</th>
            <th className="px-2 py-1 text-left">Signataire</th>
            <th className="px-2 py-1 text-right">Signée le</th>
          </tr>
        </thead>
        <tbody>
          {fiche.signatures.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-2 py-2 text-center text-muted-foreground">
                Aucune signature enregistrée.
              </td>
            </tr>
          ) : (
            fiche.signatures.map((s) => (
              <tr key={s.id} className="border-b">
                <td className="px-2 py-1">{ROLE_SIGNATURE_LABELS[s.role] ?? s.role}</td>
                <td className="px-2 py-1">{s.signataire_nom}</td>
                <td className="px-2 py-1 text-right">
                  {s.horodatage ? new Date(s.horodatage).toLocaleString('fr-FR') : '—'}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
