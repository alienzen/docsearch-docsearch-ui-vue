<script setup lang="ts">
/**
 * Puces des filtres actifs. Portage de renderActiveFilters() /
 * clearFilterAt() (docsearch-ui/public/js/facets.js), qui devait
 * mémoriser les fonctions de retrait dans `window.__clearFns` pour que
 * les `onclick` interpolés dans le HTML puissent les retrouver par
 * index. Ici la puce porte directement sa fonction.
 */
import { useSearchStore } from '@/stores/search'

const store = useSearchStore()
</script>

<template>
  <div v-if="store.activeFilters.length" id="filtres-actifs" class="fr-mb-2w">
    <ul class="fr-tags-group">
      <li v-for="chip in store.activeFilters" :key="chip.label">
        <button
          class="fr-tag fr-tag--dismiss"
          data-testid="filtre-actif"
          :data-filtre="chip.label"
          :aria-label="`Retirer le filtre ${chip.label}`"
          @click="store.clearFilter(chip)"
        >
          {{ chip.label }}
        </button>
      </li>
      <li>
        <DsfrButton
          id="filtres-effacer-tout"
          size="sm"
          tertiary
          no-outline
          label="Effacer tous les filtres"
          title="Effacer tous les filtres (r)"
          aria-keyshortcuts="r"
          @click="store.clearAllFilters()"
        />
      </li>
    </ul>
  </div>
</template>
