<script setup lang="ts">
/**
 * Groupe de panneaux (« Sources SQL »…). Second niveau de pli,
 * indépendant du premier : replier un groupe puis le rouvrir retrouve
 * chacun de ses panneaux tel qu'il était.
 */
import { useAdminGroupsStore } from '@/stores/adminPanels'

defineProps<{ id: string; title: string }>()

const groups = useAdminGroupsStore()
</script>

<template>
  <CollapsiblePanel :id="id" :title="title" :store="groups" group>
    <slot />
  </CollapsiblePanel>
</template>
