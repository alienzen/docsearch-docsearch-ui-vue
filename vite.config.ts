import { fileURLToPath, URL } from 'node:url'
// `vitest/config` plutôt que `vite` : même defineConfig, mais qui type
// aussi la clé `test` en bas de fichier.
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'

// Cible de l'API pour le serveur de développement (`npm run dev`).
// En Docker, c'est Nginx qui proxifie (voir nginx.conf) — cette config
// ne sert qu'au dev local, où l'API est exposée sur le port 8000 de
// l'hôte (voir docsearch-infra/docker-compose.yml, service "api").
const API_TARGET = process.env.VITE_API_TARGET ?? 'http://localhost:8000'
// En production, ce header est injecté par le SSO en amont du reverse
// proxy ; en dev il n'y a pas de SSO, on simule donc un utilisateur.
const DEV_USER = process.env.VITE_DEV_USER ?? 'dev-user'

// Tous les préfixes proxifiés vers l'API — doit rester le miroir exact
// des blocs `location` de nginx.conf. Ajouter un chemin ici sans
// l'ajouter à nginx.conf (et inversement) est LA source de bugs
// "fonctionne en dev, 404 dans le conteneur".
const API_ROUTES =
  '^/(' +
  [
    'search', // couvre /search et /search/export
    'searchable-sources',
    'custom-facets',
    'document',
    'health',
    'saved-searches',
    'alerts',
    'collections',
    'engagement-config',
    'feedback',
    'click',
    'nps',
    'suggestions',
    'ui-config',
    'is-admin',
    'ask',
    'metrics',
    'auth',
    'admin/', // /admin/... (API) — surtout PAS /admin.html (page)
    'api/preview/',
  ].join('|') +
  ')'

export default defineConfig({
  plugins: [
    vue(),
    // Auto-import des composants DSFR (<DsfrButton />, <DsfrModal />...)
    // sans avoir à les déclarer dans chaque `<script setup>`.
    Components({
      dirs: ['src/components'],
      dts: 'src/components.d.ts',
      resolvers: [
        (componentName: string) =>
          componentName.startsWith('Dsfr')
            ? { name: componentName, from: '@gouvminint/vue-dsfr' }
            : undefined,
      ],
    }),
  ],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Iconify hors ligne, y compris pour le code de vue-dsfr qui
      // importe `@iconify/vue` en dur.
      //
      // Le composant VIcon de vue-dsfr s'appuie sur Iconify, dont le
      // comportement par défaut est d'aller CHERCHER chaque icône sur
      // api.iconify.design au moment de l'affichage : inexploitable sur
      // l'intranet où tourne DocSearch, et fuite des noms demandés vers
      // un tiers. La variante `/offline` est dépourvue de toute logique
      // réseau — une icône non enregistrée localement ne s'affiche pas,
      // plutôt que de déclencher une requête.
      //
      // En pratique l'application n'utilise PAS Iconify : les icônes
      // passent par les classes CSS `fr-icon-*` du DSFR (déjà dans le
      // bundle CSS, et c'est la convention DSFR). Embarquer la
      // collection Remix pour Iconify coûtait 1 Mo de JS, la boucle
      // d'enregistrement empêchant tout élagage. Cet alias reste comme
      // garde-fou : si un `icon:` réapparaît un jour dans un props, il
      // ne partira pas sur le réseau.
      '@iconify/vue': '@iconify/vue/offline',
    },
  },

  build: {
    // ⚠️ Ne pas déplacer sous un préfixe proxifié (/search, /admin,
    // /ask, /api/...) : Nginx enverrait les assets à l'API.
    assetsDir: 'assets',
    rollupOptions: {
      // Une entrée HTML par page — c'est ce qui permet à Nginx de
      // garder son contrôle d'accès page par page (auth_request), que
      // le fallback d'une SPA mono-entrée ferait sauter.
      input: {
        index: fileURLToPath(new URL('./index.html', import.meta.url)),
        help: fileURLToPath(new URL('./help.html', import.meta.url)),
        chat: fileURLToPath(new URL('./chat.html', import.meta.url)),
        stats: fileURLToPath(new URL('./stats.html', import.meta.url)),
      },
    },
  },

  server: {
    host: true,
    port: 5173,
    proxy: {
      [API_ROUTES]: {
        target: API_TARGET,
        changeOrigin: true,
        headers: { 'X-User': DEV_USER },
      },
    },
  },

  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
  },
})
