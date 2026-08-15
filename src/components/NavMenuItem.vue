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
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useOutsideClose } from '@/composables/useOutsideClose'
import { useFermetureProgressive } from '@/composables/useFermetureProgressive'

const props = defineProps<{
  /**
   * Identifiant de l'entrée dans le document, d'où sont dérivés ceux du
   * bouton et du menu. Explicite et non plus tiré de `useId()` : celui-ci
   * rend un jeton opaque, dépendant de l'ordre de montage, donc inutile
   * comme point d'accroche et instable dès qu'une entrée devient
   * conditionnelle.
   */
  id: string
  label: string
  /** Compteur affiché en badge, masqué à zéro. */
  badge?: string | number | null
}>()

const emit = defineEmits<{ open: [] }>()

const buttonId = computed(() => `${props.id}-bouton`)
const menuId = computed(() => `${props.id}-menu`)
const open = ref(false)
/** Vrai le temps du fondu de fermeture — voir `.fr-menu` dans app.css. */
const fermeture = useFermetureProgressive(open)
const item = ref<HTMLElement | null>(null)
const menu = ref<HTMLElement | null>(null)
/** Vrai quand le menu est aligné sur le bord DROIT de son entrée. */
const alignRight = ref(false)

function toggle() {
  open.value = !open.value
  if (open.value) emit('open')
}

/**
 * Le menu est plus large qu'une entrée de navigation (il porte des puces
 * de critères, des cases à cocher…). Aligné à gauche, celui des
 * dernières entrées sortirait de l'écran.
 *
 * Calculé au montage et au redimensionnement, PAS seulement à
 * l'ouverture : un `.fr-collapse` replié garde sa largeur (seule sa
 * hauteur est ramenée à zéro) et, positionné en absolu, il élargit la
 * page même fermé.
 */
async function updateAlignment() {
  alignRight.value = false
  await nextTick()
  const left = item.value?.getBoundingClientRect().left ?? 0
  const width = menu.value?.offsetWidth ?? 0
  alignRight.value = left + width > document.documentElement.clientWidth
}

// Fermeture au clic extérieur et à Échap, partagée avec le panneau de
// présélection des sources (SourcesSelect).
useOutsideClose(
  item,
  () => open.value,
  () => (open.value = false),
)

onMounted(() => {
  window.addEventListener('resize', updateAlignment)
  updateAlignment()
})
onBeforeUnmount(() => window.removeEventListener('resize', updateAlignment))

defineExpose({ close: () => (open.value = false), open: () => (open.value = true) })
</script>

<template>
  <li :id="id" ref="item" class="fr-nav__item">
    <button
      :id="buttonId"
      class="fr-nav__btn"
      :aria-expanded="open"
      :aria-controls="menuId"
      type="button"
      @click="toggle"
    >
      {{ label }}
      <span v-if="badge" class="fr-badge fr-badge--sm fr-badge--error fr-ml-1v">{{ badge }}</span>
    </button>

    <div
      :id="menuId"
      ref="menu"
      class="fr-collapse fr-menu"
      :class="{
        'fr-collapse--expanded': open,
        'fr-collapsing': fermeture,
        'ds-menu--right': alignRight,
      }"
    >
      <ul class="fr-menu__list">
        <slot />
      </ul>
    </div>
  </li>
</template>
