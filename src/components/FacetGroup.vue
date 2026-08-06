<script setup lang="ts">
/**
 * Une facette à cases à cocher. Remplace le couple `.facet-section` /
 * `toggleFacetAccordion()` de docsearch-ui.
 *
 * L'accordéon lui-même — repli, persistance, inscription au registre —
 * appartient à FacetSection, partagé avec la période de modification.
 */
import { computed } from 'vue'
import type { FacetBucket } from '@/api/types'

const props = defineProps<{
  /** Identifiant stable, sert de clé de persistance du pli. */
  id: string
  title: string
  buckets: FacetBucket[]
  /** Valeurs actuellement sélectionnées, pour cocher les cases. */
  selected: string[]
  /** Message affiché quand la facette ne renvoie rien. */
  emptyLabel: string
  /**
   * Précision affichée au-dessus des cases, quand la facette ne se
   * comporte pas comme les autres — aujourd'hui les mots-clés, seule
   * facette combinée en ET côté API.
   */
  hint?: string
  /** Libellé affiché pour une valeur (défaut : la valeur elle-même). */
  labelOf?: (key: string) => string
}>()

const emit = defineEmits<{ toggle: [value: string] }>()

// Les seaux à clé vide sont écartés : Elasticsearch en renvoie pour les
// documents dont le champ n'est pas renseigné, et une ligne de facette
// sans libellé n'est pas cliquable utilement.
const rows = computed(() => props.buckets.filter((b) => b.key !== '' && b.key != null))
</script>

<template>
  <FacetSection :id="id" :title="title">
    <p v-if="!rows.length" class="fr-hint-text fr-mb-0">{{ emptyLabel }}</p>
    <div v-else class="fr-fieldset__content">
      <p v-if="hint" class="fr-hint-text fr-mb-1v">{{ hint }}</p>
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
  </FacetSection>
</template>
