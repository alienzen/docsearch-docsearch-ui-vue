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

  <!-- `show-search` place la barre de recherche dans .fr-header__tools,
       où le DSFR l'attend (voir le site du Système de Design). C'est
       DsfrHeader qui rend le balisage : inutile de le reproduire. -->
  <DsfrHeader
    v-model="store.query"
    :service-title="uiConfig.headerTitle"
    :service-description="uiConfig.headerSubtitle"
    :logo-text="['République', 'Française']"
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
          <li class="fr-nav__item">
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
          <li v-if="uiConfig.engagement.suggestions_enabled" class="fr-nav__item">
            <button class="fr-nav__link" type="button" @click="suggestionOpen = true">
              Suggérer une idée
            </button>
          </li>
        </ul>
      </nav>
    </template>
  </DsfrHeader>

  <div class="fr-container fr-my-4w">
    <p v-if="uiConfig.currentUserLabel" class="fr-hint-text fr-mb-1w">
      {{ uiConfig.currentUserLabel }}
    </p>

    <!-- La barre de recherche vit désormais dans l'en-tête ; ne restent
         ici que les commandes qui l'accompagnent, absentes du gabarit
         DSFR : présélection de sources et remise à zéro. -->
    <div class="ds-searchbar">
      <SourcesSelect />
      <DsfrButton secondary label="Réinitialiser la recherche" @click="store.resetSearch()" />
    </div>

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
