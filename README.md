# docsearch-ui-vue

Interface de DocSearch en **Vue 3 + [@gouvminint/vue-dsfr]**, conforme au
Système de Design de l'État (DSFR). Reprend les fonctionnalités de
`docsearch-ui` (HTML/JS sans build) sans en reprendre le code.

**Interface en service**, sur le port **8080**. Elle remplace
`docsearch-ui` (HTML/JS sans build), dont le dépôt est conservé pour
référence mais n'est plus déployé — il reste mobilisable en repli le temps
que la bascule soit éprouvée (voir « Repli » plus bas).

[@gouvminint/vue-dsfr]: https://vue-dsfr.netlify.app/

## Pourquoi un build multi-pages et non une SPA

C'est la contrainte structurante du projet, et elle prime sur le confort
de développement.

`nginx.conf` protège **chaque page avant de servir le HTML**, via des
sous-requêtes `auth_request` vers l'API (seule à interroger LDAP) :

| Emplacement | Contrôle | Groupe exigé |
|---|---|---|
| `/`, `= /help`, `= /chat` | `/auth/check-access` | `docsearch-users` |
| `= /admin`, `= /admin.html` | `/auth/check-admin` | `docsearch-admins` |

Une SPA à point d'entrée unique (`try_files ... /index.html`) ferait
disparaître ce gardiennage : le HTML d'administration serait servi à tout
le monde et seule l'API refuserait les appels. D'où **six entrées HTML
physiques** déclarées dans `vite.config.ts` (`index`, `help`, `chat`,
`stats`, `admin`, `admin-help`), un `nginx.conf` repris quasiment à
l'identique de `docsearch-ui`, et un modèle d'accès inchangé.

⚠️ Corollaire : les fichiers statiques produits par Vite ne doivent
**jamais** se retrouver sous un préfixe proxifié (`/search`, `/admin`,
`/ask`, `/api/…`). `assetsDir` reste donc à `assets`.

## Commandes

```bash
npm install
npm run dev      # serveur Vite (proxy vers l'API, X-User simulé)
npm run build    # vue-tsc -b && vite build — le typage doit passer
npm run test     # vitest run
```

## Vérifier la migration soi-même

Trois contrôles rejouables :

```bash
./tools/verifier-acces.sh      # 8 chemins × 3 identités, contre une matrice attendue
./tools/comparer-recherche.sh  # 9 jeux de critères : le proxy achemine-t-il ?
npm run test:parseur           # syntaxe avancée : Vue vs implémentation vanilla
```

`verifier-acces.sh` est le plus important : il confronte les codes HTTP de
huit chemins, pour `alice.admin`, `bob.user` et sans en-tête, à une matrice
attendue. Le cas qui justifie toute l'architecture est `bob.user` sur
`/admin.html` → **401**.

Il comparait auparavant les deux interfaces tournant en parallèle. Une
matrice absolue vaut mieux : une comparaison ne décèle rien quand les deux
côtés se trompent de la même façon.

## Organisation

| Dossier | Contenu |
|---|---|
| `src/api/` | Client typé, un module par domaine. `search.ts` porte le **parseur de syntaxe avancée**, la pièce la plus délicate — couverte par des tests. |
| `src/stores/` | Pinia : `search` (critères, résultats), `uiConfig` (bascules d'administration), `preferences` (réglages locaux persistés), `selection`. |
| `src/components/` | Composants partagés, auto-importés (voir `components.d.ts`). |
| `src/pages/` | Une page = une entrée du build. |
| `src/composables/` | Raccourcis clavier, hauteur d'en-tête, NPS. |
| `src/assets/app.css` | **Le strict complément à DSFR.** S'il regrossit, c'est qu'on réimplémente à la main ce que les classes `fr-*` savent déjà faire. |

## Conventions et pièges rencontrés

À lire avant d'ajouter du CSS ou un composant — chacun de ces points a
coûté une séance de débogage.

- **Icônes** : importer les familles DSFR une par une dans `src/dsfr.ts`,
  jamais `utility.main.css` (1,4 Mo de SVG en ligne). Pour une icône
  isolée, inliner sa règle dans `app.css` : importer une famille entière
  pour une seule icône a fait passer la feuille de 947 ko à 1215 ko.
  `@iconify/vue` est aliasé vers sa version *offline* — sinon les icônes
  sont téléchargées depuis `api.iconify.design` à l'exécution.
- **Spécificité DSFR** : plusieurs règles utilisent deux classes
  (`.fr-header__tools .fr-header__search`, `.fr-menu .fr-nav__link`). Une
  surcharge à une seule classe ne passera pas ; il faut égaler la
  spécificité.
- **Modales dans un menu déroulant** : les téléporter (`<Teleport to="body">`).
  À l'intérieur, elles héritent du `visibility: hidden` que le DSFR
  applique à un `.fr-collapse` replié.
- **`RouterLinkShim`** : `vue-dsfr` émet un `RouterLink` pour tout lien
  interne. Sans routeur, il faut l'enregistrer globalement, sinon rien ne
  se rend.
- **Animations décoratives** : tout doit rester lisible **à l'arrêt**, le
  mouvement seul étant animé. Une illustration qui naît transparente et
  ne doit sa visibilité qu'à son animation disparaît complètement sous
  `prefers-reduced-motion: reduce`, que l'interface respecte sans
  échappatoire.
- **Nouvelle clé de configuration** : une clé n'est persistée que si elle
  est déclarée aux **trois** endroits de `docsearch-api`
  (`DEFAULT_UI_CONFIG`, le modèle `UiConfigUpdate`, la chaîne
  `set_param`). Sinon le POST répond 200 sans rien enregistrer. Retirer
  une clé suppose en outre de la **purger de Redis** : `get_config()`
  fusionne le JSON stocké par-dessus les défauts, une clé disparue du
  code y survivrait.

## Écarts assumés avec `docsearch-ui`

- **Thèmes** : les 7 thèmes maison (Ardoise, Rouge, Vert, Contraste
  élevé…) sont abandonnés au profit du clair/sombre/système du DSFR. Une
  valeur héritée encore stockée en base est ramenée à « Système ».
- **Gabarits d'affichage des résultats** : fonctionnalité retirée du
  produit, non portée.
- **Aide** : le contenu vivait en double (`help.html` et la modale
  d'`init.js`), les deux copies ayant divergé. Il est désormais unique
  (`SearchHelp.vue`), partagé par la page `/help`.

## Déploiement

Image multi-étages (`Dockerfile`) : build Node, puis Nginx servant `dist/`
avec le `nginx.conf` du dépôt. Service `ui-vue` du `docker-compose.yml` de
`docsearch-infra`, profils `dev` et `production`, port 8080. En production,
c'est ce service que vise `upstream ui_backend` dans
`docsearch-infra/nginx/nginx.conf`.

```bash
cd ../docsearch-infra && docker compose --profile dev up -d --build ui-vue
```

Pour naviguer au navigateur, l'API exige l'en-tête `X-User` : passer par
le proxy de test sur le port **8090** (voir
`docsearch-infra/HOWTO-simuler-utilisateur.md`). Le port 8080 en direct
renvoie 401.

## Repli

L'interface historique reste déclarée sous le profil `legacy`, le temps que
la bascule soit éprouvée :

```bash
cd ../docsearch-infra
docker compose --profile legacy up -d ui          # → port 8082
docker compose -f docker-compose.dev-user-proxy.yml --profile legacy up -d
```

Pour un retour arrière en production, repointer `upstream ui_backend` sur
`ui:80` puis **redémarrer** `docsearch-nginx` — Nginx résout ses amonts au
démarrage et garde l'adresse.
