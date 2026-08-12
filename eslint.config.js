// ─────────────────────────────────────────────────────────────
//  docsearch-ui-vue — Linter (ESLint 10, configuration « plate »)
//
//      npm run lint        # signale
//      npm run lint:fix    # corrige ce qui est sûr
//
//  Règles NON typées (`tseslint.configs.recommended`, pas
//  `recommendedTypeChecked`) : `npm run build` lance déjà `vue-tsc -b`,
//  qui fait l'analyse de types pour de bon. Doubler ce travail dans
//  ESLint le ralentirait beaucoup pour redire la même chose.
// ─────────────────────────────────────────────────────────────

import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'
import globals from 'globals'

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'public/**',
      // Généré par unplugin-vue-components à chaque démarrage de Vite.
      'src/components.d.ts',
    ],
  },

  js.configs.recommended,
  tseslint.configs.recommended,

  // `flat/essential` et non `flat/recommended` : le niveau au-dessus ajoute
  // vue/html-indent, vue/max-attributes-per-line et consorts, soit un
  // reformatage complet des gabarits comme prix d'entrée, pour zéro défaut
  // corrigé. `essential` ne garde que ce qui casse vraiment.
  pluginVue.configs['flat/essential'],

  {
    // Le <script lang="ts"> d'un .vue est lu par vue-eslint-parser, qui
    // délègue le contenu du bloc au parseur TypeScript.
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
  },

  {
    files: ['src/**/*.{ts,vue}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
    },
    rules: {
      // Le préfixe « _ » est la convention du dépôt pour une valeur
      // délibérément mise de côté (`const [, _espacement] = ...`).
      '@typescript-eslint/no-unused-vars': ['error', {
        varsIgnorePattern: '^_',
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],

      // `javascript:` dans une URL. La règle n'est pas dans le socle
      // recommandé, mais ConnexionPage.spec.ts porte déjà un
      // `eslint-disable-next-line no-script-url` — écrit en prévision d'un
      // linter, sur le test qui vérifie justement qu'une telle URL est
      // REFUSÉE. Activer la règle rend cette annotation vraie.
      'no-script-url': 'error',
    },
  },

  {
    // Les specs sont à côté du code qu'elles couvrent, pas dans un
    // répertoire dédié : src/test/ ne contient que des utilitaires.
    files: ['**/*.spec.ts', 'src/test/**/*.ts'],
    languageOptions: {
      // jsdom fournit les globales du navigateur, vitest les siennes
      // (describe, it, expect, vi…) sans qu'on les importe.
      globals: { ...globals.browser, ...globals.node, ...globals.vitest },
    },
  },

  {
    files: ['vite.config.ts', 'tools/**/*.{mjs,js,ts}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
  },
)
