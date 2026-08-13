<script setup lang="ts">
/**
 * Case « Recherche exacte », à côté de la barre de recherche.
 *
 * Deuxième chemin vers un seul et même critère : l'opérateur `exact:`
 * tapé dans la barre coche cette case (voir ADVANCED_QUERY_MODES dans
 * api/search.ts), et la case produit exactement la même recherche que
 * l'opérateur. Il n'y a donc rien à synchroniser entre les deux — ils
 * écrivent tous les deux dans `store.exact`, qui part dans le corps de
 * la requête ET dans le permalien.
 *
 * Cocher ou décocher RELANCE la recherche quand il y en a une à
 * l'écran : c'est un critère, pas une préférence d'affichage, et le
 * laisser sans effet jusqu'au prochain Entrée afficherait des résultats
 * qui ne correspondent plus à ce que la case annonce. Rien n'est lancé
 * tant qu'aucune recherche n'a eu lieu — cocher la case sur un écran
 * vide ne doit pas déclencher de recherche vide.
 *
 * Retour à la première page, comme tout changement de critère : rester
 * page 4 d'un résultat qui vient de rétrécir est le meilleur moyen de
 * tomber sur un écran vide. Et `remplacer` plutôt qu'`empiler`, comme
 * une facette ou un tri : on affine une recherche déjà à l'écran, et
 * empiler une entrée d'historique par basculement obligerait à cliquer
 * autant de fois sur Précédent pour sortir de la page.
 */
import { useSearchStore } from '@/stores/search'

const store = useSearchStore()

function basculer(event: Event) {
  store.exact = (event.target as HTMLInputElement).checked
  if (store.hasSearched) store.searchFromFirstPage()
}
</script>

<template>
  <!-- L'explication tient dans `title` et non dans un `fr-hint-text`
       visible : ces outils d'en-tête sont une bande compacte à côté de la
       barre de recherche (voir .ds-header__controls), où deux lignes de
       texte d'aide décaleraient tout le reste. Même choix que le bouton
       « Réinitialiser » voisin. Le détail complet est dans l'aide en
       ligne, section « Recherche exacte ». -->
  <div
    class="fr-checkbox-group fr-checkbox-group--sm ds-exact"
    title="Chercher les mots tels qu'écrits — sans variantes, sans synonymes et sans tolérance aux fautes. Les accents et les majuscules restent ignorés."
  >
    <input id="recherche-exacte" type="checkbox" :checked="store.exact" @change="basculer" />
    <label class="fr-label" for="recherche-exacte">Recherche exacte</label>
  </div>
</template>
