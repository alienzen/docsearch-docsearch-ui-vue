<script setup lang="ts">
/**
 * Panneau d'administration — portage de
 * docsearch-ui/public/admin.html.
 *
 * Comme la page de statistiques : chaque panneau charge et échoue
 * indépendamment, sauf un refus d'accès (401/403) qui vaut pour tous et
 * remplace la page par un bandeau unique.
 *
 * La liste des sources fichiers est chargée ICI et passée aux panneaux
 * qui en ont besoin (types de fichiers, filtres, scan) : en vanilla, un
 * cache global devait être peuplé avant eux, ce qui obligeait à
 * séquencer les rendus à la main.
 */
import { computed, onMounted, provide, ref } from 'vue'
import { getFileSources } from '@/api/admin'
import { ApiError } from '@/api/client'
import { useUiConfigStore } from '@/stores/uiConfig'
import { useAdminGroupsStore, useAdminPanelsStore } from '@/stores/adminPanels'

const uiConfig = useUiConfigStore()
const panels = useAdminPanelsStore()
const groups = useAdminGroupsStore()

const accessDenied = ref<string | null>(null)

provide('reportError', (e: unknown) => {
  if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
    accessDenied.value = e.message
  }
})

/** Noms des sources fichiers, pour les sélecteurs des panneaux. */
const fileSources = ref<string[]>([])

async function loadFileSources() {
  try {
    fileSources.value = Object.keys(await getFileSources())
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
      accessDenied.value = e.message
    }
  }
}

const PANEL_IDS = [
  'status-panel',
  'allsources-panel',
  'filetypes-panel',
  'pathfilters-panel',
  'scan-panel',
  'engagement-panel',
  'ui-config-panel',
  'config-panel',
]
const GROUP_IDS = ['group-overview', 'group-file-sources', 'group-interface']

const toggleAllLabel = computed(() =>
  panels.anyExpanded || groups.anyExpanded ? 'Tout replier' : 'Tout déplier',
)

/** Un seul bouton pour les deux niveaux, comme en vanilla. */
function toggleAll() {
  const collapse = panels.anyExpanded || groups.anyExpanded
  panels.collapsed = collapse ? [...PANEL_IDS] : []
  groups.collapsed = collapse ? [...GROUP_IDS] : []
}

onMounted(() => {
  panels.known = PANEL_IDS
  groups.known = GROUP_IDS
  uiConfig.loadUiConfig()
  uiConfig.loadIsAdmin()
  loadFileSources()
})
</script>

<template>
  <DsfrHeader
    service-title="DocSearch"
    service-description="Administration"
    :logo-text="['République', 'Française']"
    home-to="/"
    :quick-links="[
      { label: 'Statistiques', to: '/stats.html' },
      { label: 'Aide', to: '/admin-help' },
      {
        label: 'Retour à la recherche',
        to: '/',
        class: 'fr-link--icon-left fr-icon-arrow-left-line',
      },
    ]"
  />

  <main id="main-content" class="fr-container fr-my-4w">
    <p v-if="uiConfig.currentUserLabelAdmin" class="fr-hint-text">
      {{ uiConfig.currentUserLabelAdmin }}
    </p>

    <DsfrAlert v-if="accessDenied" type="error" title="Accès refusé" :description="accessDenied" />

    <template v-else>
      <!-- Migration en cours : tant que les panneaux de création et de
           suppression de sources ne sont pas portés, le dire ici plutôt
           que de laisser un administrateur chercher un écran absent. À
           retirer une fois ces panneaux disponibles. -->
      <DsfrAlert
        type="warning"
        title="Panneau en cours de migration"
        description="La création, la modification et la suppression de sources (fichiers, SQL, web), ainsi que l'arborescence des sources, ne sont pas encore disponibles ici : passer par l'interface d'administration historique pour ces opérations. Tout le reste est opérationnel."
        class="fr-mb-3w"
      />

      <div class="ds-stats__toolbar">
        <DsfrButton size="sm" tertiary no-outline :label="toggleAllLabel" @click="toggleAll" />
      </div>

      <AdminGroup id="group-overview" title="Vue d'ensemble">
        <AdminStatusPanel />
        <AdminAllSourcesPanel />
      </AdminGroup>

      <AdminGroup id="group-file-sources" title="Sources fichiers">
        <AdminFiletypesPanel :sources="fileSources" />
        <AdminPathFiltersPanel :sources="fileSources" />
        <AdminScanPanel :sources="fileSources" />
      </AdminGroup>

      <AdminGroup id="group-interface" title="Interface et engagement">
        <AdminEngagementPanel />
        <AdminUiConfigPanel />
        <AdminConfigPanel />
      </AdminGroup>
    </template>
  </main>

  <DsfrFooter
    v-if="uiConfig.config.footer_enabled_admin"
    description="DocSearch — Administration"
    :logo-text="['République', 'Française']"
  />
</template>
