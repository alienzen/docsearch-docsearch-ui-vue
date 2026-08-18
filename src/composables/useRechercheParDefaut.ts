/**
 * Joue la recherche configurée par l'administrateur
 * (`default_search`) à l'ouverture de la page de recherche, à la place
 * de l'écran d'accueil.
 *
 * Trois règles, dans cet ordre :
 *
 * 1. Les critères du VISITEUR priment toujours. Arrivé par un permalien,
 *    un signet ou un rechargement, il retrouve SA recherche — c'est
 *    usePermalien qui la relance, et ce composable s'efface. D'où la
 *    lecture de l'URL au montage, avant que quoi que ce soit d'autre ne
 *    se produise.
 * 2. Rien n'est écrasé. La configuration arrive de façon asynchrone
 *    (/ui-config) ; entre le montage et sa réponse, l'utilisateur a pu
 *    taper sa propre recherche, cliquer un exemple ou ouvrir une
 *    recherche enregistrée. On ne joue donc la recherche par défaut que
 *    si l'écran est encore vierge.
 * 3. Elle ne contourne aucun droit. La recherche part du navigateur du
 *    visiteur, authentifiée comme les siennes : deux personnes aux droits
 *    différents ouvrant la même installation voient deux listes
 *    différentes. Ce réglage choisit QUOI chercher, jamais qui a le
 *    droit de le voir.
 *
 * L'URL est réécrite en mode `remplacer` : les résultats affichés sont
 * ainsi décrits par l'adresse — donc partageables et rechargeables — sans
 * qu'une entrée d'historique s'intercale, qui ferait revenir le bouton
 * Précédent sur cette même page au lieu de quitter le site.
 */

import { onMounted, watch } from 'vue'
import { useSearchStore } from '@/stores/search'
import { useUiConfigStore } from '@/stores/uiConfig'
import { depuisParametres } from '@/utils/permalien'

export function useRechercheParDefaut() {
  const store = useSearchStore()
  const uiConfig = useUiConfigStore()

  onMounted(() => {
    // Lu ici et pas dans le `watch` : à l'arrivée de la configuration,
    // usePermalien a déjà pu réécrire l'URL sous sa forme canonique, et
    // une URL vidée entre-temps ne dirait plus comment le visiteur est
    // arrivé.
    const criteresDuVisiteur = depuisParametres(window.location.search) !== null

    // Une seule tentative, quoi qu'il arrive ensuite : un administrateur
    // qui modifie le réglage pendant qu'un visiteur a la page ouverte ne
    // doit pas lui écraser sa recherche en cours.
    let deja = false

    watch(
      () => uiConfig.config.default_search,
      (recherche) => {
        if (deja) return
        const valeur = (recherche || '').trim()
        // Pas encore chargée, ou réglage vide : dans les deux cas il n'y
        // a rien à jouer, et surtout rien à consommer — la configuration
        // peut encore arriver.
        if (!valeur) return
        deja = true
        if (criteresDuVisiteur || store.hasSearched || store.query.trim()) return
        store.query = valeur
        store.searchFromFirstPage('remplacer')
      },
      { immediate: true },
    )
  })
}
