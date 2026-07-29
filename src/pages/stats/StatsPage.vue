<script setup lang="ts">
/**
 * Statistiques de recherche — portage de
 * docsearch-ui/public/stats.html.
 *
 * Chaque panneau charge ses propres données et gère son propre échec :
 * un endpoint en erreur n'empêche pas les autres de s'afficher, comme le
 * faisait le Promise.allSettled() d'origine. Seul un refus d'accès
 * (401/403) remplace toute la page, puisqu'il vaut pour tous.
 */
import { computed, onMounted, provide, ref } from 'vue'
import { useUiConfigStore } from '@/stores/uiConfig'
import { useStatsPanelsStore } from '@/stores/statsPanels'
import { ApiError } from '@/api/client'

const uiConfig = useUiConfigStore()
const panels = useStatsPanelsStore()

const accessDenied = ref<string | null>(null)

/**
 * Les panneaux signalent ici un refus d'accès. Fourni par injection
 * plutôt que remonté par événements : les six panneaux le partagent, et
 * le premier qui le rencontre suffit.
 */
provide('reportError', (e: unknown) => {
  if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
    accessDenied.value = e.message
  }
})

const PANEL_IDS = [
  'summary-panel',
  'nps-panel',
  'suggestions-panel',
  'zero-results-panel',
  'logs-panel',
  'audit-log-panel',
]

const toggleAllLabel = computed(() => (panels.anyExpanded ? 'Tout replier' : 'Tout déplier'))

onMounted(() => {
  panels.known = PANEL_IDS
  uiConfig.loadUiConfig()
  uiConfig.loadIsAdmin()
})
</script>

<template>
  <DsfrHeader
    service-title="DocSearch"
    service-description="Statistiques de recherche"
    :logo-text="uiConfig.logoText"
    home-to="/"
    :quick-links="[
      ...uiConfig.userQuickLinks('admin'),
      {
        label: 'Administration',
        to: '/admin.html',
        class: 'fr-link--icon-left fr-icon-settings-5-line',
      },
    ]"
  />

  <main id="main-content" class="fr-container fr-my-4w">
    <DsfrAlert
      v-if="accessDenied"
      type="error"
      title="Accès refusé"
      :description="accessDenied"
    />

    <template v-else>
      <div class="ds-stats__toolbar">
        <DsfrButton size="sm" tertiary no-outline :label="toggleAllLabel" @click="panels.toggleAll()" />
      </div>

      <StatsSummaryPanel />
      <StatsNpsPanel />
      <StatsSuggestionsPanel />
      <StatsZeroResultsPanel />
      <StatsSearchLogsPanel />
      <StatsAuditLogPanel />
    </template>
  </main>

  <BackToTop />

  <!-- Pied de page réduit à l'essentiel : ni liens d'écosystème
       (info.gouv.fr…), ni liens obligatoires, ni licence codée en dur.
       `licence-name` vidé neutralise le lien que DsfrFooter accole
       toujours à la mention de bas de page ; il est masqué en CSS, une
       ancre vide subsistant sinon. -->
  <DsfrFooter
    v-if="uiConfig.config.footer_enabled_admin"
    :logo-text="uiConfig.logoText"
    :desc-text="'DocSearch — Statistiques de recherche'"
    :licence-text="uiConfig.config.footer_bottom_text"
    licence-name=""
    :mandatory-links="[]"
    :ecosystem-links="[]"
  />
</template>
