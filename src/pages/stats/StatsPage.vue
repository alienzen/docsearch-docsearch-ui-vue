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
import { useAdminShortcuts } from '@/composables/useAdminShortcuts'
import { useHeaderReduit } from '@/composables/useHeaderReduit'
import { STATS_SHORTCUTS } from '@/constants'

const uiConfig = useUiConfigStore()
const panels = useStatsPanelsStore()

// En-tête replié au défilement, si l'administrateur l'a demandé : les
// tableaux de cette page sont longs.
useHeaderReduit(() => uiConfig.config.header_shrink_enabled)

/**
 * Mêmes raccourcis que l'administration, dont cette page partage la
 * structure en panneaux repliables. `reload` n'est pas fourni : ici
 * chaque panneau se recharge seul, il n'y a pas d'action globale à
 * offrir — le composable ignore alors la touche « r » plutôt que de
 * l'intercepter pour rien.
 */
const shortcutsOpen = ref(false)

useAdminShortcuts({
  toggleAll: () => panels.toggleAll(),
  toggleShortcuts: () => (shortcutsOpen.value = !shortcutsOpen.value),
  toggleAt: (i) => {
    const id = PANEL_IDS[i]
    if (id) panels.toggle(id)
  },
})

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
    operator-img-src="/logo-docsearch.svg"
    operator-img-alt="DocSearch"
    operator-img-style="max-width: 2.5rem"
    :quick-links="[
      {
        label: 'Raccourcis',
        button: true,
        class: 'fr-link--icon-left fr-icon-keyboard-line',
        title: 'Raccourcis clavier (?)',
        'aria-keyshortcuts': '?',
        onClick: () => (shortcutsOpen = !shortcutsOpen),
      },
      { label: 'Aide', to: '/stats-help', class: 'fr-link--icon-left fr-icon-question-line' },
    ]"
  >
    <!-- Après les liens rapides : le menu du compte se place ainsi tout à
         droite des outils d'en-tête, à l'écart des liens d'action. Il
         porte aussi les deux liens d'administration, comme sur la page de
         recherche — mêmes entrées dans le même ordre d'une page à
         l'autre, celle où l'on se trouve étant marquée `current`.

         « Retour à la recherche » a été retiré : le bloc-marque et le
         logo pointent déjà vers `/`, c'est la sortie que le DSFR prévoit
         et elle est présente sur toutes les pages. -->
    <template #after-quick-links>
      <HeaderUserMenu
        family="admin"
        :links="[
          {
            label: 'Statistiques',
            href: '/stats.html',
            icon: 'fr-icon-bar-chart-line',
            current: false,
          },
          { label: 'Administration', href: '/admin.html', icon: 'fr-icon-settings-5-line' },
        ]"
      />
    </template>
  </DsfrHeader>

  <main id="main-content" class="fr-container fr-my-4w">
    <DsfrAlert
      v-if="accessDenied"
      id="stats-acces-refuse"
      type="error"
      title="Accès refusé"
      :description="accessDenied"
    />

    <template v-else>
      <div id="stats-outils" class="ds-stats__toolbar">
        <DsfrButton
          id="stats-tout-replier"
          size="sm"
          tertiary
          no-outline
          :label="toggleAllLabel"
          :title="`${toggleAllLabel} (t)`"
          aria-keyshortcuts="t"
          @click="panels.toggleAll()"
        />
      </div>

      <StatsSummaryPanel />
      <StatsNpsPanel />
      <StatsSuggestionsPanel />
      <StatsZeroResultsPanel />
      <StatsSearchLogsPanel />
      <StatsAuditLogPanel />
    </template>
  </main>

  <ShortcutsModal
    :opened="shortcutsOpen"
    :shortcuts="STATS_SHORTCUTS"
    :help-href="'/stats-help'"
    help-label="Aide des statistiques"
    @close="shortcutsOpen = false"
  />

  <!-- Hôte des confirmations (useDialogs) — sans lui, `confirm()` pose
       une demande dans le store que RIEN ne rend : la promesse n'est
       jamais résolue, le clic sur « Supprimer » ne produit ni fenêtre ni
       erreur, et le bouton paraît simplement mort. Vu à l'écran, pas en
       relisant : les tests du panneau résolvent la demande directement
       par le store, comme le font tous ceux du dépôt. -->
  <AppDialogs />

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
    :licence-text="uiConfig.footerBottomText"
    licence-name=""
    :mandatory-links="[]"
    :ecosystem-links="[]"
    operator-img-src="/logo-docsearch.svg"
    operator-img-alt="DocSearch"
    operator-img-style="max-width: 2.5rem"
  />
</template>
