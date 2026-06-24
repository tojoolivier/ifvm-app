# Issue 07 — App mobile : écran de création de fiche intensive

**Status:** ready-for-agent  
**Priority:** high  
**Depends on:** 02

## Description

Implémenter l'écran mobile pour créer une fiche de prospection intensive depuis l'app.

## Acceptance Criteria

- [ ] Bouton "+" sur l'écran principal ou l'écran prospection
- [ ] Sélection du type : Intensive / Extensive / Validation
- [ ] Sélection de la station fixe (liste avec recherche)
- [ ] Pré-remplissage des infos station
- [ ] Formulaire complet avec tous les champs intensifs
- [ ] Boutons "Sauvegarder" et "Soumettre"
- [ ] Support offline : la fiche est sauvegardée localement
- [ ] Indicateur de sync (synchronisé/désynchronisé)
- [ ] Navigation : retour à la liste après soumission

## Technical Notes

- Utiliser Expo Router pour la navigation
- Utiliser NativeWind pour le style (cohérent avec Tailwind)
- La sauvegarde offline utilise SQLite (Expo SQLite)
- Le sync status est géré par le module de synchronisation existant

## Testing

- Test de navigation : le bouton "+" mène au formulaire
- Test de sélection : la station est correctement sélectionnée
- Test offline : la fiche est sauvegardée sans réseau
- Test de soumission : la fiche passe en "En attente"
