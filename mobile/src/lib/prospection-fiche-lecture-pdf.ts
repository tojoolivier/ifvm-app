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

  // Section Pullulation
  const pullulationHtml = recap.pullulation ? `
    <div class="section">
      <h2>Pullulation</h2>
      <table>
        <tr><td class="label">Nombre</td><td class="value">${recap.pullulation.nb ?? '—'}</td></tr>
        <tr><td class="label">Interdistance</td><td class="value">${recap.pullulation.interdistance != null ? `${recap.pullulation.interdistance} m` : '—'}</td></tr>
        <tr><td class="label">Taille</td><td class="value">${escapeHtml(recap.pullulation.taille || '—')}</td></tr>
      </table>
    </div>
  ` : '';

  // Section Essaim
  const essaimHtml = recap.essaim ? `
    <div class="section">
      <h2>Essaim</h2>
      <table>
        ${recap.essaim.type ? `<tr><td class="label">Type</td><td class="value">${escapeHtml(recap.essaim.type)}</td></tr>` : ''}
        ${recap.essaim.provenance ? `<tr><td class="label">Provenance</td><td class="value">${escapeHtml(recap.essaim.provenance)}</td></tr>` : ''}
        ${recap.essaim.direction ? `<tr><td class="label">Direction</td><td class="value">${escapeHtml(recap.essaim.direction)}</td></tr>` : ''}
        ${recap.essaim.pose != null ? `<tr><td class="label">Posé</td><td class="value">${recap.essaim.pose ? 'Oui' : 'Non'}</td></tr>` : ''}
        ${recap.essaim.surfaceContaminee != null ? `<tr><td class="label">Surface contaminée</td><td class="value">${recap.essaim.surfaceContaminee} ha</td></tr>` : ''}
      </table>
    </div>
  ` : '';

  const typeLabels: Record<string, string> = {
    'intensive': 'Intensive',
    'extensive': 'Extensive',
    'validation': 'Validation'
  };

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
      .section { margin-bottom: 16px; }
    </style>
  </head>
  <body>
    <h1>IFVM — Fiche de prospection</h1>
    <span class="badge">${escapeHtml(recap.statutLabel)}</span>

    <div class="section">
      <h2>Fiche</h2>
      <table>
        <tr><td class="label">N° fiche</td><td class="value">${escapeHtml(recap.nFiche)}</td></tr>
        ${recap.nReleve ? `<tr><td class="label">N° relevé</td><td class="value">${escapeHtml(recap.nReleve)}</td></tr>` : ''}
        ${recap.nMessage ? `<tr><td class="label">N° message</td><td class="value">${escapeHtml(recap.nMessage)}</td></tr>` : ''}
        <tr><td class="label">Station / localité</td><td class="value">${escapeHtml(recap.stationLabel)}</td></tr>
        <tr><td class="label">Date</td><td class="value">${escapeHtml(recap.dateProspection)}</td></tr>
        <tr><td class="label">Type</td><td class="value">${escapeHtml(typeLabels[recap.typeProspection] || recap.typeProspection)}</td></tr>
        <tr><td class="label">Prospecteur</td><td class="value">${escapeHtml(prospecteurLabel)}</td></tr>
      </table>
    </div>

    ${recap.biotope ? `
    <div class="section">
      <h2>Biotope</h2>
      <table>
        <tr><td class="label">Biotope</td><td class="value">${escapeHtml(recap.biotope)}</td></tr>
        ${recap.altitude != null ? `<tr><td class="label">Altitude</td><td class="value">${recap.altitude} m</td></tr>` : ''}
      </table>
    </div>` : ''}

    <div class="section">
      <h2>Surfaces</h2>
      <table>
        <tr><td class="label">Surface station</td><td class="value">${recap.surfaces.station != null ? `${recap.surfaces.station} ha` : '—'}</td></tr>
        <tr><td class="label">Surface prospectée</td><td class="value">${recap.surfaces.prospectee != null ? `${recap.surfaces.prospectee} ha` : '—'}</td></tr>
        <tr><td class="label">Surface infestée</td><td class="value">${recap.surfaces.infestee != null ? `${recap.surfaces.infestee} ha` : '—'}</td></tr>
        ${recap.surfaces.contaminee != null ? `<tr><td class="label">Surface contaminée</td><td class="value">${recap.surfaces.contaminee} ha</td></tr>` : ''}
      </table>
    </div>

    ${recap.infestation.hasInfestation ? `
    <div class="section">
      <h2>Infestation</h2>
      <table>
        <tr><td class="label">Type</td><td class="value">${escapeHtml(recap.infestation.typeLabel)}</td></tr>
        ${recap.infestation.espece ? `<tr><td class="label">Espèce</td><td class="value">${escapeHtml(recap.infestation.espece)}</td></tr>` : ''}
        <tr><td class="label">Surface</td><td class="value">${recap.infestation.surfaceTot != null ? `${recap.infestation.surfaceTot} ha` : '—'}</td></tr>
        <tr><td class="label">Comportement</td><td class="value">${escapeHtml(recap.infestation.comportementLabel)}</td></tr>
        ${recap.infestation.direction ? `<tr><td class="label">Direction</td><td class="value">${escapeHtml(recap.infestation.direction)}</td></tr>` : ''}
        ${recap.infestation.vent ? `<tr><td class="label">Vent</td><td class="value">${escapeHtml(recap.infestation.vent)}</td></tr>` : ''}
      </table>
    </div>` : ''}

    <div class="section">
      <h2>Synthèse par espèce</h2>
      <table>
        <tr><td class="label">Espèce</td><td class="label">Total capturé</td><td class="label">Densité diffuse /ha</td><td class="label">Densité groupée /ha</td><td class="label">Phénotype dominant</td></tr>
        ${especesRows || '<tr><td colspan="5">Aucune capture enregistrée.</td></tr>'}
      </table>
    </div>

    <div class="section">
      <h2>Végétation & sol</h2>
      <p>${escapeHtml(recap.vegetationSummary)}</p>
      ${recap.verdissement != null ? `<p>Verdissement : ${recap.verdissement}%</p>` : ''}
      ${recap.hauteurStrate != null ? `<p>Hauteur strate : ${recap.hauteurStrate} m</p>` : ''}
    </div>

    ${pullulationHtml}
    ${essaimHtml}

    ${recap.observations ? `
    <div class="section">
      <h2>Observations</h2>
      <p>${escapeHtml(recap.observations)}</p>
    </div>` : ''}

    <div class="section">
      <h2>Historique</h2>
      <table>
        ${recap.historique.verifieLe ? `<tr><td class="label">Vérifié le</td><td class="value">${escapeHtml(recap.historique.verifieLe)}</td></tr>` : ''}
        ${recap.historique.valideLe ? `<tr><td class="label">Validé le</td><td class="value">${escapeHtml(recap.historique.valideLe)}</td></tr>` : ''}
        <tr><td class="label">Créé le</td><td class="value">${escapeHtml(recap.historique.creeLe)}</td></tr>
        <tr><td class="label">Mis à jour</td><td class="value">${escapeHtml(recap.historique.modifieLe)}</td></tr>
      </table>
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
      default:
        return '&#39;';
    }
  });
}