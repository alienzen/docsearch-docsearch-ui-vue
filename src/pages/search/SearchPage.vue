<script setup lang="ts">
/**
 * Page de recherche — portage de docsearch-ui/public/index.html.
 *
 * Tout ce que init.js faisait au chargement (appels de démarrage,
 * raccourcis clavier, fermeture des panneaux au clic extérieur) tient
 * ici ou dans un composable ; les ~40 handlers `onclick="..."` du HTML
 * d'origine sont devenus des `@click`.
 */
import { computed, onMounted } from 'vue'
import { useSearchStore } from '@/stores/search'
import { useUiConfigStore } from '@/stores/uiConfig'
import { useSearchShortcuts } from '@/composables/useSearchShortcuts'

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

useSearchShortcuts()

onMounted(() => uiConfig.loadAll())

function onDetail(id: string) {
  // La fiche détail (modale, aperçu, documents similaires, mots-clés)
  // arrive avec le lot suivant : d'ici là, la page dédiée de l'API rend
  // le document consultable sans impasse pour l'utilisateur.
  window.location.href = `/document/${encodeURIComponent(id)}`
}
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
      <DsfrButton
        secondary
        label="Réinitialiser la recherche"
        @click="store.resetSearch()"
      />
    </div>

    <div class="fr-grid-row fr-grid-row--gutters fr-mt-4w">
      <div id="facets" class="fr-col-12 fr-col-md-3">
        <FacetsSidebar />
      </div>

      <main id="main-content" class="fr-col-12 fr-col-md-9">
        <ActiveFilters />
        <ResultsToolbar />
        <ResultsList @detail="onDetail" />
      </main>
    </div>
  </div>

  <DsfrFooter
    v-if="uiConfig.config.footer_enabled"
    :description="uiConfig.footerText"
    :logo-text="['République', 'Française']"
  />
</template>
