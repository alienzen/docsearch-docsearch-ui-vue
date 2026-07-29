<script setup lang="ts">
/**
 * Panneau de la page de statistiques : CollapsiblePanel branché sur le
 * store de pli propre à cette page. Existe pour que les six panneaux
 * n'aient pas à répéter cette liaison.
 */
import { useStatsPanelsStore } from '@/stores/statsPanels'

defineProps<{
  id: string
  title: string
  subtitle?: string
  error?: string | null
}>()

const panels = useStatsPanelsStore()
</script>

<template>
  <CollapsiblePanel :id="id" :title="title" :subtitle="subtitle" :error="error" :store="panels">
    <slot />
  </CollapsiblePanel>
</template>
