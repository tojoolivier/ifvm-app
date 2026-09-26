import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { ErrorBanner } from '@/components/ui/error-banner'
import { Pill } from '@/components/ui/pill'
import type { components } from '@/lib/api-schema.generated'
import {
  FILTRES_STOCK_VIDES,
  FORMULAIRE_MOUVEMENT_VIDE,
  LIBELLE_TYPE_MOUVEMENT,
  TEINTE_TYPE_MOUVEMENT,
  TYPES_MOUVEMENT,
  TYPES_SAISISSABLES,
  UNITES,
  construireMouvement,
  estSoldeNegatif,
  filtresStockActifs,
  formaterQuantite,
  libelleProduit,
  libelleSite,
  libelleTypeMouvement,
  messageErreurMouvement,
  paramsJournal,
  paramsSolde,
  sitesPrincipaux,
  trierSoldes,
  validerMouvement,
  type FiltresStock,
  type FormulaireMouvement,
  type Mouvement,
  type Pesticide,
  type SiteAerien,
  type Solde,
  type TypeMouvement,
  type TypeSaisissable,
  type Unite,
} from '@/lib/stock-pesticides'

type Traitement = components['schemas']['TraitementRead']

const champClass =
  'h-9 rounded-[8px] border border-[#e0d9c4] bg-[#fffdf8] px-[10px] font-sans text-[12px] focus:outline-none focus:ring-2 focus:ring-green-500'
const libelleClass = 'font-sans text-[11px] font-semibold text-[#3a3a30]'
const inputClass =
  'w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500'
const labelClass = 'mb-1 block text-sm font-medium text-gray-700'

function messageChargement(erreur: unknown, defaut: string): string {
  return (erreur as AxiosError<{ detail?: string }>)?.response?.data?.detail ?? defaut
}

/**
 * Stock de pesticides (#606, #609) : ce qu'il y a en stock sur chaque site principal, et le journal
 * des mouvements qui l'explique.
 *
 *  - Soldes : une ligne par (site, produit, unité). Le litre et le kilo ne sont jamais additionnés.
 *  - Journal : approvisionnements, transferts et consommations, filtrable ; une consommation renvoie à
 *    la fiche de traitement aérien qui l'a générée.
 *  - Saisie d'un approvisionnement ou d'un transfert : réservée par le backend aux chefs de base et
 *    aux administrateurs. La consommation n'est jamais saisie ici : elle vient des rotations d'une fiche.
 *
 * Le solde est calculé par le serveur à partir des mouvements (jamais stocké) : la page le relit après
 * chaque saisie.
 */
export function StockPesticidesPage() {
  const queryClient = useQueryClient()
  const { data: currentUser } = useCurrentUser()
  const peutSaisir = currentUser?.role === 'admin' || currentUser?.role === 'chef_de_base'

  const [filtres, setFiltres] = useState<FiltresStock>(FILTRES_STOCK_VIDES)
  const [formulaire, setFormulaire] = useState<FormulaireMouvement | null>(null)
  const [erreursSaisie, setErreursSaisie] = useState<string[]>([])
  const [erreurServeur, setErreurServeur] = useState('')

  // Mêmes clés et paramètres que Vols / Parc aéronefs : requêtes partagées.
  const { data: sites = [] } = useQuery<SiteAerien[]>({
    queryKey: ['sites-aeriens', 'tous'],
    queryFn: () => api.get('/sites-aeriens', { params: { inclure_inactifs: true } }).then((r) => r.data),
  })
  const { data: pesticides = [] } = useQuery<Pesticide[]>({
    queryKey: ['pesticides', 'tous'],
    queryFn: () => api.get('/pesticides', { params: { inclure_inactifs: true } }).then((r) => r.data),
  })

  const parametresSolde = paramsSolde(filtres)
  const parametresJournal = paramsJournal(filtres)

  const {
    data: soldes = [],
    isLoading: soldesLoading,
    isError: soldesIsError,
    error: soldesError,
  } = useQuery<Solde[]>({
    queryKey: ['stock-soldes', parametresSolde],
    queryFn: () => api.get('/stock-pesticide/solde', { params: parametresSolde }).then((r) => r.data),
  })

  const {
    data: mouvements = [],
    isLoading: mouvementsLoading,
    isError: mouvementsIsError,
    error: mouvementsError,
  } = useQuery<Mouvement[]>({
    queryKey: ['stock-mouvements', parametresJournal],
    queryFn: () => api.get('/mouvements-pesticide', { params: parametresJournal }).then((r) => r.data),
  })

  // Numéros de fiche pour les liens des consommations — même clé que le compteur du menu.
  const aDesConsommations = mouvements.some((m) => m.traitement_id)
  const { data: traitements = [] } = useQuery<Traitement[]>({
    queryKey: ['traitements'],
    queryFn: () => api.get('/traitements').then((r) => r.data),
    enabled: aDesConsommations,
  })

  const sitesDuStock = useMemo(() => sitesPrincipaux(sites), [sites])
  const soldesTries = useMemo(() => trierSoldes(soldes, sites, pesticides), [soldes, sites, pesticides])

  const enregistrer = useMutation({
    mutationFn: (corps: components['schemas']['MouvementPesticideCreate']) =>
      api.post('/mouvements-pesticide', corps).then((r) => r.data as Mouvement),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-soldes'] })
      queryClient.invalidateQueries({ queryKey: ['stock-mouvements'] })
      fermerFormulaire()
    },
    onError: (err) => setErreurServeur(messageErreurMouvement(err)),
  })

  function modifier<K extends keyof FiltresStock>(cle: K, valeur: FiltresStock[K]) {
    setFiltres((precedents) => ({ ...precedents, [cle]: valeur }))
  }

  function ouvrirFormulaire() {
    setFormulaire({ ...FORMULAIRE_MOUVEMENT_VIDE })
    setErreursSaisie([])
    setErreurServeur('')
  }

  function fermerFormulaire() {
    setFormulaire(null)
    setErreursSaisie([])
    setErreurServeur('')
  }

  function changerChamp<K extends keyof FormulaireMouvement>(cle: K, valeur: FormulaireMouvement[K]) {
    setFormulaire((courant) => (courant ? { ...courant, [cle]: valeur } : courant))
  }

  function soumettre() {
    if (!formulaire) return
    const erreurs = validerMouvement(formulaire)
    setErreursSaisie(erreurs)
    setErreurServeur('')
    if (erreurs.length > 0) return
    enregistrer.mutate(construireMouvement(formulaire))
  }

  const numeroFiche = (traitementId: string) =>
    traitements.find((t) => t.id === traitementId)?.numero_fiche ?? 'Fiche de traitement'

  // --- Colonnes ---------------------------------------------------------------
  const colonnesSoldes: DataTableColumn<Solde>[] = [
    { key: 'site', header: 'Site', render: (s) => libelleSite(s.site_id, sites) },
    { key: 'produit', header: 'Produit', render: (s) => libelleProduit(s.pesticide_id, pesticides) },
    { key: 'unite', header: 'Unité', mono: true, render: (s) => s.unite },
    {
      key: 'quantite',
      header: 'Solde',
      align: 'right',
      mono: true,
      render: (s) => (
        <span className={estSoldeNegatif(s) ? 'font-bold text-destructive' : 'font-semibold'}>
          {formaterQuantite(s.quantite)} {s.unite}
          {estSoldeNegatif(s) && <span className="ml-2 font-sans text-[10px] uppercase">négatif</span>}
        </span>
      ),
    },
  ]

  const colonnesJournal: DataTableColumn<Mouvement>[] = [
    { key: 'date', header: 'Date', mono: true, render: (m) => m.date_mouvement },
    {
      key: 'type',
      header: 'Type',
      render: (m) => (
        <Pill tone={TEINTE_TYPE_MOUVEMENT[m.type as TypeMouvement] ?? TEINTE_TYPE_MOUVEMENT.transfert}>
          {libelleTypeMouvement(m.type)}
        </Pill>
      ),
    },
    { key: 'produit', header: 'Produit', render: (m) => libelleProduit(m.pesticide_id, pesticides) },
    {
      key: 'site',
      header: 'Site',
      render: (m) =>
        m.site_destination_id
          ? `${libelleSite(m.site_id, sites)} → ${libelleSite(m.site_destination_id, sites)}`
          : libelleSite(m.site_id, sites),
    },
    {
      key: 'quantite',
      header: 'Quantité',
      align: 'right',
      mono: true,
      render: (m) => `${formaterQuantite(m.quantite)} ${m.unite}`,
    },
    {
      key: 'origine',
      header: 'Origine',
      render: (m) =>
        m.traitement_id ? (
          <Link to={`/traitements/${m.traitement_id}`} className="font-mono text-[11.5px] font-semibold underline">
            {numeroFiche(m.traitement_id)}
          </Link>
        ) : (
          <span className="text-ifvm-text-weak">Saisie manuelle</span>
        ),
    },
  ]

  return (
    <div className="flex flex-col gap-5 px-4 pb-10 pt-4 sm:px-7 sm:pt-[26px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Stock de pesticides</h1>
          <p className="font-sans text-[12px] text-ifvm-text-weak">
            Le stock de chaque site aérien principal, et le journal des mouvements qui l'explique.
          </p>
        </div>
        {peutSaisir && (
          <button
            type="button"
            onClick={ouvrirFormulaire}
            className="rounded-[9px] bg-ifvm-green-text px-4 py-[8px] font-sans text-[12px] font-bold text-white transition hover:bg-[#1a4429]"
          >
            + Nouveau mouvement
          </button>
        )}
      </div>

      <form
        aria-label="Filtres du stock"
        onSubmit={(e) => e.preventDefault()}
        className="flex flex-wrap items-end gap-x-4 gap-y-3 rounded-[11px] border border-[#e7e0cd] bg-card p-4"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="filtre-site" className={libelleClass}>
            Site
          </label>
          <select
            id="filtre-site"
            value={filtres.siteId}
            onChange={(e) => modifier('siteId', e.target.value)}
            className={champClass}
          >
            <option value="">— Tous —</option>
            {sitesDuStock.map((s) => (
              <option key={s.id} value={s.id}>
                {s.numero} — {s.localite}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="filtre-produit" className={libelleClass}>
            Produit
          </label>
          <select
            id="filtre-produit"
            value={filtres.pesticideId}
            onChange={(e) => modifier('pesticideId', e.target.value)}
            className={champClass}
          >
            <option value="">— Tous —</option>
            {pesticides.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.nom}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="filtre-type" className={libelleClass}>
            Type de mouvement
          </label>
          <select
            id="filtre-type"
            value={filtres.type}
            onChange={(e) => modifier('type', e.target.value as TypeMouvement | '')}
            className={champClass}
          >
            <option value="">— Tous —</option>
            {TYPES_MOUVEMENT.map((t) => (
              <option key={t} value={t}>
                {LIBELLE_TYPE_MOUVEMENT[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="filtre-du" className={libelleClass}>
            Du
          </label>
          <input
            id="filtre-du"
            type="date"
            value={filtres.dateDebut}
            max={filtres.dateFin || undefined}
            onChange={(e) => modifier('dateDebut', e.target.value)}
            className={champClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="filtre-au" className={libelleClass}>
            Au
          </label>
          <input
            id="filtre-au"
            type="date"
            value={filtres.dateFin}
            min={filtres.dateDebut || undefined}
            onChange={(e) => modifier('dateFin', e.target.value)}
            className={champClass}
          />
        </div>
        {filtresStockActifs(filtres) && (
          <button
            type="button"
            onClick={() => setFiltres(FILTRES_STOCK_VIDES)}
            className="h-9 rounded-[8px] border border-[#e0d9c4] bg-white px-3 font-sans text-[12px] font-semibold text-[#3a3a30] hover:bg-[#faf7ef]"
          >
            Réinitialiser
          </button>
        )}
        <p className="basis-full font-sans text-[11px] text-ifvm-text-weak">
          Le site et le produit filtrent les soldes et le journal ; le type et la période ne filtrent que le
          journal.
        </p>
      </form>

      <section aria-labelledby="titre-soldes" className="flex flex-col gap-3">
        <h2 id="titre-soldes" className="font-sans text-[14px] font-bold">
          Soldes
        </h2>
        <p className="font-sans text-[11px] text-ifvm-text-weak">
          Une ligne par site, produit et unité : le litre et le kilo ne sont jamais additionnés.
        </p>
        {soldesIsError ? (
          <ErrorBanner label="Erreur" message={messageChargement(soldesError, 'Impossible de charger les soldes.')} />
        ) : (
          <div className="overflow-hidden rounded-[11px] border border-[#e7e0cd] bg-card">
            <DataTable
              columns={colonnesSoldes}
              rows={soldesTries}
              getRowKey={(s) => `${s.site_id}|${s.pesticide_id}|${s.unite}`}
              emptyMessage={soldesLoading ? 'Chargement…' : 'Aucun stock enregistré.'}
            />
          </div>
        )}
      </section>

      <section aria-labelledby="titre-journal" className="flex flex-col gap-3">
        <h2 id="titre-journal" className="font-sans text-[14px] font-bold">
          Journal des mouvements
        </h2>
        {mouvementsIsError ? (
          <ErrorBanner
            label="Erreur"
            message={messageChargement(mouvementsError, 'Impossible de charger le journal des mouvements.')}
          />
        ) : (
          <>
            <p data-testid="nb-mouvements" className="font-sans text-[12px] text-ifvm-text-weak">
              <b>{mouvements.length}</b> mouvement{mouvements.length > 1 ? 's' : ''}
            </p>
            <div className="overflow-hidden rounded-[11px] border border-[#e7e0cd] bg-card">
              <DataTable
                columns={colonnesJournal}
                rows={mouvements}
                getRowKey={(m) => m.id}
                emptyMessage={
                  mouvementsLoading
                    ? 'Chargement…'
                    : filtresStockActifs(filtres)
                      ? 'Aucun mouvement ne correspond à ces filtres.'
                      : 'Aucun mouvement enregistré.'
                }
              />
            </div>
          </>
        )}
      </section>

      {/* Modale : nouveau mouvement (approvisionnement / transfert) */}
      {formulaire && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="border-b px-4 py-4 sm:px-6">
              <h2 className="text-lg font-semibold">Nouveau mouvement de stock</h2>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                soumettre()
              }}
              noValidate
              className="space-y-4 px-4 py-4 sm:px-6"
            >
              {(erreursSaisie.length > 0 || erreurServeur) && (
                <div role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">
                  {erreurServeur ? (
                    <p>{erreurServeur}</p>
                  ) : (
                    <ul className="list-disc pl-4">
                      {erreursSaisie.map((erreur) => (
                        <li key={erreur}>{erreur}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <div>
                <label htmlFor="mouvement-type" className={labelClass}>
                  Type *
                </label>
                <select
                  id="mouvement-type"
                  value={formulaire.type}
                  onChange={(e) => {
                    const type = e.target.value as TypeSaisissable
                    changerChamp('type', type)
                    if (type !== 'transfert') changerChamp('siteDestinationId', '')
                  }}
                  className={inputClass}
                >
                  {TYPES_SAISISSABLES.map((t) => (
                    <option key={t} value={t}>
                      {LIBELLE_TYPE_MOUVEMENT[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="mouvement-produit" className={labelClass}>
                  Produit *
                </label>
                <select
                  id="mouvement-produit"
                  value={formulaire.pesticideId}
                  onChange={(e) => changerChamp('pesticideId', e.target.value)}
                  className={inputClass}
                >
                  <option value="" disabled>
                    — choisir —
                  </option>
                  {pesticides
                    .filter((p) => p.actif)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} — {p.nom}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label htmlFor="mouvement-site" className={labelClass}>
                  {formulaire.type === 'transfert' ? 'Site source *' : 'Site *'}
                </label>
                <select
                  id="mouvement-site"
                  value={formulaire.siteId}
                  onChange={(e) => changerChamp('siteId', e.target.value)}
                  className={inputClass}
                >
                  <option value="" disabled>
                    — choisir —
                  </option>
                  {sitesDuStock
                    .filter((s) => s.actif)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.numero} — {s.localite}
                      </option>
                    ))}
                </select>
              </div>
              {formulaire.type === 'transfert' && (
                <div>
                  <label htmlFor="mouvement-destination" className={labelClass}>
                    Site de destination *
                  </label>
                  <select
                    id="mouvement-destination"
                    value={formulaire.siteDestinationId}
                    onChange={(e) => changerChamp('siteDestinationId', e.target.value)}
                    className={inputClass}
                  >
                    <option value="" disabled>
                      — choisir —
                    </option>
                    {sitesDuStock
                      .filter((s) => s.actif && s.id !== formulaire.siteId)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.numero} — {s.localite}
                        </option>
                      ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="mouvement-quantite" className={labelClass}>
                    Quantité *
                  </label>
                  <input
                    id="mouvement-quantite"
                    type="text"
                    inputMode="decimal"
                    value={formulaire.quantite}
                    onChange={(e) => changerChamp('quantite', e.target.value)}
                    placeholder="Ex. 250"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="mouvement-unite" className={labelClass}>
                    Unité *
                  </label>
                  <select
                    id="mouvement-unite"
                    value={formulaire.unite}
                    onChange={(e) => changerChamp('unite', e.target.value as Unite)}
                    className={inputClass}
                  >
                    {UNITES.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="mouvement-date" className={labelClass}>
                  Date (facultatif)
                </label>
                <input
                  id="mouvement-date"
                  type="date"
                  value={formulaire.date}
                  onChange={(e) => changerChamp('date', e.target.value)}
                  className={inputClass}
                />
                <p className="mt-1 font-sans text-[11px] text-ifvm-text-weak">Par défaut : la date du jour.</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={enregistrer.isPending}
                  className="rounded bg-green-700 px-4 py-2 text-white transition hover:bg-green-800 disabled:opacity-50"
                >
                  {enregistrer.isPending ? 'Enregistrement…' : 'Enregistrer'}
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
