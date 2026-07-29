import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api } from '@/api/client'

// Portage de docsearch-ui/public/js/config.js — les caches
// uiConfigCache / isAdminCache / currentUserCache et les sources
// cherchables. En vanilla, chaque chargement devait repousser lui-même
// les valeurs dans le DOM (updateAdminLinksVisibility,
// updateCurrentUserText...) et se rappeler mutuellement pour rester
// correct quel que soit l'ordre de résolution des appels parallèles.
// Ici les composants lisent des computed : l'ordre d'arrivée n'a plus
// d'importance, d'où la disparition de ces fonctions de resynchronisation.

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
  sort_enabled: boolean
  show_current_user_enabled: boolean
  show_current_user_groups_enabled: boolean
  // Famille « administration » (admin.html, stats.html, admin-help.html)
  // — bascules distinctes de celles de la recherche : masquer le badge
  // utilisateur côté public ne doit pas le masquer côté admin, où il sert
  // à vérifier sous quelle identité on agit.
  footer_enabled_admin: boolean
  show_current_user_enabled_admin: boolean
  show_current_user_groups_enabled_admin: boolean
  header_logo_url: string
  header_logo_text: string
  header_subtitle_text: string
  favicon_url: string
  footer_text: string
  sources_mount: string
  sources_mount_display: string
  /**
   * Ancien sélecteur de thème (7 thèmes maison). Conservé dans le type
   * parce que l'API le renvoie toujours tant qu'admin.html n'est pas
   * migré, mais volontairement IGNORÉ ici : l'apparence est désormais
   * celle du DSFR, en clair ou sombre (voir useScheme).
   */
  theme?: string
}

/** Repli si /ui-config échoue : tout activé, comme en vanilla. */
const DEFAULT_UI_CONFIG: UiConfig = {
  chat_enabled: true,
  footer_enabled: true,
  admin_links_enabled: true,
  export_enabled: true,
  help_enabled: true,
  collections_enabled: true,
  custom_keywords_enabled: true,
  alerts_enabled: true,
  sort_enabled: true,
  show_current_user_enabled: true,
  show_current_user_groups_enabled: true,
  footer_enabled_admin: true,
  show_current_user_enabled_admin: true,
  show_current_user_groups_enabled_admin: true,
  header_logo_url: '',
  header_logo_text: '',
  header_subtitle_text: '',
  favicon_url: '',
  footer_text: '',
  sources_mount: '/sources',
  sources_mount_display: '',
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

  const headerTitle = computed(() => config.value.header_logo_text || 'DocSearch')
  const headerSubtitle = computed(
    () => config.value.header_subtitle_text || 'Explorez, trouvez, comprenez',
  )
  const footerText = computed(
    () => config.value.footer_text || 'DocSearch — Explorez, trouvez, comprenez',
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
      const res = await api<{ is_admin: boolean; user: string; groups?: string[] }>('/is-admin')
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

  /** Tout ce qui est chargé au démarrage de la page de recherche. */
  function loadAll() {
    return Promise.all([
      loadUiConfig().then(applySearchTitle),
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
    headerTitle,
    headerSubtitle,
    footerText,
    sourceLabel,
    sourceCollectable,
    loadUiConfig,
    loadEngagementConfig,
    loadIsAdmin,
    loadSearchableSources,
    loadCustomFacets,
    applySearchTitle,
    loadAll,
  }
})
