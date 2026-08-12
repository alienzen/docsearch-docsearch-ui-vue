/**
 * Branche la recherche sur l'historique du navigateur — voir
 * utils/permalien.ts pour ce que l'URL porte, et le store pour
 * l'écriture (`ecrireUrl`, appelée depuis `doSearch`).
 *
 * Ce composable ne gère que la LECTURE, c'est-à-dire les deux moments où
 * c'est le navigateur qui impose l'état, et non l'utilisateur :
 *
 * - au chargement de la page, quand elle est ouverte depuis un lien
 *   partagé, un signet ou un rechargement (F5) ;
 * - au retour arrière (`popstate`).
 *
 * ⚠️ Le retour arrière relance la recherche en mode `aucun` : le
 * navigateur a déjà changé l'URL, la réécrire empilerait une entrée
 * par retour en arrière — l'utilisateur ne pourrait alors plus jamais
 * sortir de la page en cliquant sur Précédent.
 */

import { onMounted, onUnmounted } from 'vue'
import { useSearchStore } from '@/stores/search'
import { depuisParametres } from '@/utils/permalien'

export function usePermalien() {
  const store = useSearchStore()

  function surRetourArriere() {
    const criteres = depuisParametres(window.location.search)
    if (criteres) {
      store.appliquerCriteres(criteres)
      store.doSearch('aucun')
    } else {
      // Revenu à une URL sans critères : l'écran doit retrouver son état
      // initial, sinon les résultats de la recherche suivante resteraient
      // affichés sous une URL qui ne les décrit plus.
      store.resetSearch('aucun')
    }
  }

  onMounted(() => {
    const criteres = depuisParametres(window.location.search)
    if (criteres) {
      store.appliquerCriteres(criteres)
      // `remplacer` et non `aucun` : une URL écrite à la main
      // (`?q=type:pdf`) est ainsi réécrite sous sa forme canonique, sans
      // ajouter d'entrée d'historique au chargement.
      store.doSearch('remplacer')
    }
    // Une URL sans critères est laissée telle quelle : elle peut porter
    // des paramètres qui ne nous regardent pas, et rien ne justifie de
    // toucher à l'historique avant la première recherche.
    window.addEventListener('popstate', surRetourArriere)
  })

  onUnmounted(() => window.removeEventListener('popstate', surRetourArriere))
}
