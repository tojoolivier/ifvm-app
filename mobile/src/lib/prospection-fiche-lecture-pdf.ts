import { FicheLectureViewModel } from './prospection-fiche-lecture';

/** Génère le HTML imprimé en PDF par expo-print pour la Fiche de lecture (#16), mêmes valeurs que l'écran. */
export function buildFicheLecturePdfHtml(recap: FicheLectureViewModel, prospecteurLabel: string): string {
  const especesRows = recap.especes
    .map(
      (e) => `
        <tr>
          <td>${escapeHtml(e.espece)}</td>
          <td>${e.totalCaptures}</td>
          <td>${e.densiteDiffuse ?? '—'}</td>
          <td>${e.densiteGroupee ?? '—'}</td>
          <td>${escapeHtml(e.phenotypeDominantLabel)}</td>
        </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #111827; padding: 24px; }
      h1 { font-size: 18px; color: #163F16; margin-bottom: 4px; }
      h2 { font-size: 13px; text-transform: uppercase; color: #6B7280; margin: 20px 0 6px; }
      .badge { display: inline-block; background: #DCFCE7; color: #15803d; font-weight: 700; font-size: 12px; padding: 3px 8px; border-radius: 6px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      td { padding: 4px 6px; border-bottom: 1px solid #E5E7EB; }
      .label { color: #6B7280; }
      .value { font-weight: 600; }
    </style>
  </head>
  <body>
    <h1>IFVM — Fiche de prospection</h1>
    <span class="badge">${escapeHtml(recap.statutLabel)}</span>

    <h2>Fiche</h2>
    <table>
      <tr><td class="label">N° fiche</td><td class="value">${escapeHtml(recap.nFiche)}</td></tr>
      <tr><td class="label">Station / localité</td><td class="value">${escapeHtml(recap.stationLabel)}</td></tr>
      <tr><td class="label">Date</td><td class="value">${escapeHtml(recap.dateProspection)}</td></tr>
      <tr><td class="label">Prospecteur</td><td class="value">${escapeHtml(prospecteurLabel)}</td></tr>
    </table>

    ${
      recap.infestation.hasInfestation
        ? `<h2>Infestation</h2>
    <table>
      <tr><td class="label">Type</td><td class="value">${escapeHtml(recap.infestation.typeLabel)}</td></tr>
      <tr><td class="label">Surface</td><td class="value">${recap.infestation.surfaceTot != null ? `${recap.infestation.surfaceTot} ha` : '—'}</td></tr>
      <tr><td class="label">Comportement</td><td class="value">${escapeHtml(recap.infestation.comportementLabel)}</td></tr>
    </table>`
        : ''
    }

    <h2>Synthèse par espèce</h2>
    <table>
      <tr><td class="label">Espèce</td><td class="label">Total capturé</td><td class="label">Densité diffuse /ha</td><td class="label">Densité groupée /ha</td><td class="label">Phénotype dominant</td></tr>
      ${especesRows || '<tr><td colspan="5">Aucune capture enregistrée.</td></tr>'}
    </table>

    <h2>Végétation & sol</h2>
    <p>${escapeHtml(recap.vegetationSummary)}</p>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}
