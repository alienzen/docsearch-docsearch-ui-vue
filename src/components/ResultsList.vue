<script setup lang="ts">
/**
 * Liste des résultats et pagination. Portage de renderResults() et
 * renderPagination() (docsearch-ui/public/js/results.js).
 */
import { computed, ref, watch } from 'vue'
import { useSearchStore } from '@/stores/search'
import { usePreferencesStore } from '@/stores/preferences'
import { useSelectionStore } from '@/stores/selection'

const emit = defineEmits<{ detail: [string] }>()

const store = useSearchStore()
const preferences = usePreferencesStore()
// La sélection vit dans un store : la barre de sélection et la modale
// de collection en ont besoin autant que cette liste.
const selection = useSelectionStore()

/**
 * Basculer la vue compacte doit donner une vue UNIFORME, en écrasant
 * les déplis individuels faits entre-temps. En vanilla, une boucle
 * repassait sur chaque carte ; ici, changer cette clé remonte les
 * cartes, qui repartent donc de l'état initial dicté par la préférence.
 */
const cardsKey = ref(0)
watch(() => preferences.resultsCompact, () => cardsKey.value++)

// La sélection ne survit pas à un changement de page : les cases
// affichées ne correspondraient plus aux documents cochés.
watch(() => store.page, () => selection.clear())

const pages = computed(() => store.totalPages)

/**
 * Liste des pages passée à DsfrPagination — un `computed`, PAS un
 * `Array.from(...)` écrit dans le template : celui-ci recréerait un
 * tableau à chaque rendu, et le composant, qui surveille cette prop,
 * redéclencherait un rendu à l'infini (onglet figé, sans erreur en
 * console). Ici la référence ne change que si le nombre de pages change.
 */
const paginationPages = computed(() =>
  Array.from({ length: pages.value }, (_, i) => ({
    label: String(i + 1),
    title: `Page ${i + 1}`,
    href: '#',
  })),
)
</script>

<template>
  <div id="resultats" :class="{ 'ds-results--loading': store.loading && store.results.length }">
    <!-- Attente à écran vide : première recherche, ou reprise après une
         erreur. Passe AVANT le test d'erreur, sinon le message de la
         recherche précédente resterait affiché pendant la suivante.
         `role="status"` porte l'annonce vocale — le cercle seul ne dit
         rien à un lecteur d'écran. -->
    <div
      v-if="store.loading && !store.results.length"
      id="resultats-attente"
      class="ds-loading"
      role="status"
      aria-live="polite"
    >
      <span class="ds-spinner" aria-hidden="true" />
      <p class="fr-text--sm fr-mb-0">Recherche en cours…</p>
    </div>

    <DsfrAlert
      v-else-if="store.error"
      id="resultats-erreur"
      type="error"
      :description="store.error"
      class="fr-mb-2w"
    />

    <!-- Rien avant la première recherche : l'invitation à en lancer une
         est portée par EmptySearchState, au-dessus. Deux messages
         disaient la même chose à quelques lignes d'écart. -->
    <!-- Le message seul ne servait à rien : EmptyResultsHelp y ajoute ce
         que l'API sait proposer (correction, filtre à retirer, autre
         source), et le garde tel quel quand elle n'a rien. -->
    <EmptyResultsHelp v-else-if="store.hasSearched && !store.results.length" />

    <template v-else>
      <ResultCard
        v-for="result in store.results"
        :key="`${cardsKey}-${result.id}`"
        :result="result"
        :selected="selection.has(result.id)"
        class="fr-mb-2w"
        @update:selected="selection.set(result.id, $event)"
        @detail="emit('detail', $event)"
      />

      <DsfrPagination
        v-if="pages > 1"
        id="resultats-pagination"
        :current-page="store.page - 1"
        :pages="paginationPages"
        @update:current-page="store.goToPage($event + 1)"
      />
    </template>
  </div>
</template>
