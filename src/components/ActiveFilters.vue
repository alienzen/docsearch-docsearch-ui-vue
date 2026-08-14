<script setup lang="ts">
/**
 * Puces des filtres actifs. Portage de renderActiveFilters() /
 * clearFilterAt() (docsearch-ui/public/js/facets.js), qui devait
 * mémoriser les fonctions de retrait dans `window.__clearFns` pour que
 * les `onclick` interpolés dans le HTML puissent les retrouver par
 * index. Ici la puce porte directement sa fonction.
 */
import { computed } from 'vue'
import { useSearchStore } from '@/stores/search'

const store = useSearchStore()

/**
 * Les puces décrivent les filtres appliqués aux résultats AFFICHÉS :
 * tant qu'aucune recherche n'a été lancée, elles n'ont rien à décrire.
 * Sans cette condition, présélectionner une source dans le menu de
 * l'en-tête (SourcesSelect écrit dans `store.source` sans chercher)
 * faisait apparaître une puce sous l'animation d'accueil, laissant
 * croire qu'un résultat venait d'être filtré.
 *
 * `store.loading` autant que `store.hasSearched`, comme pour
 * l'invitation d'EmptySearchState : hasSearched ne passe à true
 * qu'APRÈS la réponse du serveur, et les puces manqueraient pendant
 * tout le premier appel.
 */
const visible = computed(
  () => store.activeFilters.length > 0 && (store.hasSearched || store.loading),
)
</script>

<template>
  <div v-if="visible" id="filtres-actifs" class="fr-mb-2w">
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
