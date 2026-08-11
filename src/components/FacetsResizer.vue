<script setup lang="ts">
/**
 * Poignée de redimensionnement de la colonne de facettes.
 *
 * Un séparateur explicite plutôt que le `resize: horizontal` natif du
 * CSS : ce dernier ne se pilote pas au clavier — donc inaccessible au
 * sens du RGAA — et son grip ne s'affiche qu'en coin bas-droit, là où
 * personne ne le cherche sur une colonne haute.
 *
 * Le déplacement est calculé en DELTA depuis le point de saisie, et non
 * à partir du bord gauche du conteneur : rien à mesurer, et le curseur
 * reste solidaire de la poignée même si la grille est décalée par les
 * marges du conteneur DSFR.
 */
import { onBeforeUnmount, ref } from 'vue'
import {
  usePreferencesStore,
  FACETS_WIDTH_MAX,
  FACETS_WIDTH_MIN,
} from '@/stores/preferences'

const preferences = usePreferencesStore()

/** Pas du pilotage au clavier, en pixels. */
const STEP = 16

const dragging = ref(false)
let startX = 0
let startWidth = 0

function onPointerdown(event: PointerEvent) {
  dragging.value = true
  startX = event.clientX
  startWidth = preferences.facetsWidth
  document.body.classList.add('ds-resizing')
  // La capture garantit de recevoir les `pointermove` même quand le
  // curseur passe au-dessus des résultats, ou sort de la fenêtre.
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function onPointermove(event: PointerEvent) {
  if (!dragging.value) return
  preferences.setFacetsWidth(startWidth + event.clientX - startX)
}

function onPointerup() {
  dragging.value = false
  document.body.classList.remove('ds-resizing')
}

// La classe vit sur <body>, hors du composant : si celui-ci est démonté
// en cours de glissement — repli de la colonne au clavier, nouvelle
// recherche sans résultat — elle resterait posée et figerait le curseur
// et la sélection sur toute la page.
onBeforeUnmount(onPointerup)

function onKeydown(event: KeyboardEvent) {
  switch (event.key) {
    case 'ArrowLeft':
      preferences.setFacetsWidth(preferences.facetsWidth - STEP)
      break
    case 'ArrowRight':
      preferences.setFacetsWidth(preferences.facetsWidth + STEP)
      break
    case 'Home':
      // Retour à la largeur par défaut : sans ça, un utilisateur ayant
      // poussé la colonne à une extrémité devrait la ramener au pas.
      preferences.resetFacetsWidth()
      break
    default:
      return
  }
  event.preventDefault()
}
</script>

<template>
  <div
    id="facettes-poignee"
    class="ds-resizer"
    :class="{ 'ds-resizer--active': dragging }"
    role="separator"
    aria-orientation="vertical"
    aria-controls="facets"
    aria-label="Largeur de la colonne de filtres"
    :aria-valuenow="preferences.facetsWidth"
    :aria-valuemin="FACETS_WIDTH_MIN"
    :aria-valuemax="FACETS_WIDTH_MAX"
    tabindex="0"
    @pointerdown="onPointerdown"
    @pointermove="onPointermove"
    @pointerup="onPointerup"
    @pointercancel="onPointerup"
    @keydown="onKeydown"
  />
</template>
