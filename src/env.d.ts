/// <reference types="vite/client" />

// `@gouvminint/vue-dsfr/styles` est un sous-chemin d'export qui pointe
// sur un .css : Vite sait le résoudre, TypeScript non (TS2882 sur
// l'import à effet de bord). Cette déclaration lui suffit.
declare module '@gouvminint/vue-dsfr/styles'
