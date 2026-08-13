import { onBeforeUnmount, onMounted } from 'vue'

/**
 * Pose `autocomplete="off"` sur les barres de recherche de l'en-tête.
 *
 * Sans cet attribut, la liste des saisies mémorisées par le navigateur
 * s'ouvre par-dessus nos propres suggestions (voir SearchSuggestions) :
 * deux listes concurrentes sur le même champ, dont une seule répond aux
 * flèches du clavier.
 *
 * Pourquoi impérativement : l'input appartient à `DsfrSearchBar`, dont
 * les props se bornent à `id`, `label`, `placeholder` et consorts. Ses
 * attributs de repli atterrissent sur le `<form>` racine, jamais sur le
 * champ. C'est déjà pour cette raison que SearchSuggestions annote le
 * même input à la main.
 *
 * Pourquoi un observateur plutôt qu'une passe unique : l'en-tête du
 * DSFR porte DEUX barres. Celle de bureau existe dès le montage, mais
 * celle du modal mobile n'est rendue qu'à l'ouverture du modal et
 * démontée à sa fermeture (`v-if` interne à DsfrHeader) — une passe au
 * montage ne l'atteindrait jamais.
 */
export function useAutocompleteOff() {
  let observer: MutationObserver | undefined

  function couper(racine: ParentNode) {
    for (const input of racine.querySelectorAll('.fr-search-bar input')) {
      input.setAttribute('autocomplete', 'off')
    }
  }

  onMounted(() => {
    const header = document.querySelector('header.fr-header')
    if (!header) return
    couper(header)
    // `childList` seul : les mutations d'attributs ne sont pas observées,
    // donc nos propres `setAttribute` ne peuvent pas relancer le rappel.
    observer = new MutationObserver(() => couper(header))
    observer.observe(header, { childList: true, subtree: true })
  })

  onBeforeUnmount(() => observer?.disconnect())
}
