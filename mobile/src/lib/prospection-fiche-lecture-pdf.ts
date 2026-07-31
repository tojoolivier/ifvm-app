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

  // Construction des lignes de localisation
  const locationRows = [
    recap.region ? `<tr><td class="label">Région</td><td class="value">${escapeHtml(recap.region)}</td></tr>` : '',
    recap.district ? `<tr><td class="label">District</td><td class="value">${escapeHtml(recap.district)}</td></tr>` : '',
    recap.commune ? `<tr><td class="label">Commune</td><td class="value">${escapeHtml(recap.commune)}</td></tr>` : '',
    recap.za ? `<tr><td class="label">ZA</td><td class="value">${escapeHtml(recap.za)}</td></tr>` : '',
    recap.pa_code ? `<tr><td class="label">PA</td><td class="value">${escapeHtml(recap.pa_code)}</td></tr>` : '',
  ].filter(Boolean).join('');

  // Construction des lignes d'infestation
  const infestationRows = [
    recap.infestation.pullulationNb != null ? `<tr><td class="label">Pullulation</td><td class="value">${recap.infestation.pullulationNb}</td></tr>` : '',
    recap.infestation.tailleEssaim !== '—' ? `<tr><td class="label">Taille essaim</td><td class="value">${escapeHtml(recap.infestation.tailleEssaim)}</td></tr>` : '',
    recap.infestation.typeEssaim ? `<tr><td class="label">Type essaim</td><td class="value">${escapeHtml(recap.infestation.typeEssaim)}</td></tr>` : '',
    recap.infestation.typeLarve ? `<tr><td class="label">Type larve</td><td class="value">${escapeHtml(recap.infestation.typeLarve)}</td></tr>` : '',
    recap.infestation.surfaceContamineeHa != null ? `<tr><td class="label">Surface contaminée</td><td class="value">${recap.infestation.surfaceContamineeHa} ha</td></tr>` : '',
    recap.infestation.surfInfesteePourcent != null ? `<tr><td class="label">Surface infestée (%)</td><td class="value">${recap.infestation.surfInfesteePourcent}%</td></tr>` : '',
  ].filter(Boolean).join('');

  // Construction des lignes d'observations
  const observationRows = [
    recap.degatsCulturesPourcent != null ? `<tr><td class="label">Dégâts cultures</td><td class="value">${recap.degatsCulturesPourcent}%</td></tr>` : '',
    recap.verdissementPourcent != null ? `<tr><td class="label">Verdissement strate herbeuse</td><td class="value">${recap.verdissementPourcent}%</td></tr>` : '',
    recap.hauteurHerbeCm != null ? `<tr><td class="label">Hauteur strate herbacée</td><td class="value">${recap.hauteurHerbeCm} cm</td></tr>` : '',
  ].filter(Boolean).join('');

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body {
        font-family: -apple-system, Helvetica, Arial, sans-serif;
        color: #111827;
        padding: 24px;
        background: #ffffff;
      }
      .container {
        max-width: 800px;
        margin: 0 auto;
      }
      h1 {
        font-size: 24px;
        color: #163F16;
        margin-bottom: 4px;
        border-bottom: 2px solid #163F16;
        padding-bottom: 8px;
      }
      h2 {
        font-size: 14px;
        text-transform: uppercase;
        color: #6B7280;
        margin: 24px 0 8px 0;
        letter-spacing: 0.5px;
        border-bottom: 1px solid #E5E7EB;
        padding-bottom: 4px;
      }
      .badge {
        display: inline-block;
        background: #DCFCE7;
        color: #15803d;
        font-weight: 700;
        font-size: 12px;
        padding: 4px 12px;
        border-radius: 6px;
        margin-top: 8px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }
      td {
        padding: 6px 8px;
        border-bottom: 1px solid #F3F4F6;
      }
      .label {
        color: #6B7280;
        font-weight: 500;
        width: 40%;
      }
      .value {
        font-weight: 600;
        color: #111827;
        width: 60%;
      }
      .section {
        margin-top: 16px;
        padding: 12px;
        background: #F9FAFB;
        border-radius: 8px;
      }
      .no-data {
        color: #9CA3AF;
        font-style: italic;
      }
      @media print {
        body { padding: 16px; }
        .no-print { display: none; }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>IFVM — Fiche de prospection</h1>
      <span class="badge">${escapeHtml(recap.statutLabel)}</span>

      <!-- Références -->
      <h2>Références</h2>
      <table>
        <tr>
          <td class="label">N° fiche</td>
          <td class="value">${escapeHtml(recap.nFiche)}</td>
        </tr>
        <tr>
          <td class="label">Station / localité</td>
          <td class="value">${escapeHtml(recap.stationLabel)}</td>
        </tr>
        <tr>
          <td class="label">Date</td>
          <td class="value">${escapeHtml(recap.dateProspection)}</td>
        </tr>
        <tr>
          <td class="label">Prospecteur</td>
          <td class="value">${escapeHtml(prospecteurLabel)}</td>
        </tr>
      </table>

      <!-- Localisation (nouveaux champs) -->
      ${locationRows ? `
      <h2>Localisation</h2>
      <table>
        ${locationRows}
      </table>` : ''}

      <!-- Infestation -->
      <h2>Infestation</h2>
      ${recap.infestation.hasInfestation ? `
      <table>
        <tr>
          <td class="label">Type</td>
          <td class="value">${escapeHtml(recap.infestation.typeLabel)}</td>
        </tr>
        ${recap.infestation.surfaceTot != null ? `
        <tr>
          <td class="label">Surface infestée</td>
          <td class="value">${recap.infestation.surfaceTot} ha</td>
        </tr>` : ''}
        ${recap.infestation.comportementLabel !== '—' ? `
        <tr>
          <td class="label">Comportement</td>
          <td class="value">${escapeHtml(recap.infestation.comportementLabel)}</td>
        </tr>` : ''}
        ${infestationRows}
      </table>` : `
      <table>
        <tr>
          <td class="value no-data">Aucune infestation enregistrée</td>
        </tr>
      </table>`}

      <!-- Synthèse par espèce -->
      <h2>Synthèse par espèce</h2>
      <table>
        <thead>
          <tr>
            <th class="label">Espèce</th>
            <th class="label">Total capturé</th>
            <th class="label">Densité diffuse /ha</th>
            <th class="label">Densité groupée /ha</th>
            <th class="label">Phénotype dominant</th>
          </tr>
        </thead>
        <tbody>
          ${especesRows || '<tr><td colspan="5" class="no-data">Aucune capture enregistrée.</td></tr>'}
        </tbody>
      </table>

      <!-- Végétation & sol -->
      <h2>Végétation &amp; sol</h2>
      <div class="section">
        <p>${escapeHtml(recap.vegetationSummary)}</p>
      </div>

      <!-- Observations (nouveaux champs) -->
      ${observationRows ? `
      <h2>Observations</h2>
      <table>
        ${observationRows}
      </table>` : ''}

      <!-- Pied de page -->
      <div style="margin-top: 40px; border-top: 1px solid #E5E7EB; padding-top: 12px; font-size: 11px; color: #9CA3AF; text-align: center;">
        Document généré par IFVM — ${new Date().toLocaleDateString('fr-FR')}
      </div>
    </div>
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
      case "'":
        return '&#39;';
      default:
        return c;
    }
  });
}