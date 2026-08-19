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
import { computed, nextTick, onMounted, provide, ref, useTemplateRef } from 'vue'
import { getFileSources } from '@/api/admin'
import { ApiError } from '@/api/client'
import { useUiConfigStore } from '@/stores/uiConfig'
import { usePreferencesStore } from '@/stores/preferences'
import { useAdminGroupsStore, useAdminPanelsStore } from '@/stores/adminPanels'
import { useAdminShortcuts } from '@/composables/useAdminShortcuts'
import { useHeaderHeight } from '@/composables/useHeaderHeight'
import { useHeaderReduit } from '@/composables/useHeaderReduit'
import { ADMIN_SHORTCUTS } from '@/constants'
import { GROUP_IDS, PANEL_IDS, SECTIONS } from './sections'
import { construireIndex } from './sommaire'

const uiConfig = useUiConfigStore()
const preferences = usePreferencesStore()
const panels = useAdminPanelsStore()
const groups = useAdminGroupsStore()

/** Statique : l'index ne dépend d'aucune donnée chargée. */
const INDEX = construireIndex()

/**
 * Les deux niveaux de pli, que le sommaire ouvre pour atteindre une
 * ancre. Sorti du gabarit pour garder la même identité d'un rendu à
 * l'autre.
 */
const STORES = [groups, panels]

// En-tête replié au défilement, si l'administrateur l'a demandé : la
// page empile une vingtaine de panneaux.
useHeaderReduit(() => uiConfig.config.header_shrink_enabled)

// Publie --ds-header-height : le sommaire est collant sous un en-tête
// lui-même collant, et le saut vers une ancre doit décaler d'autant.
useHeaderHeight()

const accessDenied = ref<string | null>(null)

/**
 * Le sommaire disparaît aussi bien sur demande que sur refus d'accès —
 * dans ce dernier cas il ne reste plus une seule section à sommairiser.
 */
const sommaireVisible = computed(() => !accessDenied.value && !preferences.sommaireHidden)

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

// `PANEL_IDS` et `GROUP_IDS` viennent de sections.ts, qui décrit aussi
// le sommaire : le bouton « Tout replier » et les raccourcis chiffrés ne
// connaissent que ce qui y figure, et un panneau ajouté au gabarit sans
// y être déclaré resterait ouvert — et absent du sommaire. Le test de
// cette page compare cette déclaration au DOM rendu.

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
 *
 * Sauf le panneau d'état, qui la reçoit en prop : le remonter vidait ses
 * cartes le temps de la requête, alors qu'il sait déjà se rafraîchir en
 * place (il le fait toutes les 5s) et qu'un composant clignotant est
 * précisément ce qu'on ne veut pas d'un écran de supervision.
 */
const reloadKey = ref(0)

function reloadAll() {
  reloadKey.value++
  loadFileSources()
}

/** Palette des raccourcis, ouverte par « ? » ou par le lien d'en-tête. */
const shortcutsOpen = ref(false)

const sommaire = useTemplateRef<{ focaliserChamp: () => void }>('sommaire')

/**
 * Chercher suppose de voir le sommaire : « / » le rouvre d'abord. Sans
 * ça, la touche paraîtrait morte une fois la colonne escamotée. Le
 * `nextTick` est indispensable — la colonne est en `v-if`, la référence
 * n'existe donc qu'au rendu suivant.
 */
async function focaliserSommaire() {
  preferences.sommaireHidden = false
  await nextTick()
  sommaire.value?.focaliserChamp()
}

useAdminShortcuts({
  reload: reloadAll,
  toggleAll,
  toggleShortcuts: () => (shortcutsOpen.value = !shortcutsOpen.value),
  focusSearch: focaliserSommaire,
  toggleSommaire: () => (preferences.sommaireHidden = !preferences.sommaireHidden),
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

  <!-- Deux colonnes : le sommaire collant à gauche, les panneaux à
       droite. La grille ne se forme qu'à partir de 48em — le point de
       rupture du `fr-sidemenu`, qui range le sommaire derrière un bouton
       en deçà. Refus d'accès : une seule colonne, il n'y a plus rien à
       sommairiser. -->
  <div
    class="fr-container fr-my-4w ds-sommaire-layout"
    :class="{ 'ds-sommaire-layout--sommaire': sommaireVisible }"
  >
    <div v-if="sommaireVisible" class="ds-sommaire-layout__cote">
      <div class="ds-sommaire-layout__collant">
        <SommaireLateral
          ref="sommaire"
          menu-id="admin-sommaire"
          :sections="SECTIONS"
          :index="INDEX"
          :stores="STORES"
        />
      </div>
    </div>

    <main id="main-content">
      <DsfrAlert
        v-if="accessDenied"
        id="admin-acces-refuse"
        type="error"
        title="Accès refusé"
        :description="accessDenied"
      />

      <template v-else>
        <div id="admin-outils" class="ds-sommaire-layout__outils">
          <!-- Cette bascule vit ICI et non dans le sommaire : placée
               dedans, elle disparaîtrait avec lui et il n'y aurait plus
               aucun moyen de le rouvrir. Même raisonnement — et mêmes
               attributs — que le bouton « Filtres » de la recherche.
               `aria-expanded` porte l'état, ce qui évite un libellé
               changeant à chaque clic. -->
          <button
            id="admin-sommaire-bascule"
            class="fr-btn fr-btn--sm fr-btn--tertiary-no-outline fr-btn--icon-left fr-icon-menu-2-fill ds-sommaire-layout__bascule"
            type="button"
            aria-controls="admin-sommaire"
            title="Afficher ou masquer le sommaire (s)"
            aria-keyshortcuts="s"
            :aria-expanded="!preferences.sommaireHidden"
            @click="preferences.sommaireHidden = !preferences.sommaireHidden"
          >
            Sommaire
          </button>
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

        <!-- Ce groupe reste hors du conteneur remonté, pour le seul panneau
             d'état : sa voisine est donc remontée individuellement. -->
        <AdminGroup id="group-overview" title="Vue d'ensemble">
          <AdminStatusPanel :rechargement="reloadKey" />
          <AdminAllSourcesPanel :key="reloadKey" />
        </AdminGroup>

        <div :key="reloadKey">

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

        <!-- Un groupe à part, et pas sous « Sources » : un module peut
             n'apporter aucune source et n'exister que pour son écran. -->
        <AdminGroup id="group-plugins" title="Modules complémentaires">
          <AdminPluginsPanel />
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
  </div>

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
