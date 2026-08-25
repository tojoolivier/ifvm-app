/**
 * `global.css` n'est pas du JavaScript : NativeWind le fait passer par Metro,
 * que Jest ne joue pas. Sans ce stub, tout écran qui touche au thème
 * (`themed-text` → `constants/theme` → `@/global.css`) échoue à l'import avec
 * un `SyntaxError` sur `@tailwind base;`, bien avant le premier rendu.
 *
 * Câblé par `moduleNameMapper` dans `jest.config.js`.
 */
module.exports = {};
