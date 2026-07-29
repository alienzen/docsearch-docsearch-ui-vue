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
import { SORT_OPTIONS } from '@/constants'
import type { ExportFormat } from '@/api/types'

const store = useSearchStore()
const preferences = usePreferencesStore()
const uiConfig = useUiConfigStore()

const countLabel = computed(() => {
  const total = store.total.toLocaleString('fr-FR')
  const plural = store.total > 1 ? 's' : ''
  const forQuery = store.query ? ` pour « ${store.query} »` : ''
  return `${total} résultat${plural}${forQuery}`
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
    </p>

    <div class="ds-toolbar__actions">
      <DsfrSelect
        v-if="uiConfig.config.sort_enabled"
        :model-value="store.sort"
        label="Trier par"
        label-visible
        :options="SORT_OPTIONS"
        @update:model-value="store.setSort(String($event))"
      />

      <DsfrButton
        size="sm"
        secondary
        :label="preferences.resultsCompact ? 'Vue détaillée' : 'Vue compacte'"
        @click="preferences.resultsCompact = !preferences.resultsCompact"
      />

      <template v-if="uiConfig.config.export_enabled">
        <DsfrButton size="sm" secondary label="Export XLSX" @click="exportAs('xlsx')" />
        <DsfrButton size="sm" secondary label="Export DOCX" @click="exportAs('docx')" />
      </template>
    </div>

    <DsfrAlert
      v-if="exportError"
      type="error"
      small
      :description="`Impossible d'exporter les résultats : ${exportError}`"
      class="fr-mt-1w"
    />
  </div>
</template>
