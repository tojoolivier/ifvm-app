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
  base_numero: string | null
  base_localite: string | null
  stand_numero: string | null
  stand_localite: string | null
  pilote: string
  mecanicien: string
  chef_de_base_id: string
  consultant_international: string | null
  // Prospection "principale" affichée en en-tête (migration backend 0070) —
  // facultative, distincte du rattachement par vol (Vol.prospection_id).
  prospection_id: string | null
  prospection_numero_fiche: string | null
  prospection_date_validation: string | null
  // Un seul produit par fiche (pas de FK vers le référentiel pesticide,
  // asymétrie avec traitement_rotation.produit_id — cf. ADR-011 §8.4).
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

interface Bloc {
  id: string
  nom: string
  localite: string | null
  surface_protegee_ha: number | null
  surface_traitee_ha: number | null
  interpasse_m: number | null
  hauteur_vol_min_m: number | null
  hauteur_vol_max_m: number | null
  observation: string | null
}

interface Rotation {
  id: string
  numero_cuve: string
  nom_commercial: string | null
  quantite: number
  unite: string
  temperature_debut_c: number
  temperature_fin_c: number
  vent_debut_ms: number
  vent_fin_ms: number
  heure_debut: string
  heure_fin: string
}

interface Traitement {
  id: string
  cible: { espece: string | null } | null
  aerien: { blocs: Bloc[]; rotations: Rotation[] } | null
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

  // Traitement (CRT) aérien rattaché à la prospection de référence de la fiche
  // (fiche.prospection_id, migration backend 0070) — source des tableaux
  // Traitement (blocs) et Opération (rotations) ci-dessous, jamais ressaisis
  // sur la fiche de vol elle-même.
  const { data: traitements } = useQuery<Traitement[]>({
    queryKey: ['fiche-vol-traitement', fiche?.prospection_id],
    queryFn: () =>
      api
        .get('/traitements', { params: { prospection_id: fiche!.prospection_id } })
        .then((r) => r.data),
    enabled: !!fiche?.prospection_id,
  })
  const traitementAerien = traitements?.find((t) => t.aerien != null)
  const blocs = traitementAerien?.aerien?.blocs ?? []
  const rotations = traitementAerien?.aerien?.rotations ?? []
  const especeCible = traitementAerien?.cible?.espece ?? null

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

  const blocsColumns: DataTableColumn<Bloc>[] = [
    { key: 'nom', header: 'Bloc', render: (b) => <span className="font-mono text-[12px] font-semibold">{b.nom}</span> },
    { key: 'localite', header: 'Localité', render: (b) => b.localite ?? '—' },
    { key: 'espece', header: 'Espèce', render: () => especeCible ?? '—' },
    {
      key: 'surface',
      header: 'Surface (ha)',
      align: 'right',
      mono: true,
      render: (b) => (b.surface_protegee_ha ? `protégée ${b.surface_protegee_ha}` : `traitée ${b.surface_traitee_ha ?? 0}`),
    },
    {
      key: 'interpasse',
      header: 'Interpasse (m)',
      align: 'right',
      mono: true,
      render: (b) => b.interpasse_m ?? '—',
    },
    {
      key: 'hauteur',
      header: 'Hauteur de vol (m)',
      align: 'right',
      mono: true,
      render: (b) => `${b.hauteur_vol_min_m ?? '—'} - ${b.hauteur_vol_max_m ?? '—'}`,
    },
    { key: 'observation', header: 'Observation', render: (b) => b.observation ?? '—' },
  ]

  const rotationsColumns: DataTableColumn<Rotation>[] = [
    {
      key: 'cuve',
      header: 'N° cuve',
      render: (r) => <span className="font-mono text-[12px] font-semibold text-ifvm-green-text">{r.numero_cuve}</span>,
    },
    { key: 'produit', header: 'Produit', render: (r) => r.nom_commercial ?? '—' },
    {
      key: 'quantite',
      header: 'Quantité',
      align: 'right',
      mono: true,
      render: (r) => `${r.quantite} ${r.unite}`,
    },
    {
      key: 'heures',
      header: 'Début → fin',
      align: 'right',
      mono: true,
      render: (r) => `${formatHeure(r.heure_debut)} → ${formatHeure(r.heure_fin)}`,
    },
    {
      key: 'temperature',
      header: 'T° début → fin',
      align: 'right',
      mono: true,
      render: (r) => `${r.temperature_debut_c} → ${r.temperature_fin_c} °C`,
    },
    {
      key: 'vent',
      header: 'Vent début → fin',
      align: 'right',
      mono: true,
      render: (r) => `${r.vent_debut_ms} → ${r.vent_fin_ms} m/s`,
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

          {blocs.length > 0 && (
            <Carte className="overflow-hidden">
              <div className="border-b border-[#f1ecdd] px-5 py-[15px]">
                <h2 className="font-sans text-[14px] font-bold">Traitement</h2>
              </div>
              <DataTable
                columns={blocsColumns}
                rows={blocs}
                getRowKey={(b) => b.id}
                emptyMessage="Aucun bloc."
              />
            </Carte>
          )}

          {rotations.length > 0 && (
            <Carte className="overflow-hidden">
              <div className="border-b border-[#f1ecdd] px-5 py-[15px]">
                <h2 className="font-sans text-[14px] font-bold">Opération</h2>
              </div>
              <DataTable
                columns={rotationsColumns}
                rows={rotations}
                getRowKey={(r) => r.id}
                emptyMessage="Aucune rotation."
              />
            </Carte>
          )}

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
            <Champ label="Base" value={`${fiche.base_numero ?? '—'} · ${fiche.base_localite ?? '—'}`} />
            <Champ label="Stand" value={`${fiche.stand_numero ?? '—'} · ${fiche.stand_localite ?? '—'}`} />
            <Champ label="Pilote" value={fiche.pilote} />
            <Champ label="Mécanicien" value={fiche.mecanicien} />
            <Champ label="Chef de base" value={nomAgent(fiche.chef_de_base_id)} />
            <Champ label="Consultant international" value={fiche.consultant_international} />
          </Carte>

          {fiche.prospection_id && (
            <Carte className="flex flex-col gap-2 p-5">
              <h2 className="mb-1 font-sans text-[13px] font-bold">Référence prospection</h2>
              <Champ label="N° fiche de prospection" value={fiche.prospection_numero_fiche} />
              <Champ label="N° fiche de validation" value={fiche.prospection_numero_fiche} />
              <Champ
                label="Date de validation"
                value={fiche.prospection_date_validation ? fiche.prospection_date_validation.slice(0, 10) : 'non validée'}
              />
            </Carte>
          )}

          <Carte className="flex flex-col gap-2 p-5">
            <h2 className="mb-1 font-sans text-[13px] font-bold">Pesticide</h2>
            <Champ label="Nom commercial" value={fiche.pesticide_nom_commercial} />
            <Champ label="Disponible (L)" value={fiche.pesticide_quantite_disponible} />
            <Champ label="Reçue (L)" value={fiche.pesticide_quantite_recue} />
            <Champ label="Utilisée (L)" value={fiche.pesticide_quantite_utilisee ?? 0} />
            <Champ label="Restante (L)" value={fiche.pesticide_quantite_restante} />
            <h2 className="mb-1 mt-2 font-sans text-[13px] font-bold">Fûts</h2>
            <Champ label="Disponibles" value={fiche.futs_disponible} />
            <Champ label="Reçues" value={fiche.futs_recues} />
            <Champ label="Pleins" value={fiche.futs_pleins} />
            <Champ label="Vides" value={fiche.futs_vides} />
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
    </div>
  )
}
