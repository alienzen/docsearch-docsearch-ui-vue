import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api } from '@/api/client'
import { versionCourte } from '@/version'

// Portage de docsearch-ui/public/js/config.js — les caches
// uiConfigCache / isAdminCache / currentUserCache et les sources
// cherchables. En vanilla, chaque chargement devait repousser lui-même
// les valeurs dans le DOM (updateAdminLinksVisibility,
// updateCurrentUserText...) et se rappeler mutuellement pour rester
// correct quel que soit l'ordre de résolution des appels parallèles.
// Ici les composants lisent des computed : l'ordre d'arrivée n'a plus
// d'importance, d'où la disparition de ces fonctions de resynchronisation.

/** Entrée de menu apportée par un module complémentaire. */
export type PluginNavEntry = {
  module: string
  libelle: string
  chemin: string
  icone: string | null
}

/** Bascules d'interface — voir docsearch-api/app/ui_config.py. */
export type UiConfig = {
  chat_enabled: boolean
  footer_enabled: boolean
  admin_links_enabled: boolean
  export_enabled: boolean
  help_enabled: boolean
  collections_enabled: boolean
  custom_keywords_enabled: boolean
  alerts_enabled: boolean
  /**
   * Entrée « Mes recherches récentes » : ses propres recherches, lues
   * dans le journal déjà écrit par l'API. Comme `search_time_enabled`,
   * démarre à `false` — elle ajoute un élément à l'écran.
   */
  search_history_enabled: boolean
  /** Suggestions sous la barre de recherche. Démarre à `false`, idem. */
  autocomplete_enabled: boolean
  /** « Vos derniers documents consultés » sur l'écran d'accueil. `false` par défaut. */
  recent_documents_enabled: boolean
  /** Partage d'une collection avec des groupes. `false` par défaut. */
  collections_shared_enabled: boolean
  sort_enabled: boolean
  /**
   * Temps de recherche affiché à côté du décompte de résultats, et
   * bouton qui permet à chacun de le masquer (voir
   * usePreferencesStore.showSearchTime, combiné en ET). N'influe que sur
   * l'affichage : la mesure et sa journalisation ont lieu côté API quoi
   * qu'il arrive.
   */
  search_time_enabled: boolean
  /**
   * Badge de pourcentage de pertinence sur les cartes de résultat.
   * `false` par défaut depuis le 2026-08-15. N'influe que sur son
   * affichage — le classement par pertinence reste le même.
   */
  score_enabled: boolean
  /**
   * Section « Droits d'accès » de la fiche détail, visible des
   * utilisateurs non administrateurs. Désactivée, elle reste visible des
   * seuls administrateurs.
   */
  acl_visible_enabled: boolean
  /** Lien « Raccourcis » de l'en-tête. La touche « ? » reste active. */
  shortcuts_link_enabled: boolean
  /** Animation d'accueil tant qu'aucune recherche n'a été lancée. */
  empty_state_animation_enabled: boolean
  /**
   * En-tête réduit au défilement : bloc-marque, logo opérateur et
   * baseline masqués, marges resserrées. Titre de service — donc lien
   * d'accueil —, barre de recherche, outils et navigation conservés.
   * Sans effet sous 62em, où le DSFR replie déjà l'en-tête. Un seul
   * drapeau pour la recherche, les statistiques et l'administration :
   * c'est une commodité de défilement, pas un choix d'affichage de
   * l'identité comme les bascules dédoublées par famille ci-dessous.
   */
  header_shrink_enabled: boolean
  show_current_user_enabled: boolean
  show_current_user_groups_enabled: boolean
  // Famille « administration » (admin.html, stats.html, admin-help.html)
  // — bascules distinctes de celles de la recherche : masquer le badge
  // utilisateur côté public ne doit pas le masquer côté admin, où il sert
  // à vérifier sous quelle identité on agit.
  footer_enabled_admin: boolean
  show_current_user_enabled_admin: boolean
  show_current_user_groups_enabled_admin: boolean
  /**
   * Texte du bloc-marque DSFR (.fr-logo), en-tête et pied de page. Une
   * ligne de saisie = une ligne affichée.
   */
  logo_text: string
  header_logo_text: string
  header_subtitle_text: string
  // `header_logo_url` (logo personnalisé dans l'en-tête) n'est
  // volontairement PAS repris : l'en-tête DSFR porte le bloc-marque
  // « République Française », auquel un second logo libre se substituait
  // mal. L'API renvoie toujours la clé — elle est simplement ignorée,
  // comme les anciennes valeurs de `theme`.
  favicon_url: string
  footer_text: string
  /** Mention tout en bas du pied de page. Vide = ligne masquée. */
  footer_bottom_text: string
  /**
   * Exemples de recherche de l'écran d'accueil, UN PAR LIGNE (voir
   * `searchExamples` plus bas, qui les découpe). Vide = aucun exemple
   * affiché.
   */
  search_examples: string
  /**
   * Recherche jouée d'office à l'ouverture de la page de recherche,
   * dans la syntaxe de la barre de recherche (opérateurs compris). Vide
   * = écran d'accueil habituel. Voir useRechercheParDefaut.
   */
  default_search: string
  sources_mount: string
  sources_mount_display: string
  /**
   * Entrées de menu déclarées par les modules complémentaires ACTIFS
   * (voir docsearch-api/app/plugin_ui_config.py). Servies par /ui-config
   * plutôt que par une route dédiée : une route de plus, c'est un
   * préfixe de plus à déclarer dans les deux nginx.conf ET dans
   * API_ROUTES.
   *
   * Le cœur ne rend JAMAIS de code venu d'un module : seulement un
   * libellé, un chemin sous /ext/<nom>/ et une classe d'icône DSFR, tous
   * trois validés à l'installation (docsearch_contract/interface.py).
   */
  plugin_nav: PluginNavEntry[]
  /** Liens posés sur chaque carte de résultat par les modules actifs. */
  plugin_actions: PluginNavEntry[]
  /** Écrans de module, encadrés par l'interface du produit (module.html). */
  plugin_pages: PluginNavEntry[]
  /**
   * Page de connexion — les trois éléments que charlie/app-front affiche
   * sous le formulaire (voir LoginView.vue), ici optionnels.
   *
   * Les deux liens sont des URL et non des bascules : DocSearch n'a ni
   * demande de compte ni réinitialisation de mot de passe, la destination
   * est donc forcément externe (intranet, portail d'annuaire) et c'est
   * l'administrateur qui la désigne. Vide = lien masqué.
   */
  login_inscription_url: string
  login_mot_de_passe_oublie_url: string
  /** Jalon ProConnect : bouton visible mais DÉSACTIVÉ, comme dans charlie. */
  login_proconnect_enabled: boolean
  /**
   * Apparence, réglée depuis l'administration. Le champ existait déjà,
   * mais portait l'un des 7 thèmes maison ('slate', 'red', 'dsfr'…) :
   * il ne peut désormais valoir que 'light', 'dark' ou 'system', le
   * reste de la palette n'ayant plus de sens en DSFR. Les valeurs
   * héritées sont ramenées à 'system' par normalizeScheme().
   */
  theme?: string
  /** Idem pour les pages d'administration. */
  theme_admin?: string
}

export type Scheme = 'light' | 'dark' | 'system'

/**
 * Ramène une valeur de thème à un scheme DSFR. Toute valeur inconnue —
 * dont les 7 thèmes maison encore stockés dans Redis — devient
 * 'system' : on suit alors la préférence du système d'exploitation,
 * qui est le comportement par défaut du DSFR.
 */
export function normalizeScheme(value: string | undefined): Scheme {
  return value === 'light' || value === 'dark' ? value : 'system'
}

/** Clé de cache, la même que celle lue par le script anti-flash des pages. */
const SCHEME_CACHE_KEY = 'vue-dsfr-scheme'

/**
 * Repli si /ui-config échoue. Règle unique : le repli vaut le défaut de
 * l'API (voir ui_config.py), sinon une fonctionnalité apparaîtrait
 * précisément quand la configuration n'a pas pu être lue. Le repli
 * historique « tout activé » ne tenait plus depuis que plusieurs
 * bascules démarrent éteintes côté API.
 */
const DEFAULT_UI_CONFIG: UiConfig = {
  chat_enabled: false,
  footer_enabled: true,
  admin_links_enabled: false,
  export_enabled: false,
  help_enabled: true,
  collections_enabled: true,
  custom_keywords_enabled: true,
  alerts_enabled: false,
  search_history_enabled: false,
  autocomplete_enabled: false,
  recent_documents_enabled: false,
  collections_shared_enabled: false,
  sort_enabled: false,
  search_time_enabled: false,
  score_enabled: false,
  acl_visible_enabled: false,
  shortcuts_link_enabled: true,
  empty_state_animation_enabled: true,
  // Repli à false, comme search_time_enabled : ce drapeau AJOUTE un
  // comportement sur l'écran de tous, il ne masque pas un existant (la
  // règle est écrite dans ui_config.py). Il démarre donc éteint côté
  // API, et le repli le suit — sans quoi l'en-tête se mettrait à bouger
  // précisément quand /ui-config n'a pas pu être lu.
  header_shrink_enabled: false,
  show_current_user_enabled: true,
  show_current_user_groups_enabled: true,
  footer_enabled_admin: true,
  show_current_user_enabled_admin: true,
  show_current_user_groups_enabled_admin: true,
  logo_text: 'République\nFrançaise',
  header_logo_text: '',
  header_subtitle_text: '',
  favicon_url: '',
  footer_text: '',
  footer_bottom_text: '',
  // Repli identique au défaut de l'API (ui_config.py) : une /ui-config
  // injoignable ne doit pas vider l'écran d'accueil de ses exemples.
  search_examples:
    'auteur:Dupont budget\ntype:pdf marché public\n"délégation de service"\nsource:RH congés 2025',
  // Repli VIDE, et pas seulement par prudence : jouer une recherche
  // d'office est une décision d'administrateur, qu'une /ui-config
  // injoignable ne permet justement pas de connaître.
  default_search: '',
  sources_mount: '/sources',
  sources_mount_display: '',
  // Repli VIDE : une installation sans module, ou une API injoignable,
  // n'affiche aucune entrée plutôt qu'une entrée périmée qui mènerait à
  // un 502.
  plugin_nav: [],
  plugin_actions: [],
  plugin_pages: [],
  // Exception au « tout activé » ci-dessus, et c'est voulu : si
  // /ui-config échoue, l'écran de connexion doit rester le formulaire
  // seul. Un repli qui afficherait des liens sans URL ou un jalon
  // ProConnect inventerait des éléments que l'installation n'a peut-être
  // jamais configurés.
  login_inscription_url: '',
  login_mot_de_passe_oublie_url: '',
  login_proconnect_enabled: false,
}

/**
 * Suspension des signaux de satisfaction depuis l'admin. Repli sur
 * `false` (et non `true` comme UiConfig) : mieux vaut ne pas solliciter
 * l'utilisateur si on ne sait pas, alors qu'une bascule d'interface
 * inconnue doit laisser la fonctionnalité accessible. Le tracking de
 * clic n'a pas d'équivalent ici : toujours actif.
 */
export type EngagementConfig = {
  feedback_enabled: boolean
  nps_enabled: boolean
  suggestions_enabled: boolean
}

export type SearchableSource = {
  name: string
  label: string
  type?: string
  collectable?: boolean
  /**
   * Libellés des colonnes d'une source SQL dans la carte de résultat.
   * Trois états, voir `card_label` dans sql_sources_config.py :
   * `null` = libellé à dériver du nom, `''` = champ masqué, texte = ce
   * libellé.
   */
  card_fields?: Record<string, string | null>
}

export const useUiConfigStore = defineStore('uiConfig', () => {
  const config = ref<UiConfig>({ ...DEFAULT_UI_CONFIG })
  const engagement = ref<EngagementConfig>({
    feedback_enabled: false,
    nps_enabled: false,
    suggestions_enabled: false,
  })
  const isAdmin = ref(false)
  const currentUser = ref<{ user: string | null; groups: string[] }>({ user: null, groups: [] })
  const allSources = ref<SearchableSource[]>([])
  /** {opérateur en minuscules: champ ES} pour la syntaxe avancée. */
  const customFacetOperators = ref<Record<string, string>>({})
  /** {champ ES: libellé} des facettes personnalisées connues. */
  const customFacetLabels = ref<Record<string, string>>({})

  /**
   * Liens Administration/Statistiques : il faut être admin ET que le
   * flag soit actif — un ET logique entre deux sources chargées en
   * parallèle. Même un utilisateur autorisé ne doit plus les voir si
   * l'admin a désactivé le flag (ex: maintenance des pages admin).
   */
  const showAdminLinks = computed(() => isAdmin.value && config.value.admin_links_enabled)

  /**
   * Badge « Connecté : … ». Le suffixe des groupes est masquable
   * séparément du badge lui-même. `family` choisit le jeu de bascules :
   * les pages d'administration ont les leurs.
   */
  function userLabel(family: 'search' | 'admin') {
    const enabled =
      family === 'admin'
        ? config.value.show_current_user_enabled_admin
        : config.value.show_current_user_enabled
    const withGroups =
      family === 'admin'
        ? config.value.show_current_user_groups_enabled_admin
        : config.value.show_current_user_groups_enabled
    if (!enabled || !currentUser.value.user) return ''
    const groups = currentUser.value.groups
    const suffix = withGroups && groups.length ? ` · ${groups.join(', ')}` : ''
    return `Connecté : ${currentUser.value.user}${suffix}`
  }

  const currentUserLabel = computed(() => userLabel('search'))
  const currentUserLabelAdmin = computed(() => userLabel('admin'))

  /**
   * Lignes du bloc-marque. DsfrLogo rend chaque élément du tableau sur
   * sa propre ligne : on découpe donc le réglage sur les retours à la
   * ligne, l'administrateur saisissant « République⏎Française » pour
   * obtenir deux lignes.
   */
  const logoText = computed(() =>
    (config.value.logo_text || 'République\nFrançaise')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean),
  )

  const headerTitle = computed(() => config.value.header_logo_text || 'DocSearch')
  const headerSubtitle = computed(
    () => config.value.header_subtitle_text || 'Explorez, trouvez, comprenez',
  )
  const footerText = computed(
    () => config.value.footer_text || 'DocSearch — Explorez, trouvez, comprenez',
  )

  /**
   * Mention tout en bas du pied de page, suffixée de la version du
   * produit — présente sur les cinq pages qui affichent un pied de page.
   *
   * Suffixée plutôt qu'ajoutée en élément distinct : DsfrFooter ne
   * propose, sous les liens obligatoires, qu'une ligne de licence, et un
   * second réglage « afficher la version » se serait retrouvé en
   * concurrence avec `footer_bottom_text` que l'administrateur édite
   * déjà. Le séparateur n'apparaît que si le texte configuré n'est pas
   * vide, la ligne restant sinon masquée par DsfrFooter.
   *
   * Le pied de page étant désactivable (`footer_enabled`), il ne peut
   * pas être le seul endroit où lire la version : l'aide la porte aussi,
   * en toutes lettres (voir SearchHelp.vue).
   */
  const footerBottomText = computed(() =>
    [config.value.footer_bottom_text, versionCourte].filter(Boolean).join(' · '),
  )

  /**
   * Exemples de recherche de l'écran d'accueil, un par ligne dans le
   * réglage (voir `search_examples`). Les lignes vides sont écartées :
   * un retour à la ligne en trop dans la zone de saisie de
   * l'administration ne doit pas produire un exemple vide, cliquable et
   * qui lancerait une recherche sans texte.
   *
   * Liste vide (réglage vidé) = le bloc d'exemples disparaît de l'écran
   * d'accueil, ce qui est la façon prévue de les retirer.
   */
  const searchExamples = computed(() =>
    config.value.search_examples
      .split('\n')
      .map((exemple) => exemple.trim())
      .filter(Boolean),
  )

  /**
   * Libellé d'affichage d'une source à partir de son nom (clé de
   * registre) — repli sur le nom brut si elle n'est pas (encore) connue.
   */
  function sourceLabel(name: string) {
    return allSources.value.find((s) => s.name === name)?.label ?? name
  }

  /**
   * Une source inconnue est traitée comme collectable : on ne masque la
   * case à cocher que si on SAIT qu'elle l'interdit, jamais par défaut
   * sur une donnée manquante. Même repli tolérant que sourceLabel().
   */
  /** Libellés de carte d'une source, ou {} si elle n'en déclare pas. */
  function sourceCardFields(name: string): Record<string, string | null> {
    return allSources.value.find((s) => s.name === name)?.card_fields || {}
  }

  /**
   * Type d'une source — `file`, `sql`, `web` ou `plugin` —, ou `null`
   * tant que la liste n'est pas chargée. Sert à savoir si un document a
   * un FICHIER derrière lui : seules les sources fichiers en ont un.
   */
  function sourceType(name: string): string | null {
    return allSources.value.find((s) => s.name === name)?.type ?? null
  }

  function sourceCollectable(name: string) {
    const found = allSources.value.find((s) => s.name === name)
    return found ? found.collectable !== false : true
  }

  // Tous les chargements échouent en silence : API indisponible = repli
  // sur les valeurs par défaut, la recherche elle-même n'est pas affectée.

  async function loadUiConfig() {
    try {
      config.value = { ...DEFAULT_UI_CONFIG, ...(await api<Partial<UiConfig>>('/ui-config')) }
    } catch {
      /* repli sur les valeurs par défaut */
    }
    // Favicon personnalisable depuis l'admin — commun à toutes les
    // pages. Le TITRE de l'onglet, lui, n'est pas posé ici : il est
    // propre à chaque page (« Statistiques de recherche », « Assistant
    // IA »…), et l'écraser avec celui de la recherche renommait tous les
    // onglets « DocSearch — Explorez, trouvez, comprenez ». La page de
    // recherche l'applique elle-même, voir applySearchTitle().
    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (favicon) favicon.href = config.value.favicon_url || '/favicon.svg'
  }

  async function loadEngagementConfig() {
    try {
      engagement.value = await api<EngagementConfig>('/engagement-config')
    } catch {
      /* pouce/NPS/suggestions restent masqués */
    }
  }

  async function loadIsAdmin() {
    try {
      // /is-admin ne lève jamais d'erreur d'autorisation (contrairement
      // à un vrai appel /admin/*), il est fait pour être interrogé par
      // n'importe quel utilisateur.
      // `user` vaut null pour un visiteur sans session : /is-admin est
      // publique et répond « non » plutôt que 401.
      const res = await api<{ is_admin: boolean; user: string | null; groups?: string[] }>('/is-admin')
      isAdmin.value = res.is_admin
      currentUser.value = { user: res.user, groups: res.groups || [] }
    } catch {
      /* liens admin masqués par défaut */
    }
  }

  async function loadSearchableSources() {
    try {
      allSources.value = await api<SearchableSource[]>('/searchable-sources')
    } catch {
      /* présélection vide ; la recherche fédérée continue de fonctionner */
    }
  }

  async function loadCustomFacets() {
    try {
      const fields = await api<Record<string, string>>('/custom-facets')
      const operators: Record<string, string> = {}
      for (const field of Object.keys(fields)) operators[field.toLowerCase()] = field
      customFacetOperators.value = operators
      // Pré-remplit les libellés pour que la toute première puce, avant
      // toute recherche, affiche déjà « Bureau : Paris » plutôt que le
      // nom de champ ES brut — sans écraser un libellé déjà posé par une
      // recherche entre-temps (ces appels partent en parallèle).
      for (const [field, label] of Object.entries(fields)) {
        if (!(field in customFacetLabels.value)) customFacetLabels.value[field] = label
      }
    } catch {
      /* la syntaxe avancée reconnaît moins d'opérateurs ; les facettes
         cliquées depuis la sidebar continuent de fonctionner */
    }
  }

  /**
   * Titre de l'onglet de la page de RECHERCHE, dont le nom et le
   * sous-titre sont personnalisables depuis l'administration. Les autres
   * pages gardent le titre écrit dans leur fichier HTML.
   */
  function applySearchTitle() {
    document.title = `${headerTitle.value} — ${headerSubtitle.value}`
  }

  /**
   * Applique l'apparence réglée en administration et la met en cache.
   *
   * Le cache reproduit le mécanisme de docsearch-ui : le script inline
   * en tête de chaque page le lit AVANT le premier rendu, ce qui évite
   * d'afficher brièvement le thème clair le temps que /ui-config
   * réponde. C'est pourquoi il utilise la même clé que useScheme.
   *
   * @param family les pages d'administration ont leur propre réglage
   */
  function applyScheme(family: 'search' | 'admin') {
    const scheme = normalizeScheme(
      family === 'admin' ? config.value.theme_admin : config.value.theme,
    )
    const dark =
      scheme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
        : scheme === 'dark'
    document.documentElement.setAttribute('data-fr-theme', dark ? 'dark' : 'light')
    try {
      localStorage.setItem(SCHEME_CACHE_KEY, scheme)
    } catch {
      /* stockage indisponible : simple flash possible au prochain chargement */
    }
  }

  /** Tout ce qui est chargé au démarrage de la page de recherche. */
  function loadAll() {
    return Promise.all([
      loadUiConfig().then(() => {
        applySearchTitle()
        applyScheme('search')
      }),
      loadEngagementConfig(),
      loadIsAdmin(),
      loadSearchableSources(),
      loadCustomFacets(),
    ])
  }

  return {
    config,
    engagement,
    isAdmin,
    currentUser,
    allSources,
    customFacetOperators,
    customFacetLabels,
    showAdminLinks,
    currentUserLabel,
    currentUserLabelAdmin,
    logoText,
    headerTitle,
    headerSubtitle,
    footerText,
    footerBottomText,
    searchExamples,
    sourceLabel,
    sourceCardFields,
    sourceType,
    sourceCollectable,
    loadUiConfig,
    loadEngagementConfig,
    loadIsAdmin,
    loadSearchableSources,
    loadCustomFacets,
    applySearchTitle,
    applyScheme,
    loadAll,
  }
})
