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
import { useSearchShortcuts } from '@/composables/useSearchShortcuts'
import { useNps } from '@/composables/useNps'
import { useHeaderHeight } from '@/composables/useHeaderHeight'

const store = useSearchStore()
const uiConfig = useUiConfigStore()

const quickLinks = computed(() => {
  const links: {
    label: string
    to?: string
    class?: string
    button?: boolean
    onClick?: () => void
  }[] = [...uiConfig.userQuickLinks('search')]
  if (uiConfig.config.help_enabled) {
    links.push({ label: 'Aide', to: '/help', class: 'fr-link--icon-left fr-icon-question-line' })
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
  if (uiConfig.showAdminLinks) {
    // Les deux liens sont gouvernés par la même bascule et le même
    // groupe LDAP, comme dans docsearch-ui (admin-link et
    // footer-stats-link).
    links.push({ label: 'Statistiques', to: '/stats.html' })
    links.push({ label: 'Administration', to: '/admin.html' })
  }
  return links
})

/**
 * Le lien d'évitement vers les filtres ne doit être proposé que quand
 * ils existent : la colonne n'est rendue qu'une fois une recherche
 * lancée.
 */
const skipLinks = computed(() => {
  const links = [{ id: '#main-content', text: 'Aller au contenu' }]
  if (store.hasSearched) links.push({ id: '#facets', text: 'Aller aux filtres' })
  return links
})

/**
 * Conteneur de la barre de recherche dans l'en-tête, rendu par
 * DsfrHeader. Celui-ci n'expose aucun slot dans .fr-header__tools : pour
 * placer la présélection de sources et la remise à zéro À CÔTÉ de la
 * barre, on y téléporte ces commandes une fois l'en-tête monté.
 */
const headerSearch = ref<Element | null>(null)

// ── Fiche détail ────────────────────────────────────────────
const detailId = ref<string | null>(null)

// ── Collections ─────────────────────────────────────────────
const collectionsPanel = ref<{ openAdd: () => void } | null>(null)

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
  const name = prompt('Nom de cette recherche :', store.query || 'Recherche sans titre')
  if (!name || !name.trim()) return
  saveError.value = null
  try {
    await createSavedSearch(store.savedSearchPayload(name.trim()))
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : String(e)
  }
}

useSearchShortcuts({ saveCurrentSearch })
// L'en-tête est collant : sa hauteur décale la colonne de facettes.
useHeaderHeight()

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
    :quick-links="quickLinks"
    show-search
    search-label="Rechercher un document"
    :placeholder="uiConfig.headerSubtitle"
    @search="store.searchFromFirstPage()"
  >
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
            <button class="fr-nav__link" type="button" @click="saveCurrentSearch">
              Enregistrer cette recherche
            </button>
          </li>
          <SavedSearchesPanel />
          <CollectionsPanel
            v-if="uiConfig.config.collections_enabled"
            ref="collectionsPanel"
            @detail="detailId = $event"
          />
          <AlertsPanel v-if="uiConfig.config.alerts_enabled" />
          <li v-if="uiConfig.config.chat_enabled" class="fr-nav__item">
            <a class="fr-nav__link" href="/chat">Assistant IA</a>
          </li>
        </ul>
      </nav>
    </template>
  </DsfrHeader>

  <Teleport v-if="headerSearch" :to="headerSearch">
    <div class="ds-header__controls">
      <SourcesSelect />
      <DsfrButton
        size="sm"
        secondary
        label="Réinitialiser la recherche"
        @click="store.resetSearch()"
      />
    </div>
  </Teleport>

  <div class="fr-container fr-my-4w">
    <DsfrAlert v-if="saveError" type="error" small :description="saveError" class="fr-mt-1w" />

    <div class="fr-grid-row fr-grid-row--gutters fr-mt-4w">
      <!-- Les facettes n'existent que si une recherche les a produites :
           tant qu'aucune n'a été lancée, la colonne disparaît et les
           résultats occupent toute la largeur, plutôt que d'afficher une
           colonne vide invitant à chercher. -->
      <div v-if="store.hasSearched" id="facets" class="fr-col-12 fr-col-md-3">
        <FacetsSidebar />
      </div>

      <main
        id="main-content"
        class="fr-col-12"
        :class="store.hasSearched ? 'fr-col-md-9' : 'fr-col-md-12'"
      >
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
    :licence-text="uiConfig.config.footer_bottom_text"
    licence-name=""
    :mandatory-links="[]"
    :ecosystem-links="[]"
  />

  <BackToTop />

  <DocumentDetailModal :document-id="detailId" @close="detailId = null" />
  <NpsModal :opened="npsVisible" @close="npsVisible = false" />
  <SuggestionModal :opened="suggestionOpen" @close="suggestionOpen = false" />
</template>
