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
import { useAdminShortcuts } from '@/composables/useAdminShortcuts'
import { ADMIN_SHORTCUTS } from '@/constants'

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
  'filesources-panel',
  'filetypes-panel',
  'pathfilters-panel',
  'scan-panel',
  'source-tree-panel',
  'sqlsources-panel',
  'websources-panel',
  'engagement-panel',
  'ui-config-panel',
  'config-panel',
]
const GROUP_IDS = [
  'group-overview',
  'group-file-sources',
  'group-sql-sources',
  'group-web-sources',
  'group-interface',
]

const toggleAllLabel = computed(() =>
  panels.anyExpanded || groups.anyExpanded ? 'Tout replier' : 'Tout déplier',
)

/** Un seul bouton pour les deux niveaux, comme en vanilla. */
function toggleAll() {
  const collapse = panels.anyExpanded || groups.anyExpanded
  panels.collapsed = collapse ? [...PANEL_IDS] : []
  groups.collapsed = collapse ? [...GROUP_IDS] : []
}

/**
 * Recharge tous les panneaux. Chacun charge ses données au montage :
 * changer cette clé les remonte, ce qui les recharge tous sans avoir à
 * exposer une méthode `refresh` sur chacun d'eux.
 */
const reloadKey = ref(0)

function reloadAll() {
  reloadKey.value++
  loadFileSources()
}

/** Palette des raccourcis, ouverte par « ? » ou par le lien d'en-tête. */
const shortcutsOpen = ref(false)

useAdminShortcuts({
  reload: reloadAll,
  toggleAll,
  toggleShortcuts: () => (shortcutsOpen.value = !shortcutsOpen.value),
  // Les chiffres visent les GROUPES, accordéons de premier niveau : ce
  // sont eux qu'on plie pour naviguer, les panneaux étant à l'intérieur.
  toggleAt: (i) => {
    const id = GROUP_IDS[i]
    if (id) groups.toggle(id)
  },
})

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
      { label: 'Aide', to: '/admin-help', class: 'fr-link--icon-left fr-icon-question-line' },
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
          { label: 'Statistiques', href: '/stats.html', icon: 'fr-icon-bar-chart-line' },
          {
            label: 'Administration',
            href: '/admin.html',
            icon: 'fr-icon-settings-5-line',
            current: false,
          },
        ]"
      />
    </template>
  </DsfrHeader>

  <main id="main-content" class="fr-container fr-my-4w">
    <DsfrAlert
      v-if="accessDenied"
      id="admin-acces-refuse"
      type="error"
      title="Accès refusé"
      :description="accessDenied"
    />

    <template v-else>
      <div id="admin-outils" class="ds-stats__toolbar">
        <DsfrButton
          id="admin-recharger"
          size="sm"
          tertiary
          no-outline
          label="Recharger"
          title="Recharger tous les panneaux (r)"
          aria-keyshortcuts="r"
          @click="reloadAll"
        />
        <DsfrButton
          id="admin-tout-replier"
          size="sm"
          tertiary
          no-outline
          :label="toggleAllLabel"
          :title="`${toggleAllLabel} (t)`"
          aria-keyshortcuts="t"
          @click="toggleAll"
        />
      </div>

      <div :key="reloadKey">

      <AdminGroup id="group-overview" title="Vue d'ensemble">
        <AdminStatusPanel />
        <AdminAllSourcesPanel />
      </AdminGroup>

      <AdminGroup id="group-file-sources" title="Sources fichiers">
        <AdminFileSourcesPanel @changed="loadFileSources" />
        <AdminFiletypesPanel :sources="fileSources" />
        <AdminPathFiltersPanel :sources="fileSources" />
        <AdminScanPanel :sources="fileSources" />
        <AdminSourceTreePanel :sources="fileSources" />
        <!-- Avec les sources fichiers : l'empreinte de contenu n'existe
             que pour elles (une ligne SQL n'a pas de fichier). -->
        <AdminDuplicatesPanel :sources="fileSources" />
      </AdminGroup>

      <AdminGroup id="group-sql-sources" title="Sources SQL">
        <AdminSqlSourcesPanel />
      </AdminGroup>

      <AdminGroup id="group-web-sources" title="Sources web">
        <AdminWebSourcesPanel />
      </AdminGroup>

      <AdminGroup id="group-recherche" title="Recherche">
        <AdminSynonymsPanel />
        <AdminPinnedPanel />
      </AdminGroup>

      <AdminGroup id="group-interface" title="Interface et engagement">
        <AdminEngagementPanel />
        <AdminUiConfigPanel />
        <AdminConfigPanel />
      </AdminGroup>
      </div>
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
    :desc-text="'DocSearch — Administration'"
    :licence-text="uiConfig.footerBottomText"
    licence-name=""
    :mandatory-links="[]"
    :ecosystem-links="[]"
    operator-img-src="/logo-docsearch.svg"
    operator-img-alt="DocSearch"
    operator-img-style="max-width: 2.5rem"
  />

  <ShortcutsModal
    :opened="shortcutsOpen"
    :shortcuts="ADMIN_SHORTCUTS"
    :help-href="'/admin-help'"
    help-label="Aide administrateur"
    @close="shortcutsOpen = false"
  />
  <AppDialogs />
</template>
