/// <reference types="vite/client" />

// Identité de la livraison, remplacée textuellement par Vite au build
// (voir le bloc `define` de vite.config.ts). Ce sont des constantes de
// compilation, pas des variables : elles n'existent pas à l'exécution.
declare const __DOCSEARCH_VERSION__: string
declare const __DOCSEARCH_COMMIT__: string
declare const __DOCSEARCH_BUILD_DATE__: string

// `@gouvminint/vue-dsfr/styles` est un sous-chemin d'export qui pointe
// sur un .css : Vite sait le résoudre, TypeScript non (TS2882 sur
// l'import à effet de bord). Cette déclaration lui suffit.
declare module '@gouvminint/vue-dsfr/styles'
