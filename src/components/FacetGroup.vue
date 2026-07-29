<script setup lang="ts">
/**
 * Une section de facettes repliable. Remplace le couple
 * `.facet-section` / `toggleFacetAccordion()` de docsearch-ui : le pli
 * est persisté par usePreferencesStore sous la même clé localStorage.
 *
 * Le repli utilise <details>/<summary> natif plutôt qu'un bouton +
 * classe CSS : accessible au clavier et aux lecteurs d'écran sans code
 * supplémentaire, contrairement au <div onclick> d'origine.
 */
import { computed } from 'vue'
import type { FacetBucket } from '@/api/types'
import { usePreferencesStore } from '@/stores/preferences'

const props = defineProps<{
  /** Identifiant stable, sert de clé de persistance du pli. */
  id: string
  title: string
  buckets: FacetBucket[]
  /** Valeurs actuellement sélectionnées, pour cocher les cases. */
  selected: string[]
  /** Message affiché quand la facette ne renvoie rien. */
  emptyLabel: string
  /** Libellé affiché pour une valeur (défaut : la valeur elle-même). */
  labelOf?: (key: string) => string
}>()

const emit = defineEmits<{ toggle: [value: string] }>()

const preferences = usePreferencesStore()

// Les seaux à clé vide sont écartés : Elasticsearch en renvoie pour les
// documents dont le champ n'est pas renseigné, et une ligne de facette
// sans libellé n'est pas cliquable utilement.
const rows = computed(() => props.buckets.filter((b) => b.key !== '' && b.key != null))

const open = computed(() => !preferences.isFacetCollapsed(props.id))

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
</script>

<template>
  <details class="fr-accordion ds-facet" :open="open" @toggle="onToggle">
    <summary class="fr-accordion__btn">{{ title }}</summary>
    <div class="fr-accordion__inner">
      <p v-if="!rows.length" class="fr-hint-text fr-mb-0">{{ emptyLabel }}</p>
      <div v-else class="fr-fieldset__content">
        <div v-for="bucket in rows" :key="bucket.key" class="fr-checkbox-group fr-checkbox-group--sm">
          <input
            :id="`${id}-${bucket.key}`"
            type="checkbox"
            :checked="selected.includes(bucket.key)"
            @change="emit('toggle', bucket.key)"
          />
          <label class="fr-label" :for="`${id}-${bucket.key}`" :title="bucket.key">
            {{ labelOf ? labelOf(bucket.key) : bucket.key }}
            <span class="ds-facet__count">{{ bucket.doc_count.toLocaleString('fr-FR') }}</span>
          </label>
        </div>
      </div>
    </div>
  </details>
</template>
