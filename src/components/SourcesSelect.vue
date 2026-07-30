<script setup lang="ts">
/**
 * Présélection de sources AVANT recherche, à côté de la barre de
 * recherche dans l'en-tête. Portage de renderSourcesPanel() /
 * updateSourcesButtonLabel() (docsearch-ui/public/js/config.js).
 *
 * Complète la facette « Source » de la colonne de gauche (qui n'apparaît
 * qu'APRÈS une recherche, dérivée des résultats) : les deux écrivent
 * dans le même `store.source`, donc une sélection faite ici reste
 * reflétée là-bas, sans code de synchronisation.
 *
 * S'appuie sur <details>/<summary> natif : ouverture au clavier et
 * sémantique de divulgation sans code.
 */
import { computed, ref } from 'vue'
import { useSearchStore } from '@/stores/search'
import { useUiConfigStore } from '@/stores/uiConfig'
import { useOutsideClose } from '@/composables/useOutsideClose'

const store = useSearchStore()
const uiConfig = useUiConfigStore()

/**
 * Le panneau reste NON contrôlé — l'état vit dans l'attribut `open` du
 * <details>, et on ne fait que le forcer à false. Le lier à un `ref`
 * réactif tout en écoutant `toggle` provoque la boucle de rendu déjà
 * rencontrée sur les facettes : le `:open` réagit à ce que le navigateur
 * vient de faire et relance un `toggle`.
 *
 * Un <details> ne se ferme ni au clic extérieur ni à Échap de lui-même,
 * contrairement à <dialog> : d'où le composable.
 */
const panel = ref<HTMLDetailsElement | null>(null)

useOutsideClose(
  panel,
  () => panel.value?.open ?? false,
  () => {
    if (panel.value) panel.value.open = false
  },
)

/** Le libellé du bouton résume la sélection courante. */
const label = computed(() => {
  const count = store.source.length
  if (!count) return 'Toutes les sources'
  if (count === 1) return uiConfig.sourceLabel(store.source[0])
  return `${count} sources`
})

function toggle(name: string) {
  store.source = store.source.includes(name)
    ? store.source.filter((s) => s !== name)
    : [...store.source, name]
}
</script>

<template>
  <details ref="panel" class="ds-sources">
    <summary class="fr-btn fr-btn--secondary fr-btn--sm">{{ label }}</summary>
    <div class="ds-sources__panel">
      <p v-if="!uiConfig.allSources.length" class="fr-hint-text fr-mb-0">
        Aucune source disponible
      </p>
      <div v-else class="fr-fieldset__content">
        <div
          v-for="src in uiConfig.allSources"
          :key="src.name"
          class="fr-checkbox-group fr-checkbox-group--sm"
        >
          <input
            :id="`source-${src.name}`"
            type="checkbox"
            :checked="store.source.includes(src.name)"
            @change="toggle(src.name)"
          />
          <label class="fr-label" :for="`source-${src.name}`">{{ src.label }}</label>
        </div>
      </div>
    </div>
  </details>
</template>
