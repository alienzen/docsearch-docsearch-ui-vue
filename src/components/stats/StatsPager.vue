<script setup lang="ts">
/**
 * Pagination « Précédent / Suivant » des tableaux de statistiques.
 * Portage du bloc .pager, identique dans les trois tableaux paginés
 * (suggestions, journal d'audit, historique des recherches).
 */
import { computed } from 'vue'

const props = defineProps<{
  from: number
  pageSize: number
  total: number
}>()

const emit = defineEmits<{ 'update:from': [number] }>()

const first = computed(() => (props.total === 0 ? 0 : props.from + 1))
const last = computed(() => Math.min(props.from + props.pageSize, props.total))
const label = computed(() =>
  props.total === 0 ? '0 résultat' : `${first.value}–${last.value} sur ${props.total}`,
)
</script>

<template>
  <div class="ds-stats__pager fr-mt-2w">
    <span class="fr-hint-text fr-mb-0">{{ label }}</span>
    <DsfrButton
      size="sm"
      secondary
      label="← Précédent"
      :disabled="from === 0"
      @click="emit('update:from', Math.max(0, from - pageSize))"
    />
    <DsfrButton
      size="sm"
      secondary
      label="Suivant →"
      :disabled="last >= total"
      @click="emit('update:from', from + pageSize)"
    />
  </div>
</template>
