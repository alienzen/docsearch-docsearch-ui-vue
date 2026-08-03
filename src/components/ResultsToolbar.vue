<script setup lang="ts">
/**
 * Barre au-dessus des résultats : compteur, tri, vue compacte, export.
 * Portage des éléments #result-count / #results-actions de index.html et
 * de toggleCompactView() (results.js).
 */
import { computed, ref } from 'vue'
import { useSearchStore } from '@/stores/search'
import { usePreferencesStore } from '@/stores/preferences'
import { useUiConfigStore } from '@/stores/uiConfig'
import { SORT_OPTIONS, TOTAL_HITS_CAP } from '@/constants'
import type { ExportFormat } from '@/api/types'

const store = useSearchStore()
const preferences = usePreferencesStore()
const uiConfig = useUiConfigStore()

/**
 * Le moteur a cessé de compter : la recherche est trop large pour que
 * le total affiché ait un sens.
 */
const capped = computed(() => store.total >= TOTAL_HITS_CAP)

const countLabel = computed(() => {
  const total = store.total.toLocaleString('fr-FR')
  const plural = store.total > 1 ? 's' : ''
  const forQuery = store.query ? ` pour « ${store.query} »` : ''
  // « Plus de » et non le nombre nu : afficher « 10 000 résultats » pour
  // un décompte interrompu à 10 000 serait faux, le corpus pouvant en
  // contenir dix fois plus.
  const count = capped.value ? `Plus de ${total} résultats` : `${total} résultat${plural}`
  return `${count}${forQuery}`
})

// Même information qu'en bas de liste, répétée ici pour rester visible
// sans avoir à faire défiler jusqu'à la pagination.
const pageLabel = computed(() =>
  store.totalPages > 1 ? `Page ${store.page} sur ${store.totalPages}` : '',
)

const exportError = ref<string | null>(null)

async function exportAs(format: ExportFormat) {
  exportError.value = null
  try {
    await store.exportResults(format)
  } catch (e) {
    exportError.value = e instanceof Error ? e.message : String(e)
  }
}
</script>

<template>
  <div v-if="store.hasSearched" class="ds-toolbar fr-mb-2w">
    <p class="fr-mb-0">
      <strong>{{ countLabel }}</strong>
      <span v-if="pageLabel" class="fr-hint-text fr-ml-1w">{{ pageLabel }}</span>
      <!-- Réaffinage sur des résultats déjà affichés : le seul signe
           d'attente, la liste restant en place. `aria-hidden` car
           l'annonce vocale est déjà portée par ResultsList — la répéter
           ici la ferait entendre deux fois. -->
      <span v-if="store.loading" class="ds-spinner ds-spinner--sm fr-ml-1w" aria-hidden="true" />
    </p>

    <div class="ds-toolbar__actions">
      <!-- Cette bascule vit ICI et non dans la colonne de facettes :
           placée dedans, elle disparaîtrait avec elle et il n'y aurait
           plus aucun moyen de la rouvrir. `aria-expanded` porte l'état,
           ce qui évite un libellé changeant à chaque clic. -->
      <button
        class="fr-btn fr-btn--sm fr-btn--secondary fr-btn--icon-left fr-icon-filter-line"
        type="button"
        aria-controls="facets"
        title="Afficher ou masquer les filtres (f)"
        aria-keyshortcuts="f"
        :aria-expanded="!preferences.facetsHidden"
        @click="preferences.facetsHidden = !preferences.facetsHidden"
      >
        Filtres
      </button>

      <DsfrSelect
        v-if="uiConfig.config.sort_enabled"
        :model-value="store.sort"
        label="Trier par"
        label-visible
        :options="SORT_OPTIONS"
        @update:model-value="store.setSort(String($event))"
      />

      <!-- Rien à densifier quand la liste est vide. -->
      <DsfrButton
        v-if="store.total > 0"
        size="sm"
        secondary
        :label="preferences.resultsCompact ? 'Vue détaillée' : 'Vue compacte'"
        title="Basculer la vue compacte (c)"
        aria-keyshortcuts="c"
        @click="preferences.resultsCompact = !preferences.resultsCompact"
      />

      <template v-if="uiConfig.config.export_enabled">
        <DsfrButton size="sm" secondary label="Export XLSX" @click="exportAs('xlsx')" />
        <DsfrButton size="sm" secondary label="Export DOCX" @click="exportAs('docx')" />
      </template>
    </div>

    <!-- Avertissement plutôt qu'information : le tri par pertinence
         perd de son intérêt sur un ensemble aussi large, et l'export ne
         portera que sur les documents effectivement rapatriés. -->
    <DsfrAlert
      v-if="capped"
      type="warning"
      small
      description="Votre recherche renvoie trop de résultats pour être comptée précisément. Affinez-la avec les filtres ou des mots-clés supplémentaires pour obtenir un décompte exact et des résultats plus pertinents."
      class="fr-mt-1w"
    />

    <DsfrAlert
      v-if="exportError"
      type="error"
      small
      :description="`Impossible d'exporter les résultats : ${exportError}`"
      class="fr-mt-1w"
    />
  </div>
</template>
