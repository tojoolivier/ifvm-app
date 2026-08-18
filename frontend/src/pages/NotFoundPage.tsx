import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gray-50 px-8 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Erreur 404</p>
      <h1 className="text-2xl font-bold">Page introuvable</h1>
      <p className="text-sm text-muted-foreground">
        Cette page n'existe pas ou a été déplacée.
      </p>
      <Link
        to="/"
        className="inline-flex h-8 items-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80"
      >
        Retour à l'accueil
      </Link>
    </div>
  )
}
