/**
 * Bandeau d'erreur rouge de la maquette (`#fbe9e5` / `#f0c4b9` / `#a5341c`).
 * Les deux écrans de traitement rendent les mêmes erreurs API (403 rôle,
 * 404, 409, 422) : un seul composant garantit qu'elles se ressemblent.
 */
export function ErrorBanner({ label, message }: { label: string; message: string }) {
  return (
    <div
      role="alert"
      className="rounded-[10px] border border-ifvm-danger-border bg-ifvm-danger-bg px-4 py-3 font-sans text-[12px] text-ifvm-danger-text"
    >
      <p className="font-semibold">{label}</p>
      <p>{message}</p>
    </div>
  )
}
