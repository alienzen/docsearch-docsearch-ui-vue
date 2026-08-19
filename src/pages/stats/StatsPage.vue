<script setup lang="ts">
/**
 * Statistiques de recherche — portage de
 * docsearch-ui/public/stats.html.
 *
 * Chaque panneau charge ses propres données et gère son propre échec :
 * un endpoint en erreur n'empêche pas les autres de s'afficher, comme le
 * faisait le Promise.allSettled() d'origine. Seul un refus d'accès
 * (401/403) remplace toute la page, puisqu'il vaut pour tous.
 *
 * Même sommaire collant que l'administration (voir SommaireLateral) :
 * six panneaux de plusieurs écrans chacun, la page se parcourait au
 * défilement seul.
 */
import { computed, nextTick, onMounted, provide, ref, useTemplateRef } from 'vue'
import { useUiConfigStore } from '@/stores/uiConfig'
import { useStatsPanelsStore } from '@/stores/statsPanels'
import { usePreferencesStore } from '@/stores/preferences'
import { ApiError } from '@/api/client'
import { useAdminShortcuts } from '@/composables/useAdminShortcuts'
import { useHeaderHeight } from '@/composables/useHeaderHeight'
import { useHeaderReduit } from '@/composables/useHeaderReduit'
import { STATS_SHORTCUTS } from '@/constants'
import { PANEL_IDS, SECTIONS } from './sections'
import { construireIndex } from './sommaire'

const uiConfig = useUiConfigStore()
const preferences = usePreferencesStore()
const panels = useStatsPanelsStore()

/** Statique : l'index ne dépend d'aucune donnée chargée. */
const INDEX = construireIndex()

/**
 * Un seul niveau de pli sur cette page, contrairement à
 * l'administration : le sommaire n'a donc qu'un store à ouvrir. Le
 * tableau est sorti du gabarit pour garder la même identité d'un rendu
 * à l'autre.
 */
const STORES = [panels]

// En-tête replié au défilement, si l'administrateur l'a demandé : les
// tableaux de cette page sont longs.
useHeaderReduit(() => uiConfig.config.header_shrink_enabled)

// Publie --ds-header-height : le sommaire est collant sous un en-tête
// lui-même collant, et le saut vers une ancre doit décaler d'autant.
useHeaderHeight()

/**
 * Mêmes raccourcis que l'administration, dont cette page partage la
 * structure en panneaux repliables. `reload` n'est pas fourni : ici
 * chaque panneau se recharge seul, il n'y a pas d'action globale à
 * offrir — le composable ignore alors la touche « r » plutôt que de
 * l'intercepter pour rien.
 */
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
  toggleAll: () => panels.toggleAll(),
  toggleShortcuts: () => (shortcutsOpen.value = !shortcutsOpen.value),
  focusSearch: focaliserSommaire,
  toggleSommaire: () => (preferences.sommaireHidden = !preferences.sommaireHidden),
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

/**
 * Le sommaire disparaît aussi bien sur demande que sur refus d'accès —
 * dans ce dernier cas il ne reste plus une seule section à sommairiser.
 */
const sommaireVisible = computed(() => !accessDenied.value && !preferences.sommaireHidden)

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
          menu-id="stats-sommaire"
          :sections="SECTIONS"
          :index="INDEX"
          :stores="STORES"
        />
      </div>
    </div>

    <main id="main-content">
      <DsfrAlert
        v-if="accessDenied"
        id="stats-acces-refuse"
        type="error"
        title="Accès refusé"
        :description="accessDenied"
      />

      <template v-else>
        <div id="stats-outils" class="ds-sommaire-layout__outils">
          <!-- Cette bascule vit ICI et non dans le sommaire : placée
               dedans, elle disparaîtrait avec lui et il n'y aurait plus
               aucun moyen de le rouvrir. `aria-expanded` porte l'état,
               ce qui évite un libellé changeant à chaque clic. -->
          <button
            id="stats-sommaire-bascule"
            class="fr-btn fr-btn--sm fr-btn--tertiary-no-outline fr-btn--icon-left fr-icon-menu-2-fill ds-sommaire-layout__bascule"
            type="button"
            aria-controls="stats-sommaire"
            title="Afficher ou masquer le sommaire (s)"
            aria-keyshortcuts="s"
            :aria-expanded="!preferences.sommaireHidden"
            @click="preferences.sommaireHidden = !preferences.sommaireHidden"
          >
            Sommaire
          </button>
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
  </div>

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
