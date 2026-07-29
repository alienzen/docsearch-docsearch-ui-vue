<script setup lang="ts">
/**
 * Panneau repliable de la page de statistiques. Portage de panelWrap()
 * / toggleAccordion() (docsearch-ui/public/stats.html) — le pli est
 * persisté sous la même clé localStorage, distincte de celle de la page
 * de recherche et de celle d'admin.html.
 *
 * Comme FacetGroup, s'appuie sur <details>/<summary> natif : accessible
 * au clavier et aux lecteurs d'écran sans code supplémentaire.
 */
import { computed } from 'vue'
import { useStatsPanelsStore } from '@/stores/statsPanels'

const props = defineProps<{
  id: string
  title: string
  subtitle?: string
  /** Message d'erreur du panneau, affiché à la place du contenu. */
  error?: string | null
}>()

const panels = useStatsPanelsStore()

const open = computed(() => !panels.isCollapsed(props.id))

/**
 * Voir FacetGroup : `toggle` arrive APRÈS que le navigateur a changé
 * l'état, il faut recopier l'état réel et non l'inverser, sous peine de
 * boucle de rendu.
 */
function onToggle(event: Event) {
  const isOpen = (event.target as HTMLDetailsElement).open
  if (isOpen !== open.value) panels.toggle(props.id)
}
</script>

<template>
  <details class="fr-accordion ds-stats__panel" :open="open" @toggle="onToggle">
    <summary class="fr-accordion__btn">
      {{ title }}
      <small v-if="subtitle" class="fr-hint-text">{{ subtitle }}</small>
    </summary>
    <div class="fr-accordion__inner">
      <DsfrAlert v-if="error" type="error" small :description="error" />
      <slot v-else />
    </div>
  </details>
</template>
