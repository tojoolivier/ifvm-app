import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { STATUTS, StatusBadge } from '@/components/ui/status-badge'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

// ── Tokens ─────────────────────────────────────────────────────────────────

const colorTokens = [
  { name: 'background', var: '--background', label: 'Background' },
  { name: 'foreground', var: '--foreground', label: 'Foreground' },
  { name: 'primary', var: '--primary', label: 'Primary' },
  { name: 'secondary', var: '--secondary', label: 'Secondary' },
  { name: 'muted', var: '--muted', label: 'Muted' },
  { name: 'accent', var: '--accent', label: 'Accent' },
  { name: 'destructive', var: '--destructive', label: 'Destructive' },
  { name: 'border', var: '--border', label: 'Border' },
]

const appColors = [
  { label: 'Green 700 (primary brand)', tw: 'bg-green-700', hex: '#15803d' },
  { label: 'Green 800 (nav bg)', tw: 'bg-green-800', hex: '#166534' },
  { label: 'Green 600 (nav active)', tw: 'bg-green-600', hex: '#16a34a' },
  { label: 'Orange (en attente)', tw: 'bg-orange-100', text: 'text-orange-700', hex: '#fed7aa' },
  { label: 'Blue (vérifiée)', tw: 'bg-blue-100', text: 'text-blue-700', hex: '#dbeafe' },
  { label: 'Green (validée)', tw: 'bg-green-100', text: 'text-green-700', hex: '#dcfce7' },
  { label: 'Red (rejetée)', tw: 'bg-red-100', text: 'text-red-700', hex: '#fee2e2' },
  { label: 'Gray (brouillon)', tw: 'bg-gray-100', text: 'text-gray-700', hex: '#f3f4f6' },
]

// ── Statut badge ────────────────────────────────────────────────────────────

const STATUT_CLASSES: Record<string, string> = {
  brouillon: 'bg-gray-100 text-gray-700',
  en_attente: 'bg-orange-100 text-orange-700',
  verifiee: 'bg-blue-100 text-blue-700',
  validee: 'bg-green-100 text-green-700',
  rejetee: 'bg-red-100 text-red-700',
}

const STATUT_LABELS: Record<string, string> = {
  brouillon: 'Brouillon',
  en_attente: 'En attente',
  verifiee: 'Vérifiée',
  validee: 'Validée',
  rejetee: 'Rejetée',
}

function StatutBadge({ statut }: { statut: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
        STATUT_CLASSES[statut] ?? 'bg-gray-100 text-gray-700',
      )}
    >
      {STATUT_LABELS[statut] ?? statut}
    </span>
  )
}

// ── Section wrapper ─────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground border-b pb-2">{title}</h2>
      {children}
    </section>
  )
}

function Chip({ label, code }: { label: string; code: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-mono text-muted-foreground">{code}</span>
      <span className="text-sm">{label}</span>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export function DesignSystemPage() {
  const [selectVal, setSelectVal] = useState('')
  const [inputVal, setInputVal] = useState('')

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-12">
      <div>
        <h1 className="text-3xl font-bold mb-1">Charte Design System</h1>
        <p className="text-muted-foreground text-sm">
          Référence des composants shadcn/ui disponibles dans ce projet. Stack :
          shadcn + @base-ui/react + Tailwind CSS.
        </p>
      </div>

      {/* ── Couleurs ── */}
      <Section title="Couleurs — tokens CSS">
        <div className="grid grid-cols-4 gap-3">
          {colorTokens.map((t) => (
            <div key={t.var} className="flex flex-col gap-1">
              <div
                className="h-12 rounded-lg border"
                style={{ background: `hsl(var(${t.var}))` }}
              />
              <Chip label={t.label} code={t.var} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Couleurs — brand IFVM">
        <div className="grid grid-cols-4 gap-3">
          {appColors.map((c) => (
            <div key={c.label} className="flex flex-col gap-1">
              <div className={cn('h-12 rounded-lg border flex items-center justify-center', c.tw)}>
                {c.text && (
                  <span className={cn('text-xs font-medium', c.text)}>Aa</span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">{c.label}</span>
              <span className="text-xs font-mono text-muted-foreground">{c.hex}</span>
            </div>
          ))}
        </div>
      </Section>

      <Separator />

      {/* ── Typographie ── */}
      <Section title="Typographie">
        <div className="space-y-3">
          <div>
            <p className="text-3xl font-bold">Titre h1 — font-bold text-3xl</p>
          </div>
          <div>
            <p className="text-2xl font-bold">Titre h2 — font-bold text-2xl</p>
          </div>
          <div>
            <p className="text-lg font-semibold">Titre h3 — font-semibold text-lg</p>
          </div>
          <div>
            <p className="text-sm">Corps de texte — text-sm</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Caption / muted — text-xs text-muted-foreground</p>
          </div>
          <div>
            <p className="font-mono text-sm">Mono (IDs, codes) — font-mono text-sm</p>
          </div>
        </div>
      </Section>

      <Separator />

      {/* ── Boutons ── */}
      <Section title="Button">
        <div className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-mono">variant=</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="default">Default</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="link">Link</Button>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-mono">size=</p>
            <div className="flex items-center flex-wrap gap-2">
              <Button size="lg">Large</Button>
              <Button size="default">Default</Button>
              <Button size="sm">Small</Button>
              <Button size="xs">XSmall</Button>
              <Button disabled>Disabled</Button>
            </div>
          </div>
        </div>
      </Section>

      <Separator />

      {/* ── StatusBadge ── */}
      <Section title="StatusBadge">
        <div className="flex flex-wrap gap-2">
          {STATUTS.map((s) => (
            <StatusBadge key={s} statut={s} />
          ))}
        </div>
      </Section>

      <Separator />

      {/* ── Input ── */}
      <Section title="Input">
        <div className="grid grid-cols-2 gap-4 max-w-lg">
          <div className="space-y-1.5">
            <Label htmlFor="ex-text">Texte</Label>
            <Input
              id="ex-text"
              type="text"
              placeholder="Saisir une valeur…"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ex-date">Date</Label>
            <Input id="ex-date" type="date" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ex-disabled">Désactivé</Label>
            <Input id="ex-disabled" type="text" placeholder="Non modifiable" disabled />
          </div>
        </div>
      </Section>

      <Separator />

      {/* ── Select ── */}
      <Section title="Select">
        <div className="flex items-center gap-4">
          <Select value={selectVal} onValueChange={(v) => setSelectVal(v ?? '')}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Choisir un statut…" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUT_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectVal && (
            <StatutBadge statut={selectVal} />
          )}
        </div>
      </Section>

      <Separator />

      {/* ── Badges statut ── */}
      <Section title="Badge statut (composant custom)">
        <p className="text-xs text-muted-foreground">
          Pas de composant Badge dans shadcn ici — utiliser ces classes Tailwind directement.
        </p>
        <div className="flex flex-wrap gap-3 mt-2">
          {Object.keys(STATUT_LABELS).map((s) => (
            <div key={s} className="flex flex-col items-center gap-1">
              <StatutBadge statut={s} />
              <span className="text-xs font-mono text-muted-foreground">{s}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 bg-muted rounded p-3 text-xs font-mono text-muted-foreground">
          {`<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">`}
          <br />
          {'  En attente'}
          <br />
          {'</span>'}
        </div>
      </Section>

      <Separator />

      {/* ── Card ── */}
      <Section title="Card">
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Titre de la carte</CardTitle>
              <CardDescription>Description optionnelle en muted</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm">Contenu principal de la carte.</p>
            </CardContent>
            <CardFooter>
              <Button size="sm">Action</Button>
            </CardFooter>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardTitle>Carte compacte (size=sm)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Espacement réduit.</p>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Separator />

      {/* ── Table ── */}
      <Section title="Table">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colonne A</TableHead>
                  <TableHead>Colonne B</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(['brouillon', 'en_attente', 'verifiee', 'validee', 'rejetee'] as const).map((s) => (
                  <TableRow key={s}>
                    <TableCell className="font-medium">Fiche #{s.slice(0, 4)}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">2025-06-25</TableCell>
                    <TableCell><StatutBadge statut={s} /></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="xs">Voir</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Section>

      <Separator />

      {/* ── Tabs ── */}
      <Section title="Tabs">
        <div className="space-y-6">
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-mono">variant=default</p>
            <Tabs defaultValue="tab1">
              <TabsList>
                <TabsTrigger value="tab1">Onglet 1</TabsTrigger>
                <TabsTrigger value="tab2">Onglet 2</TabsTrigger>
                <TabsTrigger value="tab3">Onglet 3</TabsTrigger>
              </TabsList>
              <TabsContent value="tab1">
                <p className="text-sm pt-3">Contenu de l'onglet 1.</p>
              </TabsContent>
              <TabsContent value="tab2">
                <p className="text-sm pt-3">Contenu de l'onglet 2.</p>
              </TabsContent>
              <TabsContent value="tab3">
                <p className="text-sm pt-3">Contenu de l'onglet 3.</p>
              </TabsContent>
            </Tabs>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-mono">variant=line</p>
            <Tabs defaultValue="tab1">
              <TabsList variant="line">
                <TabsTrigger value="tab1">Onglet 1</TabsTrigger>
                <TabsTrigger value="tab2">Onglet 2</TabsTrigger>
              </TabsList>
              <TabsContent value="tab1">
                <p className="text-sm pt-3">Contenu ligne 1.</p>
              </TabsContent>
              <TabsContent value="tab2">
                <p className="text-sm pt-3">Contenu ligne 2.</p>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </Section>

      <Separator />

      {/* ── Espacements ── */}
      <Section title="Espacements — scale Tailwind">
        {/* Échelle de référence */}
        <div className="space-y-2">
          {[
            { token: '0.5', px: '2px',  tw: 'p-0.5',  desc: 'Micro — badge interne, icône dense' },
            { token: '1',   px: '4px',  tw: 'p-1',    desc: 'XS — gap entre éléments inline' },
            { token: '1.5', px: '6px',  tw: 'p-1.5',  desc: 'XS+ — padding bouton xs/sm' },
            { token: '2',   px: '8px',  tw: 'p-2',    desc: 'SM — cellule de table (TableCell p-2)' },
            { token: '2.5', px: '10px', tw: 'p-2.5',  desc: 'SM+ — padding input (px-2.5)' },
            { token: '3',   px: '12px', tw: 'p-3',    desc: 'MD — card compacte (size=sm)' },
            { token: '4',   px: '16px', tw: 'p-4',    desc: 'MD+ — card standard, filtres' },
            { token: '6',   px: '24px', tw: 'p-6',    desc: 'LG — padding de page principale' },
            { token: '8',   px: '32px', tw: 'p-8',    desc: 'XL — padding large (design system page)' },
            { token: '12',  px: '48px', tw: 'p-12',   desc: 'XXL — sections espacées' },
          ].map(({ token, px, tw, desc }) => (
            <div key={token} className="flex items-center gap-4">
              <div className="w-16 text-right font-mono text-xs text-muted-foreground shrink-0">
                {token}
              </div>
              <div
                className="bg-green-200 border border-green-400 rounded shrink-0"
                style={{ width: px, height: '16px', minWidth: px }}
              />
              <div className="flex items-center gap-2 min-w-0">
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono shrink-0">{tw}</code>
                <span className="text-xs text-muted-foreground">{px}</span>
                <span className="text-xs text-foreground/60">— {desc}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Espacements — normes par contexte">
        <div className="grid grid-cols-2 gap-4 text-sm">

          {/* Page */}
          <Card size="sm">
            <CardHeader><CardTitle>Page / layout</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-muted-foreground text-xs">
              <p><code className="font-mono bg-muted px-1 rounded">p-6</code> padding de la zone de contenu principale</p>
              <p><code className="font-mono bg-muted px-1 rounded">mb-6</code> entre le header de page et son contenu</p>
              <p><code className="font-mono bg-muted px-1 rounded">gap-3</code> entre éléments d'une barre d'actions</p>
              <p><code className="font-mono bg-muted px-1 rounded">space-y-12</code> entre sections majeures (DS page)</p>
            </CardContent>
          </Card>

          {/* Card */}
          <Card size="sm">
            <CardHeader><CardTitle>Card</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-muted-foreground text-xs">
              <p><code className="font-mono bg-muted px-1 rounded">p-4</code> intérieur standard (via <code>--card-spacing</code>)</p>
              <p><code className="font-mono bg-muted px-1 rounded">p-3</code> intérieur compact (<code>size="sm"</code>)</p>
              <p><code className="font-mono bg-muted px-1 rounded">p-0 + CardContent</code> pour tables dans Card</p>
              <p><code className="font-mono bg-muted px-1 rounded">mb-4</code> entre Card filtre et tableau</p>
            </CardContent>
          </Card>

          {/* Table */}
          <Card size="sm">
            <CardHeader><CardTitle>Table</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-muted-foreground text-xs">
              <p><code className="font-mono bg-muted px-1 rounded">p-2</code> cellules (<code>TableCell</code> par défaut)</p>
              <p><code className="font-mono bg-muted px-1 rounded">h-10</code> hauteur en-tête (<code>TableHead</code>)</p>
              <p>Pas de padding custom sur les lignes — utiliser <code>TableCell</code></p>
            </CardContent>
          </Card>

          {/* Formulaire */}
          <Card size="sm">
            <CardHeader><CardTitle>Formulaire / filtres</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-muted-foreground text-xs">
              <p><code className="font-mono bg-muted px-1 rounded">gap-3</code> entre champs d'une même ligne</p>
              <p><code className="font-mono bg-muted px-1 rounded">gap-1</code> entre Label et Input</p>
              <p><code className="font-mono bg-muted px-1 rounded">space-y-4</code> entre groupes de champs empilés</p>
              <p><code className="font-mono bg-muted px-1 rounded">pt-4</code> CardContent d'un panneau de filtres</p>
            </CardContent>
          </Card>

          {/* Navigation */}
          <Card size="sm">
            <CardHeader><CardTitle>Navigation (sidebar)</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-muted-foreground text-xs">
              <p><code className="font-mono bg-muted px-1 rounded">px-4 py-4</code> logo / header sidebar</p>
              <p><code className="font-mono bg-muted px-1 rounded">px-2 py-4</code> zone nav</p>
              <p><code className="font-mono bg-muted px-1 rounded">px-3 py-2</code> item NavLink</p>
              <p><code className="font-mono bg-muted px-1 rounded">space-y-1</code> entre items nav</p>
            </CardContent>
          </Card>

          {/* Boutons & badges */}
          <Card size="sm">
            <CardHeader><CardTitle>Boutons &amp; badges</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-muted-foreground text-xs">
              <p><code className="font-mono bg-muted px-1 rounded">gap-2</code> entre boutons adjacents</p>
              <p><code className="font-mono bg-muted px-1 rounded">px-2 py-0.5</code> badge statut custom</p>
              <p>Padding bouton géré par <code>size=</code> — ne pas surcharger</p>
            </CardContent>
          </Card>
        </div>

        {/* Exemple visuel annoté */}
        <div className="mt-6">
          <p className="text-xs font-medium text-muted-foreground mb-3">Exemple annoté — structure d'une page liste</p>
          <div className="border rounded-xl overflow-hidden text-xs font-mono">
            <div className="bg-muted px-3 py-1 text-muted-foreground border-b">page.tsx</div>
            <pre className="p-4 text-[11px] leading-5 overflow-x-auto">{`<div className="p-6">                      {/* padding page */}
  <div className="flex justify-between mb-6"> {/* mb-6 header→contenu */}
    <h1>Titre</h1>
    <Button>Action</Button>
  </div>

  <Card className="mb-4">                    {/* mb-4 card→tableau */}
    <CardContent className="pt-4 flex gap-3"> {/* gap-3 entre filtres */}
      <div className="flex flex-col gap-1">   {/* gap-1 label→input */}
        <Label />
        <Input />
      </div>
    </CardContent>
  </Card>

  <Card>
    <CardContent className="p-0">            {/* p-0 pour tables */}
      <Table>
        <TableCell>…</TableCell>              {/* p-2 par défaut */}
      </Table>
    </CardContent>
  </Card>
</div>`}</pre>
          </div>
        </div>
      </Section>

      <Separator />

      {/* ── Usage rules ── */}
      <Section title="Règles d'utilisation">
        <div className="space-y-3 text-sm">
          <div className="bg-muted rounded p-3 space-y-1">
            <p className="font-semibold">✅ Toujours utiliser</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
              <li><code>Button</code> pour toute action cliquable</li>
              <li><code>Table*</code> pour les listes tabulaires</li>
              <li><code>Select*</code> pour les listes déroulantes filtrantes</li>
              <li><code>Input</code> + <code>Label</code> pour les champs de formulaire</li>
              <li><code>Card</code> pour encadrer du contenu distinct</li>
            </ul>
          </div>
          <div className="bg-muted rounded p-3 space-y-1">
            <p className="font-semibold">❌ Ne pas utiliser</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
              <li>balises <code>&lt;button&gt;</code> nues → remplacer par <code>Button</code></li>
              <li><code>&lt;select&gt;</code> natif → remplacer par <code>Select*</code></li>
              <li><code>&lt;input&gt;</code> nu → remplacer par <code>Input</code></li>
              <li>classes <code>bg-green-700</code> pour les actions → réserver au branding nav uniquement</li>
            </ul>
          </div>
        </div>
      </Section>

      <div className="h-8" />
    </div>
  )
}
