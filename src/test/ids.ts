import type { VueWrapper } from '@vue/test-utils'

/**
 * Détection des identifiants dupliqués dans une page montée.
 *
 * Un `id` doit être unique dans le document : deux éléments qui le
 * partagent cassent silencieusement `label for` et `aria-controls`, qui
 * ne désignent alors plus que le premier. Le cas se produit dès qu'un
 * `id` littéral est posé à l'intérieur d'un `v-for`.
 *
 * ⚠️ Le contrôle ne prouve quelque chose que si les réponses bouchonnées
 * comportent AU MOINS DEUX entrées par liste. Avec une seule, une
 * duplication dans une boucle ne se manifeste jamais et le test passe au
 * vert sans rien vérifier.
 *
 * Deux racines sont balayées, et il en faut bien deux :
 *
 * - l'arbre du composant — par défaut, `vue-test-utils` monte dans un
 *   `<div>` **détaché**, jamais rattaché à `document.body` (vérifié :
 *   après `mount()`, `document.body.children.length` vaut 0) ;
 * - `document.body` — où atterrissent les modales, qui sont téléportées
 *   (`<Teleport to="body">`) et sortent donc de l'arbre du composant tout
 *   en pouvant parfaitement entrer en collision avec lui.
 *
 * Les éléments sont dédoublonnés dans un Set avant d'être comptés : avec
 * `attachTo: document.body` — nécessaire dès qu'un composant cherche sa
 * cible de téléportation avec `document.querySelector` — les deux racines
 * se recouvrent, et un comptage naïf déclarerait TOUS les identifiants en
 * double.
 */
function racines(wrapper: VueWrapper): ParentNode[] {
  const element = wrapper.element as Element
  // `parentElement` et non `element` : une page a plusieurs nœuds racines
  // (en-tête, contenu, pied de page…), et `wrapper.element` n'en désigne
  // qu'un. Le conteneur de montage les porte tous.
  return [element.parentElement ?? element, document.body]
}

function compter(wrapper: VueWrapper): Map<string, number> {
  const elements = new Set<Element>()
  for (const racine of racines(wrapper)) {
    if (racine instanceof Element && racine.id) elements.add(racine)
    for (const element of racine.querySelectorAll('[id]')) elements.add(element)
  }

  const comptes = new Map<string, number>()
  for (const element of elements) {
    if (element.id) comptes.set(element.id, (comptes.get(element.id) ?? 0) + 1)
  }
  return comptes
}

/** Les identifiants portés par plus d'un élément, triés. */
export function idsDupliques(wrapper: VueWrapper): string[] {
  return [...compter(wrapper)]
    .filter(([, n]) => n > 1)
    .map(([id]) => id)
    .sort()
}

/** Tous les identifiants présents, triés — inventaire d'une page. */
export function idsPresents(wrapper: VueWrapper): string[] {
  return [...compter(wrapper).keys()].sort()
}
