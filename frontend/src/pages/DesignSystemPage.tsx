import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
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
