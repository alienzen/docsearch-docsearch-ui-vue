<script setup lang="ts">
/**
 * Pagination « Précédent / Suivant » des tableaux de statistiques.
 * Portage du bloc .pager, identique dans les trois tableaux paginés
 * (suggestions, journal d'audit, historique des recherches).
 */
import { computed } from 'vue'

const props = defineProps<{
  /**
   * Identifiant du pagineur, d'où sont dérivés ceux des deux boutons. Il
   * est passé par le panneau appelant : ce composant est instancié trois
   * fois dans la même page (suggestions, historique, audit), et un
   * identifiant écrit en dur ici se retrouverait donc en triple.
   */
  id: string
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
  <div :id="id" class="ds-stats__pager fr-mt-2w">
    <span :id="`${id}-etendue`" class="fr-hint-text fr-mb-0">{{ label }}</span>
    <DsfrButton
      :id="`${id}-precedent`"
      size="sm"
      secondary
      label="← Précédent"
      :disabled="from === 0"
      @click="emit('update:from', Math.max(0, from - pageSize))"
    />
    <DsfrButton
      :id="`${id}-suivant`"
      size="sm"
      secondary
      label="Suivant →"
      :disabled="last >= total"
      @click="emit('update:from', from + pageSize)"
    />
  </div>
</template>
