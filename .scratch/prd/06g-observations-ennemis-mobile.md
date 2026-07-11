# PRD — Écran 6g : E · Observations & Ennemis naturels (mobile)

## Contexte

Dernier écran de saisie terrain avant le récapitulatif. Il recueille les dégâts sur cultures, les ennemis naturels observés (bio-régulateurs), une observation libre et la possibilité de joindre une photo ou une note vocale.

## Problème utilisateur

> « Je dois noter rapidement si j'ai vu des oiseaux ou des fourmis (prédateurs naturels) et les dégâts sur les cultures. Et parfois j'ai juste besoin de dicter une note en marchant. »

## Fonctionnalités requises

### F1 — Dégâts sur culture
- 4 niveaux en chips exclusives :
  - Nuls | Faibles | Moyens | Forts

### F2 — Ennemis naturels
- Liste de 5 options en multi-sélection :
  - Oiseaux | Fourmis | Reptiles | Mantes | Autre
- "Autre" → champ texte court pour préciser

### F3 — Observation libre
- Zone de texte multiligne (max 500 caractères)
- Bouton 🎤 (dictée vocale — transcription native via API mobile)

### F4 — Photo
- Bouton "+ Photo" → ouvre la caméra ou la galerie
- Miniature de confirmation affichée après sélection
- Max 3 photos par fiche (compression automatique à ≤ 1 Mo/photo)

### F5 — CTA final
- Bouton "Vérifier & enregistrer ✓" (ocre `#E89B2B`)
- Action : navigue vers l'écran de récapitulatif mobile (4b) si validé, ou affiche les erreurs de validation

## Design & UX

- Chips dégâts : 4 colonnes compactes
- Ennemis : chips multi-sélection, fond vert si sélectionné
- Zone de texte : fond blanc, bordure légère, placeholder contextuel

## Critères d'acceptation

- [ ] Les photos sont compressées et stockées localement avant sync
- [ ] La dictée vocale fonctionne hors-ligne (API native, pas d'API cloud)
- [ ] "Vérifier & enregistrer" n'est accessible qu'après saisie de Dégâts sur culture
- [ ] Les observations libres et photos sont transmises lors de la synchronisation
- [ ] L'écran s'affiche comme dernier écran du flux, après Végétation

## Questions ouvertes

- Les photos sont-elles géotagguées automatiquement (coordonnées GPS dans EXIF) ?
- Y a-t-il une limite au nombre de photos par fiche ?
