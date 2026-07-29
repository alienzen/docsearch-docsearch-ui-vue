<script setup lang="ts">
/**
 * Panneau repliable, partagé par les pages de statistiques et
 * d'administration. Portage de panelWrap()/toggleAccordion(), commun aux
 * deux pages d'origine à quelques détails près.
 *
 * Le store est passé en prop plutôt que résolu ici : c'est ce qui permet
 * aux deux pages — et aux deux niveaux de pli de l'administration
 * (groupes et panneaux) — de partager ce composant sans se marcher
 * dessus.
 *
 * S'appuie sur <details>/<summary> natif : accessible au clavier et aux
 * lecteurs d'écran sans code supplémentaire, contrairement au
 * <div onclick> d'origine.
 */
import { computed } from 'vue'

type CollapseStore = {
  isCollapsed: (id: string) => boolean
  toggle: (id: string) => void
}

const props = defineProps<{
  id: string
  title: string
  subtitle?: string
  store: CollapseStore
  /** Message d'erreur, affiché à la place du contenu. */
  error?: string | null
  /** Style « groupe » : titre plus marqué, contenu en retrait. */
  group?: boolean
}>()

const open = computed(() => !props.store.isCollapsed(props.id))

/**
 * `toggle` est émis APRÈS que le navigateur a changé l'état : il faut
 * recopier l'état réel de l'élément et non l'inverser, sous peine de
 * boucle de rendu (l'onglet se fige, sans erreur en console).
 */
function onToggle(event: Event) {
  const isOpen = (event.target as HTMLDetailsElement).open
  if (isOpen !== open.value) props.store.toggle(props.id)
}
</script>

<template>
  <details
    class="fr-accordion ds-panel-block"
    :class="{ 'ds-panel-block--group': group }"
    :open="open"
    @toggle="onToggle"
  >
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
