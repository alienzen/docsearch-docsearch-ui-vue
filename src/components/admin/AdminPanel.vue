<script setup lang="ts">
/** Panneau d'administration : CollapsiblePanel branché sur son store. */
import { useAdminPanelsStore } from '@/stores/adminPanels'

defineProps<{
  id: string
  title: string
  subtitle?: string
  error?: string | null
}>()

const panels = useAdminPanelsStore()
</script>

<template>
  <CollapsiblePanel :id="id" :title="title" :subtitle="subtitle" :error="error" :store="panels">
    <slot />
  </CollapsiblePanel>
</template>
