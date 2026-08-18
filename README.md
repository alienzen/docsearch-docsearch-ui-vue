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
| `= /admin-help`, `= /stats-help` | `/auth/check-access` | `docsearch-users` |
| `= /admin`, `= /admin.html` | `/auth/check-admin` | `docsearch-admins` |

Une SPA à point d'entrée unique (`try_files ... /index.html`) ferait
disparaître ce gardiennage : le HTML d'administration serait servi à tout
le monde et seule l'API refuserait les appels. D'où **sept entrées HTML
physiques** déclarées dans `vite.config.ts` (`index`, `help`, `chat`,
`stats`, `stats-help`, `admin`, `admin-help`), un `nginx.conf` repris
quasiment à l'identique de `docsearch-ui`, et un modèle d'accès inchangé.

⚠️ Corollaire : les fichiers statiques produits par Vite ne doivent
**jamais** se retrouver sous un préfixe proxifié (`/search`, `/admin`,
`/ask`, `/api/…`). `assetsDir` reste donc à `assets`.

## Commandes

```bash
npm install
npm run dev      # serveur Vite (proxy vers l'API)
npm run build    # vue-tsc -b && vite build — le typage doit passer
npm run test     # vitest run
npm run lint     # eslint — vert sur l'état actuel du dépôt
npm run lint:fix # corrige ce qui est sûr
```

Le linter est installé depuis le 2026-08-12 (`eslint.config.js`, configuration
« plate »). Il porte **des règles non typées** : `npm run build` lance déjà
`vue-tsc -b`, qui fait l'analyse de types pour de bon — la doubler dans ESLint
le ralentirait beaucoup pour redire la même chose. `eslint-plugin-vue` est au
niveau `flat/essential` : le niveau au-dessus ajoute `vue/html-indent` et
consorts, soit un reformatage complet des gabarits comme prix d'entrée, pour
zéro défaut corrigé. Le choix des règles est argumenté dans le fichier même.

Une règle a été ajoutée hors socle recommandé : **`no-script-url`**.
`src/pages/connexion/ConnexionPage.spec.ts` portait déjà un
`eslint-disable-next-line no-script-url`, écrit en prévision d'un linter, sur le
test qui vérifie justement qu'une URL `javascript:` est REFUSÉE. Activer la
règle rend cette annotation vraie.

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
| `src/composables/` | Raccourcis clavier, hauteur d'en-tête, en-tête réduit au défilement, NPS. |
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
- **Nouvelle dimension de recherche** : elle doit être ajoutée à
  `utils/permalien.ts` en même temps qu'au store, sinon elle disparaît
  silencieusement d'un lien partagé — le destinataire obtient une recherche
  voisine, sans que rien ne le signale. L'URL porte les critères
  **canoniques** (l'état d'après `parseAdvancedQuery`), jamais le texte tapé :
  `type:pdf` saisi à la main et la facette cochée sont le même état, et doivent
  donner le même lien. `stores/search.ts` est le seul à écrire l'URL (via
  `ecrireUrl`), `usePermalien` le seul à la lire.
- **Nouvelle clé de configuration** : une clé n'est persistée que si elle
  est déclarée aux **trois** endroits de `docsearch-api`
  (`DEFAULT_UI_CONFIG`, le modèle `UiConfigUpdate`, la chaîne
  `set_param`). Sinon le POST répond 200 sans rien enregistrer. Retirer
  une clé suppose en outre de la **purger de Redis** : `get_config()`
  fusionne le JSON stocké par-dessus les défauts, une clé disparue du
  code y survivrait.
- **Champ de source rendu autrement qu'en texte** (une adresse d'image en
  vignette, par exemple) : il faut l'**ajouter à `TECHNIQUES` dans
  `utils/extraFields.ts`**, sinon il s'affiche AUSSI en clair parmi les
  métadonnées — « Image : https://… » — sur la carte comme dans la fiche,
  qui rendent les mêmes champs par la même fonction. Et il n'y a pas de
  contournement côté administration : `card_fields`, qui permet de masquer
  un champ par un libellé vide, n'est calculé que pour les sources **SQL**
  (`/searchable-sources`) ; une source portée par un module reçoit
  toujours une table de libellés vide.
- **Repli de `DEFAULT_UI_CONFIG` (`stores/uiConfig.ts`)** : « tout
  activé », à une exception près, `search_time_enabled`, qui suit le
  défaut de l'API (`false`). La règle réelle n'est pas « tout à `true` »
  mais « le repli doit valoir le défaut de l'API » : sans quoi une
  fonctionnalité apparaîtrait précisément quand `/ui-config` n'a pas pu
  être lu. Une bascule qui ajoute un élément à l'écran démarre
  désactivée ; celles qui en masquent un préexistant démarrent activées.

## Identifiants des éléments d'interface

Règle de départage, en un mot : **un élément qui peut apparaître deux fois
dans la même page prend un `data-testid`, les autres prennent un `id`.**
Un `id` doit être unique dans le document — deux éléments qui le partagent
cassent en silence `label for` et `aria-controls`, qui ne désignent plus
que le premier.

- **Format** : kebab-case, en français, `zone-element`
  (`recherches-enregistrees-bouton`, `modale-suggestion`).
- **Éléments répétés** : `data-testid` stable et **non suffixé**
  (`data-testid="carte-resultat"` sur les vingt cartes), la clé métier
  restant portée par un `data-*` dédié quand il faut en viser une.
- **Ids suffixés déjà en place** — `select-${result.id}`, `ft-${ext}`,
  `ocr-${name}`, `facet-extensions-${bucket.key}`… : ils existent pour
  lier un `<label for>` à sa case, pas pour servir d'accroche. Les garder,
  ne pas s'en servir, leur ajouter un `data-testid` à côté.
- **Trois ids sont porteurs** et ne se renomment pas : `#main-content`
  (cible des `DsfrSkipLinks` **et** sélecteur dans `app.css`), `#facets`
  (lien d'évitement), `#navigation`.
- **Composants DSFR** : chacun a sa propre prop, et un `id` posé en
  attribut n'atterrit pas au même endroit — `DsfrModal` → `modal-id`,
  `DsfrSelect` → `select-id`, `DsfrHeader` → `searchbar-id`, `DsfrInput` →
  `id`. Sans valeur explicite, `vue-dsfr` **tire l'identifiant au sort**
  (`Math.random()`) : il change à chaque rendu.
- **Ne pas fabriquer d'identifiant avec `useId()`** : le jeton produit est
  opaque et dépend de l'ordre de montage. Passer l'identifiant en prop,
  comme `NavMenuItem`.
- **Panneaux repliables** : la prop `id` de `CollapsiblePanel` — et celle
  de `FacetSection`, qui avait le même défaut — sert à la fois de clé de
  pli dans le store et d'identifiant du `<details>`. Les deux rôles se
  confondent volontairement : une clé de pli non unique replierait déjà
  deux panneaux à la fois. **Ne pas renommer ces identifiants-là** : ils
  sont persistés en `localStorage` (`docsearch-stats-collapsed-panels`,
  préférences de facettes), et les renommer réinitialise en silence
  l'état replié de tous les utilisateurs.
- **Composant instancié plusieurs fois dans une page** (`StatsPager`,
  `StatsGroupCounts`, `NavMenuItem`) : identifiant passé en **prop** par
  l'appelant, d'où sont dérivés ceux des enfants (`${id}-suivant`). Ce
  n'est pas un élément de liste — c'est une commande distincte, qui
  mérite une identité propre plutôt qu'un `data-testid` commun aux trois.
  Exception : un composant **récursif** (`AdminTreeNode`) ne peut recevoir
  aucun identifiant dérivé, il n'a que des `data-*`.

Le garde-fou est `idsDupliques()` (`src/test/ids.ts`), appelé depuis la
spec de chaque page. **Il ne prouve quelque chose que si les réponses
bouchonnées comportent au moins deux entrées par liste** : avec une seule,
un `id` littéral posé dans un `v-for` ne se dédouble jamais et le contrôle
passe au vert sans rien vérifier.

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
avec le `nginx.conf` du dépôt. Unité `docsearch-ui-vue` de
`docsearch-infra` (mono-hôte et rôle `frontend`), port 8080. En
production, c'est ce conteneur que vise `upstream ui_backend` dans
`docsearch-infra/nginx/nginx.conf` — via son alias réseau `ui-vue`.

```bash
cd ../docsearch-infra
sudo ./manage.sh build ui
sudo systemctl restart docsearch-ui-vue
```

Pour naviguer au navigateur, il faut une session : ouvrir l'application
et se laisser rediriger vers `/connexion`. Le raccourci de recette reste
le proxy du port **8090**, qui injecte une identité fixe — il n'a d'effet
que si l'API tourne avec `TRUST_X_USER_HEADER=true` (voir
`docsearch-infra/HOWTO-simuler-utilisateur.md`). Sans session, toute page
redirige vers le formulaire et toute route d'API répond 401.

## Repli

L'interface historique (`docsearch-ui`) n'a plus d'unité systemd, et son
dépôt n'est plus cloné : il est archivé en bundle git à la racine
(`docsearch-ui-2026-08-10.bundle`). Un retour arrière n'est donc plus une
bascule d'amont — il faut d'abord restaurer le dépôt, puis construire et
lancer l'image à la main.

La procédure tient dans `docsearch-infra/README.md`, § Architecture
multi-dépôts, et n'est volontairement écrite qu'à cet endroit : elle vivait
jusqu'ici en trois copies qui ont divergé. Deux points en retenir, parce
qu'ils échouent en silence :

- la construction se fait avec `sudo`, sinon l'image atterrit dans un
  magasin rootless que les unités, root, ne voient pas ;
- l'amont `ui_backend` doit viser `docsearch-ui:80` et non le 8082, qui
  n'est publié que sur l'hôte. Après quoi **redémarrer** `docsearch-nginx` :
  Nginx résout ses amonts au démarrage et garde l'adresse.
