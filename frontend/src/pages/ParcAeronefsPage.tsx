import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { api } from '../api/client'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { FriseAffectations, type LigneFrise } from '@/components/FriseAffectations'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { ErrorBanner } from '@/components/ui/error-banner'
import { FilterChip } from '@/components/ui/filter-chip'
import { Pill } from '@/components/ui/pill'
import type { components } from '@/lib/api-schema.generated'
import {
  aujourdhuiIso,
  equipeEnServiceDe,
  estEnCours,
  messageErreurAeronef,
  messageErreurAffectation,
  type Aeronef,
  type Affectation,
  type EquipeParc,
} from '@/lib/parc-aeronefs'

type Vue = 'appareils' | 'equipes'

const inputClass =
  'w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500'
const labelClass = 'mb-1 block text-sm font-medium text-gray-700'
const boutonPrimaire =
  'rounded-[9px] bg-ifvm-green-text px-4 py-[8px] font-sans text-[12px] font-bold text-white transition hover:bg-[#1a4429] disabled:cursor-not-allowed disabled:opacity-50'
const boutonSecondaire =
  'rounded-[9px] border border-[#e0d9c4] bg-white px-3 py-[7px] font-sans text-[12px] font-semibold text-[#3a3a30] transition hover:bg-[#faf7ef] disabled:cursor-not-allowed disabled:opacity-50'

function messageChargement(erreur: unknown, defaut: string): string {
  return (erreur as AxiosError<{ detail?: string }>)?.response?.data?.detail ?? defaut
}

/** État d'un appareil : en service dans une équipe, libre, ou sorti du parc. */
function PillEtat({ aeronef, equipe }: { aeronef: Aeronef; equipe: EquipeParc | undefined }) {
  if (!aeronef.actif) {
    return <Pill tone="border-[#e0d9c4] bg-ifvm-brouillon-bg text-ifvm-text-tertiary">Inactif</Pill>
  }
  return equipe ? (
    <Pill tone="border-ifvm-green-border bg-ifvm-green-bg text-ifvm-green-text">En service</Pill>
  ) : (
    <Pill tone="border-[#e0d9c4] bg-background text-ifvm-text-tertiary">Libre</Pill>
  )
}

/**
 * Formulaire d'affectation, commun aux deux vues : on choisit l'équipe (vue appareil) ou l'appareil
 * (vue équipe), la date de début (aujourd'hui par défaut, modifiable : une affectation se saisit aussi
 * après coup) et, facultativement, une date de fin.
 */
function AffecterForm({
  libelleCible,
  options,
  aujourdhui,
  enCours,
  erreur,
  onSubmit,
  desactive,
}: {
  libelleCible: 'Équipe' | 'Appareil'
  options: { value: string; label: string }[]
  aujourdhui: string
  enCours: boolean
  erreur: string
  onSubmit: (valeurs: { cibleId: string; dateDebut: string; dateFin: string }) => void
  desactive: boolean
}) {
  const [cibleId, setCibleId] = useState('')
  const [dateDebut, setDateDebut] = useState(aujourdhui)
  const [dateFin, setDateFin] = useState('')

  return (
    <form
      aria-label={`Affecter — ${libelleCible.toLowerCase()}`}
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({ cibleId, dateDebut, dateFin })
      }}
      className="flex flex-col gap-3 rounded-[11px] border border-[#e7e0cd] bg-card p-4"
    >
      <h3 className="font-sans text-[13px] font-bold">
        {libelleCible === 'Équipe' ? 'Affecter à une équipe' : 'Affecter un appareil'}
      </h3>
      {erreur && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{erreur}</div>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor={`affectation-cible-${libelleCible}`} className={labelClass}>
            {libelleCible} *
          </label>
          <select
            id={`affectation-cible-${libelleCible}`}
            value={cibleId}
            onChange={(e) => setCibleId(e.target.value)}
            required
            disabled={desactive}
            className={inputClass}
          >
            <option value="" disabled>
              — choisir —
            </option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`affectation-debut-${libelleCible}`} className={labelClass}>
            Date de début *
          </label>
          <input
            id={`affectation-debut-${libelleCible}`}
            type="date"
            value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)}
            required
            disabled={desactive}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={`affectation-fin-${libelleCible}`} className={labelClass}>
            Date de fin (facultatif)
          </label>
          <input
            id={`affectation-fin-${libelleCible}`}
            type="date"
            value={dateFin}
            min={dateDebut || undefined}
            onChange={(e) => setDateFin(e.target.value)}
            disabled={desactive}
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <button type="submit" disabled={desactive || enCours} className={boutonPrimaire}>
          {enCours ? 'Affectation…' : 'Affecter'}
        </button>
      </div>
    </form>
  )
}

/**
 * Parc aéronefs (#621, #603) : la liste des hélicoptères, leur cycle de vie et leur historique.
 *
 *  - Vue « Appareils » : chaque appareil avec son équipe du jour ou « Libre » ; le détail donne la frise
 *    des équipes qui l'ont utilisé.
 *  - Vue « Équipes » : le même historique lu côté équipe (les appareils qu'elle a utilisés).
 *  - Créer, modifier et désactiver un appareil est réservé à l'administrateur (le backend le refuse
 *    aux autres). Affecter un appareil à une équipe et clore une affectation sont ouverts à tous les
 *    profils qui voient la page. Pas de suppression : la sortie de service est `actif = false`.
 */
export function ParcAeronefsPage() {
  const queryClient = useQueryClient()
  const { data: currentUser } = useCurrentUser()
  const estAdmin = currentUser?.role === 'admin'
  const aujourdhui = aujourdhuiIso()

  const [vue, setVue] = useState<Vue>('appareils')
  const [aeronefId, setAeronefId] = useState<string | null>(null)
  const [equipeId, setEquipeId] = useState<string | null>(null)

  // --- Formulaire appareil (création / modification) -------------------------
  const [formulaire, setFormulaire] = useState<{ aeronef: Aeronef | null } | null>(null)
  const [immatriculation, setImmatriculation] = useState('')
  const [societe, setSociete] = useState('')
  const [volumeCuve, setVolumeCuve] = useState('')
  const [erreurAeronef, setErreurAeronef] = useState('')

  // --- Affectation / clôture -------------------------------------------------
  const [erreurAffectation, setErreurAffectation] = useState('')
  const [clotureId, setClotureId] = useState<string | null>(null)
  const [dateCloture, setDateCloture] = useState(aujourdhui)

  const {
    data: aeronefs = [],
    isLoading: aeronefsLoading,
    isError: aeronefsIsError,
    error: aeronefsError,
  } = useQuery<Aeronef[]>({
    queryKey: ['aeronefs'],
    queryFn: () => api.get('/aeronefs', { params: { inclure_inactifs: true } }).then((r) => r.data),
  })

  // Clé distincte de celle d'Administration (équipes actives seulement) : même route, contenu différent.
  const {
    data: equipes = [],
    isError: equipesIsError,
    error: equipesError,
  } = useQuery<EquipeParc[]>({
    queryKey: ['equipes-aeriennes', 'parc'],
    queryFn: () =>
      api.get('/equipes', { params: { type: 'aerien', inclure_inactifs: true } }).then((r) => r.data),
  })

  const aeronefSelectionne = aeronefs.find((a) => a.id === aeronefId) ?? null
  const equipeSelectionnee = equipes.find((e) => e.id === equipeId) ?? null

  const { data: affectationsAeronef = [], isError: affectationsAeronefIsError } = useQuery<Affectation[]>({
    queryKey: ['aeronef-affectations', aeronefId],
    queryFn: () => api.get(`/aeronefs/${aeronefId}/affectations`).then((r) => r.data),
    enabled: vue === 'appareils' && !!aeronefId,
  })

  const { data: affectationsEquipe = [], isError: affectationsEquipeIsError } = useQuery<Affectation[]>({
    queryKey: ['equipe-affectations', equipeId],
    queryFn: () => api.get(`/equipes/${equipeId}/aeronefs`).then((r) => r.data),
    enabled: vue === 'equipes' && !!equipeId,
  })

  function rafraichir() {
    queryClient.invalidateQueries({ queryKey: ['aeronefs'] })
    queryClient.invalidateQueries({ queryKey: ['equipes-aeriennes'] })
    queryClient.invalidateQueries({ queryKey: ['aeronef-affectations'] })
    queryClient.invalidateQueries({ queryKey: ['equipe-affectations'] })
  }

  function fermerFormulaire() {
    setFormulaire(null)
    setImmatriculation('')
    setSociete('')
    setVolumeCuve('')
    setErreurAeronef('')
  }

  function ouvrirCreation() {
    fermerFormulaire()
    setFormulaire({ aeronef: null })
  }

  function ouvrirModification(aeronef: Aeronef) {
    setImmatriculation(aeronef.immatriculation)
    setSociete(aeronef.societe)
    setVolumeCuve(String(aeronef.volume_cuve_l))
    setErreurAeronef('')
    setFormulaire({ aeronef })
  }

  const creerAeronef = useMutation({
    mutationFn: (data: components['schemas']['AeronefCreate']) =>
      api.post('/aeronefs', data).then((r) => r.data as Aeronef),
    onSuccess: (cree) => {
      rafraichir()
      fermerFormulaire()
      setAeronefId(cree.id)
    },
    onError: (err) => setErreurAeronef(messageErreurAeronef(err)),
  })

  const modifierAeronef = useMutation({
    mutationFn: ({ id, data }: { id: string; data: components['schemas']['AeronefUpdate'] }) =>
      api.put(`/aeronefs/${id}`, data).then((r) => r.data as Aeronef),
    onSuccess: () => {
      rafraichir()
      fermerFormulaire()
    },
    onError: (err) => setErreurAeronef(messageErreurAeronef(err)),
  })

  const changerEtat = useMutation({
    mutationFn: ({ id, actif }: { id: string; actif: boolean }) =>
      api.put(`/aeronefs/${id}`, { actif }).then((r) => r.data as Aeronef),
    onSuccess: rafraichir,
    onError: (err) => setErreurAffectation(messageErreurAeronef(err)),
  })

  const affecter = useMutation({
    mutationFn: ({ equipe_id, ...data }: { equipe_id: string } & components['schemas']['AffectationAeronefCreate']) =>
      api.post(`/equipes/${equipe_id}/aeronefs`, data).then((r) => r.data as Affectation),
    onSuccess: () => {
      rafraichir()
      setErreurAffectation('')
    },
    onError: (err) => setErreurAffectation(messageErreurAffectation(err)),
  })

  const clore = useMutation({
    mutationFn: ({ equipe_id, id, date_fin }: { equipe_id: string; id: string; date_fin: string }) =>
      api.put(`/equipes/${equipe_id}/aeronefs/${id}`, { date_fin }).then((r) => r.data as Affectation),
    onSuccess: () => {
      rafraichir()
      setClotureId(null)
      setErreurAffectation('')
    },
    onError: (err) => setErreurAffectation(messageErreurAffectation(err)),
  })

  function changerVue(nouvelle: Vue) {
    setVue(nouvelle)
    setErreurAffectation('')
    setClotureId(null)
  }

  function soumettreAeronef() {
    setErreurAeronef('')
    const volume = Number(volumeCuve.replace(',', '.'))
    if (formulaire?.aeronef) {
      modifierAeronef.mutate({
        id: formulaire.aeronef.id,
        data: { immatriculation: immatriculation.trim(), societe: societe.trim(), volume_cuve_l: volume },
      })
    } else {
      creerAeronef.mutate({ immatriculation: immatriculation.trim(), societe: societe.trim(), volume_cuve_l: volume })
    }
  }

  /** Bouton « Clore » d'une affectation en cours, avec sa date de fin (aujourd'hui par défaut). */
  function actionClore(affectation: Affectation) {
    if (!estEnCours(affectation)) return undefined
    if (clotureId !== affectation.id) {
      return (
        <button
          type="button"
          onClick={() => {
            setClotureId(affectation.id)
            setDateCloture(aujourdhui)
            setErreurAffectation('')
          }}
          className={boutonSecondaire}
        >
          Clore
        </button>
      )
    }
    return (
      <span className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          aria-label="Date de fin de l'affectation"
          value={dateCloture}
          min={affectation.date_debut}
          onChange={(e) => setDateCloture(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        />
        <button
          type="button"
          disabled={clore.isPending || !dateCloture}
          onClick={() =>
            clore.mutate({ equipe_id: affectation.equipe_id, id: affectation.id, date_fin: dateCloture })
          }
          className={boutonPrimaire}
        >
          {clore.isPending ? 'Clôture…' : 'Confirmer la clôture'}
        </button>
        <button type="button" onClick={() => setClotureId(null)} className={boutonSecondaire}>
          Annuler
        </button>
      </span>
    )
  }

  const nomEquipe = (id: string) => equipes.find((e) => e.id === id)?.nom ?? 'Équipe inconnue'

  // --- Colonnes ---------------------------------------------------------------
  const colonnesAppareils: DataTableColumn<Aeronef>[] = [
    {
      key: 'immatriculation',
      header: 'Immatriculation',
      mono: true,
      render: (a) => <span className="font-semibold">{a.immatriculation}</span>,
    },
    { key: 'societe', header: 'Société', render: (a) => a.societe },
    { key: 'cuve', header: 'Cuve (L)', align: 'right', mono: true, render: (a) => a.volume_cuve_l },
    {
      key: 'equipe',
      header: 'Équipe du jour',
      render: (a) => {
        const equipe = equipeEnServiceDe(a.id, equipes)
        return equipe ? equipe.nom : <span className="text-ifvm-text-weak">—</span>
      },
    },
    {
      key: 'etat',
      header: 'État',
      render: (a) => <PillEtat aeronef={a} equipe={equipeEnServiceDe(a.id, equipes)} />,
    },
    {
      key: 'historique',
      header: '',
      align: 'right',
      render: (a) => (
        <button
          type="button"
          onClick={() => {
            setAeronefId(a.id)
            setErreurAffectation('')
            setClotureId(null)
          }}
          aria-label={`Historique de l'appareil ${a.immatriculation}`}
          className="font-sans text-[12px] font-semibold text-ifvm-green-text underline"
        >
          Historique
        </button>
      ),
    },
  ]

  const colonnesEquipes: DataTableColumn<EquipeParc>[] = [
    { key: 'nom', header: 'Équipe', render: (e) => <span className="font-semibold">{e.nom}</span> },
    {
      key: 'aeronef',
      header: 'Appareil du jour',
      render: (e) =>
        e.aeronef ? (
          <span className="font-mono text-[11.5px]">{e.aeronef.immatriculation}</span>
        ) : (
          <span className="text-ifvm-text-weak">Aucun</span>
        ),
    },
    {
      key: 'etat',
      header: 'État',
      render: (e) =>
        e.actif ? (
          <Pill tone="border-ifvm-green-border bg-ifvm-green-bg text-ifvm-green-text">Active</Pill>
        ) : (
          <Pill tone="border-[#e0d9c4] bg-ifvm-brouillon-bg text-ifvm-text-tertiary">Inactive</Pill>
        ),
    },
    {
      key: 'historique',
      header: '',
      align: 'right',
      render: (e) => (
        <button
          type="button"
          onClick={() => {
            setEquipeId(e.id)
            setErreurAffectation('')
            setClotureId(null)
          }}
          aria-label={`Historique de l'équipe ${e.nom}`}
          className="font-sans text-[12px] font-semibold text-ifvm-green-text underline"
        >
          Historique
        </button>
      ),
    },
  ]

  // --- Frises -----------------------------------------------------------------
  const lignesAppareil: LigneFrise[] = affectationsAeronef.map((a) => ({
    id: a.id,
    titre: nomEquipe(a.equipe_id),
    date_debut: a.date_debut,
    date_fin: a.date_fin ?? null,
    action: actionClore(a),
  }))
  const lignesEquipe: LigneFrise[] = affectationsEquipe.map((a) => ({
    id: a.id,
    titre: a.aeronef?.immatriculation ?? 'Appareil inconnu',
    sousTitre: a.aeronef?.societe,
    date_debut: a.date_debut,
    date_fin: a.date_fin ?? null,
    action: actionClore(a),
  }))

  const equipesAffectables = equipes.filter((e) => e.actif)
  const aeronefsAffectables = aeronefs.filter((a) => a.actif)

  const enregistrementEnCours = creerAeronef.isPending || modifierAeronef.isPending

  return (
    <div className="flex flex-col gap-4 px-4 pb-10 pt-4 sm:px-7 sm:pt-[26px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Parc aéronefs</h1>
          <p className="font-sans text-[12px] text-ifvm-text-weak">
            Les hélicoptères de la campagne, leur équipe du jour et l'historique de leurs affectations.
          </p>
        </div>
        {estAdmin && (
          <button type="button" onClick={ouvrirCreation} className={boutonPrimaire}>
            + Nouvel appareil
          </button>
        )}
      </div>

      <div role="group" aria-label="Vue du parc" className="flex gap-2">
        <FilterChip label="Appareils" active={vue === 'appareils'} onClick={() => changerVue('appareils')} />
        <FilterChip label="Équipes" active={vue === 'equipes'} onClick={() => changerVue('equipes')} />
      </div>

      {(aeronefsIsError || equipesIsError) && (
        <ErrorBanner
          label="Erreur"
          message={
            aeronefsIsError
              ? messageChargement(aeronefsError, 'Impossible de charger le parc aéronefs.')
              : messageChargement(equipesError, 'Impossible de charger les équipes aériennes.')
          }
        />
      )}

      {vue === 'appareils' ? (
        <>
          <div className="overflow-hidden rounded-[11px] border border-[#e7e0cd] bg-card">
            <DataTable
              columns={colonnesAppareils}
              rows={aeronefs}
              getRowKey={(a) => a.id}
              emptyMessage={aeronefsLoading ? 'Chargement…' : 'Aucun appareil au parc.'}
              rowClassName={(a) =>
                a.id === aeronefId ? 'bg-ifvm-green-bg ring-2 ring-inset ring-ifvm-green-text' : undefined
              }
            />
          </div>

          {aeronefSelectionne && (
            <section
              aria-label={`Appareil ${aeronefSelectionne.immatriculation}`}
              className="flex flex-col gap-4 rounded-[11px] border border-[#e7e0cd] bg-card p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-mono text-[15px] font-bold">{aeronefSelectionne.immatriculation}</h2>
                  <p className="font-sans text-[12px] text-ifvm-text-weak">
                    {aeronefSelectionne.societe} · cuve {aeronefSelectionne.volume_cuve_l} L
                  </p>
                </div>
                {estAdmin && (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => ouvrirModification(aeronefSelectionne)} className={boutonSecondaire}>
                      Modifier
                    </button>
                    <button
                      type="button"
                      disabled={changerEtat.isPending}
                      onClick={() =>
                        changerEtat.mutate({ id: aeronefSelectionne.id, actif: !aeronefSelectionne.actif })
                      }
                      className={boutonSecondaire}
                    >
                      {aeronefSelectionne.actif ? 'Désactiver' : 'Réactiver'}
                    </button>
                  </div>
                )}
              </div>

              <div>
                <h3 className="mb-2 font-sans text-[13px] font-bold">Historique des affectations</h3>
                {affectationsAeronefIsError ? (
                  <ErrorBanner label="Erreur" message="Impossible de charger l'historique de cet appareil." />
                ) : (
                  <FriseAffectations
                    lignes={lignesAppareil}
                    aujourdhui={aujourdhui}
                    ariaLabel="Historique des affectations de l'appareil"
                    messageVide="Cet appareil n'a encore été affecté à aucune équipe."
                  />
                )}
              </div>

              <AffecterForm
                key={aeronefSelectionne.id}
                libelleCible="Équipe"
                options={equipesAffectables.map((e) => ({ value: e.id, label: e.nom }))}
                aujourdhui={aujourdhui}
                enCours={affecter.isPending}
                erreur={erreurAffectation}
                desactive={!aeronefSelectionne.actif}
                onSubmit={({ cibleId, dateDebut, dateFin }) =>
                  affecter.mutate({
                    equipe_id: cibleId,
                    aeronef_id: aeronefSelectionne.id,
                    date_debut: dateDebut,
                    ...(dateFin ? { date_fin: dateFin } : {}),
                  })
                }
              />
              {!aeronefSelectionne.actif && (
                <p className="font-sans text-[11.5px] text-ifvm-text-weak">
                  Cet appareil est inactif : réactivez-le pour l'affecter à une équipe.
                </p>
              )}
            </section>
          )}
        </>
      ) : (
        <>
          <div className="overflow-hidden rounded-[11px] border border-[#e7e0cd] bg-card">
            <DataTable
              columns={colonnesEquipes}
              rows={equipes}
              getRowKey={(e) => e.id}
              emptyMessage="Aucune équipe aérienne."
              rowClassName={(e) =>
                e.id === equipeId ? 'bg-ifvm-green-bg ring-2 ring-inset ring-ifvm-green-text' : undefined
              }
            />
          </div>

          {equipeSelectionnee && (
            <section
              aria-label={`Équipe ${equipeSelectionnee.nom}`}
              className="flex flex-col gap-4 rounded-[11px] border border-[#e7e0cd] bg-card p-4"
            >
              <h2 className="font-sans text-[15px] font-bold">{equipeSelectionnee.nom}</h2>
              <div>
                <h3 className="mb-2 font-sans text-[13px] font-bold">Historique des appareils</h3>
                {affectationsEquipeIsError ? (
                  <ErrorBanner label="Erreur" message="Impossible de charger l'historique de cette équipe." />
                ) : (
                  <FriseAffectations
                    lignes={lignesEquipe}
                    aujourdhui={aujourdhui}
                    ariaLabel="Historique des appareils de l'équipe"
                    messageVide="Cette équipe n'a encore utilisé aucun appareil."
                  />
                )}
              </div>

              <AffecterForm
                key={equipeSelectionnee.id}
                libelleCible="Appareil"
                options={aeronefsAffectables.map((a) => ({
                  value: a.id,
                  label: `${a.immatriculation} — ${a.societe}`,
                }))}
                aujourdhui={aujourdhui}
                enCours={affecter.isPending}
                erreur={erreurAffectation}
                desactive={!equipeSelectionnee.actif}
                onSubmit={({ cibleId, dateDebut, dateFin }) =>
                  affecter.mutate({
                    equipe_id: equipeSelectionnee.id,
                    aeronef_id: cibleId,
                    date_debut: dateDebut,
                    ...(dateFin ? { date_fin: dateFin } : {}),
                  })
                }
              />
            </section>
          )}
        </>
      )}

      {/* Modale : nouvel appareil / modifier un appareil (admin) */}
      {formulaire && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="border-b px-4 py-4 sm:px-6">
              <h2 className="text-lg font-semibold">
                {formulaire.aeronef ? `Modifier l'appareil ${formulaire.aeronef.immatriculation}` : 'Nouvel appareil'}
              </h2>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                soumettreAeronef()
              }}
              className="space-y-4 px-4 py-4 sm:px-6"
            >
              {erreurAeronef && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{erreurAeronef}</div>}
              <div>
                <label htmlFor="aeronef-immatriculation" className={labelClass}>
                  Immatriculation *
                </label>
                <input
                  id="aeronef-immatriculation"
                  type="text"
                  value={immatriculation}
                  onChange={(e) => setImmatriculation(e.target.value)}
                  placeholder="Ex. 5R-MXY"
                  maxLength={20}
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="aeronef-societe" className={labelClass}>
                  Société *
                </label>
                <input
                  id="aeronef-societe"
                  type="text"
                  value={societe}
                  onChange={(e) => setSociete(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="aeronef-volume-cuve" className={labelClass}>
                  Volume de cuve (L) *
                </label>
                <input
                  id="aeronef-volume-cuve"
                  type="number"
                  min="1"
                  step="any"
                  value={volumeCuve}
                  onChange={(e) => setVolumeCuve(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={enregistrementEnCours}
                  className="rounded bg-green-700 px-4 py-2 text-white transition hover:bg-green-800 disabled:opacity-50"
                >
                  {enregistrementEnCours ? 'Enregistrement…' : formulaire.aeronef ? 'Enregistrer' : 'Créer'}
                </button>
                <button
                  type="button"
                  onClick={fermerFormulaire}
                  className="rounded border border-gray-300 px-4 py-2 transition hover:bg-gray-50"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
