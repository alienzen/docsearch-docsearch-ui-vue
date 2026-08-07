import { readFileSync } from 'node:fs'
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
// Identité simulée pour `npm run dev`. ⚠️  N'a d'effet que si l'API tourne
// avec TRUST_X_USER_HEADER=true (donc hors production, où elle refuse de
// démarrer avec ce drapeau — voir app/auth/guardrails.py). Sans lui,
// l'en-tête est ignoré et le serveur de développement se comporte comme
// la production : il faut passer par /connexion.
const DEV_USER = process.env.VITE_DEV_USER ?? 'dev-user'

// ── Identité de la livraison ────────────────────────────────
// Figée dans le bundle au build : l'interface est servie en statique par
// Nginx, il n'y a aucune exécution côté serveur pour lire une variable
// d'environnement à la volée.
//
// La version PRODUIT vient du fichier VERSION, seule source de vérité —
// et NON du champ `version` de package.json, qui reste à 0.0.0 : ce
// paquet n'est jamais publié, et deux valeurs à maintenir en parallèle
// finiraient par diverger. L'estampille de build (commit + date) est
// injectée par ./manage.sh build via les ARG du Containerfile.
const VERSION = readFileSync(fileURLToPath(new URL('./VERSION', import.meta.url)), 'utf-8').trim()

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
  define: {
    // DOCSEARCH_VERSION reste prioritaire sur le fichier : c'est
    // ./manage.sh build qui le passe, et il le lit du même VERSION —
    // l'égalité est donc garantie. Le repli sur le fichier sert
    // `npm run dev` et `npm run build` lancés à la main.
    __DOCSEARCH_VERSION__: JSON.stringify(process.env.DOCSEARCH_VERSION || VERSION),
    __DOCSEARCH_COMMIT__: JSON.stringify(process.env.DOCSEARCH_COMMIT || 'inconnu'),
    __DOCSEARCH_BUILD_DATE__: JSON.stringify(process.env.DOCSEARCH_BUILD_DATE || 'inconnu'),
  },

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
        admin: fileURLToPath(new URL('./admin.html', import.meta.url)),
        'admin-help': fileURLToPath(new URL('./admin-help.html', import.meta.url)),
        // Seule page PUBLIQUE : c'est celle qui permet d'obtenir une
        // session, elle ne peut pas en exiger une (voir nginx.conf,
        // location = /connexion, sans auth_request).
        connexion: fileURLToPath(new URL('./connexion.html', import.meta.url)),
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
