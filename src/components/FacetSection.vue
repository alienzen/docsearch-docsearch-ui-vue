<script setup lang="ts">
/**
 * Coquille d'une section de facettes : l'accordéon repliable, son état
 * persisté, et son inscription au registre des sections présentes.
 *
 * Extraite de FacetGroup pour que la période de modification — dont le
 * corps n'est pas une liste de cases à cocher — se replie exactement
 * comme les autres sans dupliquer cette mécanique. Le `onToggle`
 * ci-dessous porte un piège coûteux : il ne doit exister qu'ici.
 *
 * `<details>`/`<summary>` natif plutôt qu'un bouton et une classe CSS :
 * accessible au clavier et aux lecteurs d'écran sans code
 * supplémentaire, contrairement au <div onclick> de docsearch-ui.
 */
import { onBeforeUnmount, onMounted, computed } from 'vue'
import { usePreferencesStore } from '@/stores/preferences'

const props = defineProps<{
  /** Identifiant stable, clé de persistance du pli. */
  id: string
  title: string
}>()

const preferences = usePreferencesStore()

const open = computed(() => !preferences.isFacetCollapsed(props.id))

/** Chiffre du raccourci qui replie cette facette — voir CollapsiblePanel. */
const shortcutDigit = computed(() => {
  const i = preferences.presentFacets.indexOf(props.id)
  return i >= 0 && i < 9 ? String(i + 1) : null
})

/**
 * `toggle` est émis APRÈS que le navigateur a changé l'état du
 * <details>. Il faut donc recopier l'état réel de l'élément, et non
 * inverser la préférence : inverser rouvrirait ce que le navigateur
 * vient de fermer, et le `:open` réactif relancerait un `toggle` — soit
 * une boucle infinie qui fige l'onglet.
 */
function onToggle(event: Event) {
  const isOpen = (event.target as HTMLDetailsElement).open
  if (isOpen !== open.value) preferences.toggleFacetSection(props.id)
}

// Le registre sert à « tout replier » : il doit refléter ce qui est
// réellement monté, d'où l'inscription ici plutôt qu'une liste écrite à
// la main quelque part — les facettes personnalisées vont et viennent
// avec les sources interrogées.
onMounted(() => preferences.registerFacet(props.id))
onBeforeUnmount(() => preferences.unregisterFacet(props.id))
</script>

<template>
  <details class="fr-accordion ds-facet" :open="open" @toggle="onToggle">
    <!-- Même raison que dans CollapsiblePanel : le DSFR fait pivoter le
         chevron sur .fr-accordion__btn[aria-expanded=true], et l'attribut
         natif `open` de <details> ne déclenche pas cette règle. -->
    <summary
      class="fr-accordion__btn"
      :aria-expanded="open"
      :title="shortcutDigit ? `${title} — replier ou déplier (${shortcutDigit})` : title"
      :aria-keyshortcuts="shortcutDigit || undefined"
    >
      {{ title }}
    </summary>
    <div class="fr-accordion__inner">
      <slot />
    </div>
  </details>
</template>
