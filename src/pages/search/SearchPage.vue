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

const store = useSearchStore()
const uiConfig = useUiConfigStore()

const quickLinks = computed(() => {
  const links: { label: string; to: string; class?: string }[] = []
  if (uiConfig.config.help_enabled) {
    links.push({ label: 'Aide', to: '/help', class: 'fr-link--icon-left fr-icon-question-line' })
  }
  if (uiConfig.config.chat_enabled) {
    links.push({
      label: 'Assistant IA',
      to: '/chat',
      class: 'fr-link--icon-left fr-icon-chat-3-line',
    })
  }
  if (uiConfig.showAdminLinks) {
    links.push({ label: 'Administration', to: '/admin.html' })
  }
  return links
})

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

onMounted(() => uiConfig.loadAll())
</script>

<template>
  <DsfrSkipLinks
    :links="[
      { id: '#main-content', text: 'Aller au contenu' },
      { id: '#facets', text: 'Aller aux filtres' },
    ]"
  />

  <DsfrHeader
    :service-title="uiConfig.headerTitle"
    :service-description="uiConfig.headerSubtitle"
    :logo-text="['République', 'Française']"
    home-to="/"
    :quick-links="quickLinks"
  />

  <div class="fr-container fr-my-4w">
    <p v-if="uiConfig.currentUserLabel" class="fr-hint-text fr-mb-1w">
      {{ uiConfig.currentUserLabel }}
    </p>

    <div class="ds-searchbar">
      <DsfrSearchBar
        v-model="store.query"
        label="Rechercher un document"
        :placeholder="uiConfig.headerSubtitle"
        large
        @search="store.searchFromFirstPage()"
      />
      <SourcesSelect />
      <DsfrButton secondary label="Réinitialiser la recherche" @click="store.resetSearch()" />
    </div>

    <nav class="ds-toolbar fr-mt-1w" aria-label="Navigation secondaire">
      <div class="ds-toolbar__actions">
        <DsfrButton
          size="sm"
          tertiary
          no-outline
          label="Enregistrer cette recherche"
          @click="saveCurrentSearch"
        />
        <SavedSearchesPanel />
        <CollectionsPanel
          v-if="uiConfig.config.collections_enabled"
          ref="collectionsPanel"
          @detail="detailId = $event"
        />
        <AlertsPanel v-if="uiConfig.config.alerts_enabled" />
        <DsfrButton
          v-if="uiConfig.engagement.suggestions_enabled"
          size="sm"
          tertiary
          no-outline
          label="Suggérer une idée"
          @click="suggestionOpen = true"
        />
      </div>
    </nav>
    <DsfrAlert v-if="saveError" type="error" small :description="saveError" class="fr-mt-1w" />

    <div class="fr-grid-row fr-grid-row--gutters fr-mt-4w">
      <div id="facets" class="fr-col-12 fr-col-md-3">
        <FacetsSidebar />
      </div>

      <main id="main-content" class="fr-col-12 fr-col-md-9">
        <ActiveFilters />
        <SelectionToolbar @add="collectionsPanel?.openAdd()" />
        <ResultsToolbar />
        <ResultsList @detail="detailId = $event" />
        <FeedbackBar />
      </main>
    </div>
  </div>

  <DsfrFooter
    v-if="uiConfig.config.footer_enabled"
    :description="uiConfig.footerText"
    :logo-text="['République', 'Française']"
  />

  <DocumentDetailModal :document-id="detailId" @close="detailId = null" />
  <NpsModal :opened="npsVisible" @close="npsVisible = false" />
  <SuggestionModal :opened="suggestionOpen" @close="suggestionOpen = false" />
</template>
