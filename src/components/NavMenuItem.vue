<script setup lang="ts">
/**
 * Une entrée de la navigation DSFR avec menu déroulant, telle que la
 * produit le site du Système de Design :
 *
 *   <li class="fr-nav__item">
 *     <button class="fr-nav__btn" aria-expanded aria-controls>…</button>
 *     <div class="fr-collapse fr-menu"><ul class="fr-menu__list">…</ul></div>
 *   </li>
 *
 * Le dépli se fait en ajoutant/retirant `fr-collapse--expanded` : le
 * DSFR gère tout le reste en CSS (`--collapse-max-height`, visibilité,
 * positionnement absolu du menu). Nous ne chargeons pas le JS du DSFR —
 * vue-dsfr réimplémente ces interactions côté Vue — donc cette bascule
 * de classe est bien ce qui pilote l'ouverture.
 */
import { onBeforeUnmount, onMounted, ref, useId } from 'vue'

const props = defineProps<{
  label: string
  /** Compteur affiché en badge, masqué à zéro. */
  badge?: string | number | null
}>()

const emit = defineEmits<{ open: [] }>()

const menuId = `menu-${useId()}`
const open = ref(false)
const item = ref<HTMLElement | null>(null)

function toggle() {
  open.value = !open.value
  if (open.value) emit('open')
}

/**
 * Fermeture au clic extérieur et à Échap — c'est ce que faisait
 * docsearch-ui à la main dans init.js, et ce que le JS du DSFR ferait
 * si nous le chargions.
 */
function onDocumentClick(e: MouseEvent) {
  if (open.value && item.value && !item.value.contains(e.target as Node)) open.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value) open.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
})

defineExpose({ close: () => (open.value = false), open: () => (open.value = true) })
</script>

<template>
  <li ref="item" class="fr-nav__item">
    <button
      class="fr-nav__btn"
      :aria-expanded="open"
      :aria-controls="menuId"
      type="button"
      @click="toggle"
    >
      {{ label }}
      <span v-if="badge" class="fr-badge fr-badge--sm fr-badge--error fr-ml-1v">{{ badge }}</span>
    </button>

    <div :id="menuId" class="fr-collapse fr-menu" :class="{ 'fr-collapse--expanded': open }">
      <ul class="fr-menu__list">
        <slot />
      </ul>
    </div>
  </li>
</template>
