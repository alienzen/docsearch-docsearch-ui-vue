<script setup lang="ts">
/**
 * Page de recherche — portage de docsearch-ui/public/index.html.
 *
 * Tout ce que init.js faisait au chargement (appels de démarrage,
 * raccourcis clavier, fermeture des panneaux au clic extérieur) tient
 * ici ou dans un composable ; les ~40 handlers `onclick="..."` du HTML
 * d'origine sont devenus des `@click`.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { createSavedSearch } from '@/api/savedSearches'
import { hasActiveCriteria } from '@/api/search'
import { useSearchStore } from '@/stores/search'
import { useUiConfigStore } from '@/stores/uiConfig'
import { usePreferencesStore } from '@/stores/preferences'
import { useSearchShortcuts } from '@/composables/useSearchShortcuts'
import { useNps } from '@/composables/useNps'
import { useHeaderHeight } from '@/composables/useHeaderHeight'
import { useHeaderReduit } from '@/composables/useHeaderReduit'
import { useAutocompleteOff } from '@/composables/useAutocompleteOff'
import { useDialogs } from '@/composables/useDialogs'
import { usePermalien } from '@/composables/usePermalien'

const store = useSearchStore()
const uiConfig = useUiConfigStore()
const preferences = usePreferencesStore()
const { prompt } = useDialogs()

const quickLinks = computed(() => {
  const links: {
    label: string
    to?: string
    class?: string
    button?: boolean
    target?: string
    rel?: string
    title?: string
    'aria-keyshortcuts'?: string
    onClick?: () => void
  }[] = []

  // Dans l'en-tête et non dans la barre d'outils des résultats : celle-ci
  // n'apparaît qu'une fois une recherche lancée, alors que c'est
  // justement l'arrivant — qui n'a encore rien cherché — qu'il s'agit
  // d'informer de l'existence des raccourcis.
  //
  // La bascule ne masque QUE ce point d'entrée : la touche « ? » et tous
  // les raccourcis restent actifs, comme l'indique le libellé de la case
  // côté administration.
  if (uiConfig.config.shortcuts_link_enabled) {
    links.push({
      label: 'Raccourcis',
      button: true,
      class: 'fr-link--icon-left fr-icon-keyboard-line',
      title: 'Raccourcis clavier (?)',
      'aria-keyshortcuts': '?',
      onClick: toggleShortcuts,
    })
  }

  if (uiConfig.config.help_enabled) {
    // Nouvel onglet : l'aide se consulte EN REGARD des résultats, sans
    // quitter la recherche en cours ni avoir à la relancer au retour.
    // `rel="noopener"` par principe, la page ouverte n'ayant aucun
    // besoin d'accéder à celle-ci ; `title` signale la nouvelle fenêtre,
    // ce que le RGAA impose et qu'une icône ne suffit pas à porter.
    links.push({
      label: 'Aide',
      to: '/help',
      target: '_blank',
      rel: 'noopener',
      title: 'Aide — nouvelle fenêtre',
      class: 'fr-link--icon-left fr-icon-question-line',
    })
  }
  if (uiConfig.engagement.suggestions_enabled) {
    // `onClick` sans `to` : vue-dsfr rend alors un bouton, ce qui
    // convient à une action qui ouvre une modale plutôt qu'à un lien.
    links.push({
      label: 'Suggérer une idée',
      button: true,
      class: 'fr-icon-lightbulb-line fr-link--icon-left',
      onClick: () => (suggestionOpen.value = true),
    })
  }
  // Ni le badge « Connecté : … », ni « Se déconnecter », ni les deux
  // liens d'administration ne sont ici : ils vivent dans HeaderUserMenu,
  // posé après ces liens.
  return links
})

/**
 * Liens versés dans le menu du compte plutôt que déployés dans les outils
 * de l'en-tête, où ils tenaient deux entrées de plus. Ils s'adressent aux
 * seuls administrateurs, comme la déconnexion aux seuls connectés : le
 * menu est déjà le bon endroit pour ce qui dépend de qui l'on est.
 *
 * Les deux sont gouvernés par la même bascule et le même groupe LDAP,
 * comme dans docsearch-ui (admin-link et footer-stats-link).
 */
const adminLinks = computed(() =>
  uiConfig.showAdminLinks
    ? [
        { label: 'Statistiques', href: '/stats.html', icon: 'fr-icon-bar-chart-line' },
        { label: 'Administration', href: '/admin.html', icon: 'fr-icon-settings-5-line' },
      ]
    : [],
)

// ── Raccourcis clavier ──────────────────────────────────────
/** Palette ouverte par la touche « ? » ou par la barre d'outils. */
const shortcutsOpen = ref(false)

function toggleShortcuts() {
  shortcutsOpen.value = !shortcutsOpen.value
}

/**
 * La colonne de facettes n'est rendue qu'une fois une recherche lancée,
 * et si l'utilisateur ne l'a pas repliée depuis la barre d'outils.
 */
const facetsVisible = computed(() => store.hasSearched && !preferences.facetsHidden)

/**
 * Le lien d'évitement vers les filtres suit exactement la présence de la
 * colonne : proposé alors qu'elle est repliée, il pointerait vers une
 * ancre inexistante.
 */
const skipLinks = computed(() => {
  const links = [{ id: '#main-content', text: 'Aller au contenu' }]
  if (facetsVisible.value) links.push({ id: '#facets', text: 'Aller aux filtres' })
  return links
})

/**
 * Conteneur de la barre de recherche dans l'en-tête, rendu par
 * DsfrHeader. Celui-ci n'expose aucun slot dans .fr-header__search (à la
 * différence de .fr-header__tools-links, où débouchent `before-` et
 * `after-quick-links`) : pour placer la présélection de sources et la
 * remise à zéro À CÔTÉ de la barre, on y téléporte ces commandes une
 * fois l'en-tête monté.
 */
const headerSearch = ref<Element | null>(null)

// ── Fiche détail ────────────────────────────────────────────
const detailId = ref<string | null>(null)

// ── Collections ─────────────────────────────────────────────
const collectionsPanel = ref<{ openAdd: () => void } | null>(null)

/**
 * L'entrée « Mes recherches » est masquée tant qu'il n'y en a aucune :
 * après un enregistrement, il faut donc recharger sa liste pour qu'elle
 * apparaisse, sans attendre un rechargement de page.
 */
const savedSearchesPanel = ref<{ reload: () => void } | null>(null)

// ── Satisfaction ────────────────────────────────────────────
const { visible: npsVisible, maybeShow } = useNps(() => uiConfig.engagement.nps_enabled)
const suggestionOpen = ref(false)

// La popup NPS se déclenche sur une recherche RÉUSSIE : searchId n'est
// renseigné que dans ce cas, ce qui reproduit l'appel de maybeShowNps()
// en fin de doSearch() sans avoir à instrumenter le store.
watch(
  () => store.searchId,
  (id) => {
    if (id) maybeShow()
  },
)

// ── Enregistrement de la recherche courante ─────────────────
const saveError = ref<string | null>(null)

async function saveCurrentSearch() {
  if (!hasActiveCriteria(store.currentCriteria())) {
    saveError.value = "Lancez une recherche avant de l'enregistrer."
    return
  }
  const name = await prompt(
    'Nom de cette recherche :',
    store.query || 'Recherche sans titre',
    {
      title: 'Enregistrer la recherche',
      validate: (v) => (v ? null : 'Donnez un nom à cette recherche.'),
    },
  )
  if (name === null) return
  saveError.value = null
  try {
    await createSavedSearch(store.savedSearchPayload(name))
    savedSearchesPanel.value?.reload()
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : String(e)
  }
}

useSearchShortcuts({ saveCurrentSearch, toggleShortcuts })
// L'en-tête est collant : sa hauteur décale la colonne de facettes.
useHeaderHeight()
// Et il se replie au défilement, si l'administrateur l'a demandé. Le
// décalage ci-dessus suit tout seul : c'est le même ResizeObserver qui
// mesure l'en-tête réduit.
useHeaderReduit(() => uiConfig.config.header_shrink_enabled)
// Les deux barres de recherche de l'en-tête — bureau et modal mobile —
// ne doivent pas ouvrir la liste de saisies du navigateur par-dessus nos
// suggestions.
useAutocompleteOff()
// Ouverture depuis un lien partagé, un signet ou un rechargement, et
// retour arrière du navigateur. L'écriture de l'URL, elle, se fait dans
// le store à chaque recherche.
usePermalien()

onMounted(() => {
  headerSearch.value = document.querySelector('.fr-header__search')
  uiConfig.loadAll()
})
</script>

<template>
  <DsfrSkipLinks :links="skipLinks" />

  <!-- `show-search` place la barre de recherche dans .fr-header__tools,
       où le DSFR l'attend (voir le site du Système de Design). C'est
       DsfrHeader qui rend le balisage : inutile de le reproduire. -->
  <DsfrHeader
    v-model="store.query"
    :service-title="uiConfig.headerTitle"
    :service-description="uiConfig.headerSubtitle"
    :logo-text="uiConfig.logoText"
    home-to="/"
    operator-img-src="/logo-docsearch.svg"
    operator-img-alt="DocSearch"
    operator-img-style="max-width: 2.5rem"
    :quick-links="quickLinks"
    show-search
    searchbar-id="recherche"
    search-label="Rechercher un document"
    :placeholder="uiConfig.headerSubtitle"
    @search="store.searchFromFirstPage('empiler')"
  >
    <!-- Après les liens rapides : le menu du compte se place ainsi tout à
         droite des outils d'en-tête, à l'écart des liens d'action. -->
    <template #after-quick-links>
      <HeaderUserMenu family="search" :links="adminLinks" />
    </template>

    <!-- Slot `mainnav` : la barre de navigation du DSFR, dans le
         <header> lui-même. Les panneaux déroulants (recherches
         enregistrées, collections, alertes) s'ouvrent donc depuis
         l'en-tête, comme dans docsearch-ui. -->
    <template #mainnav>
      <nav id="navigation" class="fr-nav" role="navigation" aria-label="Navigation secondaire">
        <ul class="fr-nav__list">
          <!-- Rien à enregistrer tant qu'aucune recherche n'a été
               lancée : même condition que la colonne de facettes. Le
               garde-fou de saveCurrentSearch() reste en place, l'entrée
               pouvant redevenir visible entre-temps. -->
          <li v-if="store.hasSearched" class="fr-nav__item">
            <button
              id="recherche-enregistrer"
              class="fr-nav__link"
              type="button"
              title="Enregistrer cette recherche (s)"
              aria-keyshortcuts="s"
              @click="saveCurrentSearch"
            >
              Enregistrer cette recherche
            </button>
          </li>
          <SavedSearchesPanel ref="savedSearchesPanel" />
          <!-- Juste après les recherches enregistrées : les deux entrées
               se ressemblent (« Mes recherches » / « Mes recherches
               récentes ») et gagnent à être voisines plutôt que
               dispersées. L'une est un enregistrement explicite, l'autre
               une trace automatique. -->
          <HistoriquePanel />
          <CollectionsPanel
            v-if="uiConfig.config.collections_enabled"
            ref="collectionsPanel"
            @detail="detailId = $event"
          />
          <AlertsPanel v-if="uiConfig.config.alerts_enabled" />
          <li v-if="uiConfig.config.chat_enabled" class="fr-nav__item">
            <a id="lien-assistant" class="fr-nav__link" href="/chat">Assistant IA</a>
          </li>
          <!-- Entrées apportées par les modules complémentaires actifs.
               Le cœur ne rend rien d'autre que ce que le contrat a validé
               à l'installation : un libellé, un chemin sous /ext/<nom>/ et
               une classe d'icône DSFR. Aucun HTML, aucun script — voir
               PLAN-PLUGINS.md §3 pour pourquoi ça ne s'ouvrira pas. -->
          <!-- Écrans de module (accroche `page`) : le cœur fabrique
               lui-même l'entrée de menu, qui mène à sa page hôte et non
               au module — un module ne peut pas déclarer un lien hors de
               /ext/<lui-même>/, et c'est très bien ainsi. -->
          <li
            v-for="ecran in uiConfig.config.plugin_pages"
            :key="`page-${ecran.module}`"
            class="fr-nav__item"
          >
            <a
              class="fr-nav__link"
              :class="ecran.icone ? `fr-link--icon-left ${ecran.icone}` : undefined"
              :href="`/module.html?m=${encodeURIComponent(ecran.module)}`"
              data-testid="lien-module-page"
              >{{ ecran.libelle }}</a
            >
          </li>
          <li
            v-for="entree in uiConfig.config.plugin_nav"
            :key="`${entree.module}-${entree.chemin}`"
            class="fr-nav__item"
          >
            <a
              class="fr-nav__link"
              :class="entree.icone ? `fr-link--icon-left ${entree.icone}` : undefined"
              :href="entree.chemin"
              data-testid="lien-module"
              >{{ entree.libelle }}</a
            >
          </li>
        </ul>
      </nav>
    </template>
  </DsfrHeader>

  <Teleport v-if="headerSearch" :to="headerSearch">
    <div id="outils-entete" class="ds-header__controls">
      <ExactSearchToggle />
      <SourcesSelect />
      <DsfrButton
        id="recherche-reinitialiser"
        size="sm"
        secondary
        label="Réinitialiser la recherche"
        icon="fr-icon-refresh-line"
        icon-only
        title="Réinitialiser la recherche — requête, filtres et tri (n)"
        aria-label="Réinitialiser la recherche — requête, filtres et tri"
        aria-keyshortcuts="n"
        @click="store.resetSearch()"
      />
    </div>

    <!-- Dans le même téléport que les outils : la liste doit se poser
         sous la barre de recherche, dont le conteneur est son ancrage
         (voir .ds-suggestions dans app.css). -->
    <SearchSuggestions v-if="uiConfig.config.autocomplete_enabled" />
  </Teleport>

  <div class="fr-container fr-my-4w">
    <DsfrAlert
      v-if="saveError"
      id="recherche-erreur-enregistrement"
      type="error"
      small
      :description="saveError"
      class="fr-mt-1w"
    />

    <!-- Grille propre plutôt que `fr-grid-row` + `fr-col-md-3/9` : la
         largeur de la colonne devient réglable, ce qu'un pas de douzième
         ne permet pas. En dessous du point de rupture, la règle CSS
         retombe sur une colonne unique — même rendu qu'avec la grille
         DSFR, la poignée n'ayant pas de sens au doigt. -->
    <div
      class="ds-search-layout fr-mt-4w"
      :class="{ 'ds-search-layout--split': facetsVisible }"
      :style="{ '--ds-facets-width': `${preferences.facetsWidth}px` }"
    >
      <!-- Les facettes n'existent que si une recherche les a produites :
           tant qu'aucune n'a été lancée, la colonne disparaît et les
           résultats occupent toute la largeur, plutôt que d'afficher une
           colonne vide invitant à chercher. -->
      <!-- `v-if` et non `display: none` : la colonne est `position:
           sticky` et calée sur --ds-header-height ; masquée en CSS, elle
           laisserait un élément collant de hauteur nulle dans le flux.
           La démonter ne coûte rien, l'état des facettes vivant dans le
           store et le pli des sections dans les préférences. -->
      <div v-if="facetsVisible" id="facets">
        <FacetsSidebar />
      </div>

      <FacetsResizer v-if="facetsVisible" />

      <main id="main-content">
        <!-- Uniquement avant la première recherche : dès qu'il y a des
             résultats, la place revient à ceux-ci. Animation désactivée
             par l'administrateur, l'invitation reste — sinon la page
             d'accueil serait entièrement vide. -->
        <!-- `!store.loading` autant que `!store.hasSearched` :
             hasSearched ne passe à true qu'APRÈS la réponse du serveur,
             si bien que l'invitation restait affichée pendant tout
             l'appel — visible surtout au clic sur un exemple, où la
             recherche part sans que l'utilisateur ait rien saisi. Elle
             cohabiterait de surcroît avec le spinner. -->
        <template v-if="!store.hasSearched && !store.loading">
          <EmptySearchState
            v-if="uiConfig.config.empty_state_animation_enabled"
            @detail="detailId = $event"
          />
          <p v-else id="invite-recherche-texte" class="fr-text--sm">Lancez une recherche pour voir les résultats.</p>
        </template>

        <ActiveFilters />
        <SelectionToolbar @add="collectionsPanel?.openAdd()" />
        <ResultsToolbar />
        <ResultsList @detail="detailId = $event" />
        <FeedbackBar />
      </main>
    </div>
  </div>

  <!-- Pied de page réduit à l'essentiel : ni liens d'écosystème
       (info.gouv.fr…), ni liens obligatoires, ni licence codée en dur.
       `licence-name` vidé neutralise le lien que DsfrFooter accole
       toujours à la mention de bas de page ; il est masqué en CSS, une
       ancre vide subsistant sinon. -->
  <DsfrFooter
    v-if="uiConfig.config.footer_enabled"
    :logo-text="uiConfig.logoText"
    :desc-text="uiConfig.footerText"
    :licence-text="uiConfig.footerBottomText"
    licence-name=""
    :mandatory-links="[]"
    :ecosystem-links="[]"
    operator-img-src="/logo-docsearch.svg"
    operator-img-alt="DocSearch"
    operator-img-style="max-width: 2.5rem"
  />

  <BackToTop />

  <DocumentDetailModal :document-id="detailId" @close="detailId = null" />
  <NpsModal :opened="npsVisible" @close="npsVisible = false" />
  <SuggestionModal :opened="suggestionOpen" @close="suggestionOpen = false" />
  <ShortcutsModal :opened="shortcutsOpen" @close="shortcutsOpen = false" />
  <AppDialogs />
</template>
