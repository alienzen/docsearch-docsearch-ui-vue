<script setup lang="ts">
/**
 * Barre qui apparaît dès qu'un document est coché. Portage de
 * renderSelectionToolbar() (docsearch-ui/public/js/results.js).
 */
import { computed } from 'vue'
import { useSelectionStore } from '@/stores/selection'
import { useUiConfigStore } from '@/stores/uiConfig'

const emit = defineEmits<{ add: [] }>()

const selection = useSelectionStore()
const uiConfig = useUiConfigStore()

const visible = computed(() => uiConfig.config.collections_enabled && selection.count > 0)

const label = computed(() => {
  const n = selection.count
  return `${n} document${n > 1 ? 's' : ''} sélectionné${n > 1 ? 's' : ''}`
})
</script>

<template>
  <div v-if="visible" id="selection" class="ds-selection fr-mb-2w">
    <p id="selection-decompte" class="fr-mb-0"><strong>{{ label }}</strong></p>
    <DsfrButton
      id="selection-ajouter-collection"
      size="sm"
      label="Ajouter à une collection"
      @click="emit('add')"
    />
    <DsfrButton
      id="selection-annuler"
      size="sm"
      tertiary
      no-outline
      label="Annuler la sélection"
      @click="selection.clear()"
    />
  </div>
</template>
