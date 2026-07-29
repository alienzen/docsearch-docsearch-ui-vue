// Portage de docsearch-ui/public/js/constants.js — uniquement ce qui a
// survécu au passage à DSFR. Les ~20 constantes ICON_* (SVG en ligne) et
// les palettes EXT_COLORS/SOURCE_PALETTE n'ont pas été reprises : les
// icônes viennent désormais des classes `fr-icon-*` et les couleurs des
// jetons DSFR, seuls garants de la conformité et du contraste en thème
// clair comme sombre.

export const PER_PAGE = 10

/**
 * Plafond de comptage d'Elasticsearch. `/search` renvoie
 * `hits.total.value` sans passer `track_total_hits` (voir
 * search_api.py) : au-delà de 10 000 documents correspondants, le moteur
 * cesse de compter et renvoie exactement 10 000, en signalant « au
 * moins » dans un champ `relation` que l'API ne transmet pas.
 *
 * Un total ÉGAL à cette valeur est donc à lire comme « 10 000 ou
 * davantage », jamais comme un décompte exact — et il ne peut jamais la
 * dépasser.
 */
export const TOTAL_HITS_CAP = 10000

export const SEARCH_IN_LABELS: Record<string, string> = {
  title: 'Titre',
  author: 'Auteur',
  keywords: 'Mots-clés',
  filepath: 'Chemin',
}

export const SORT_LABELS: Record<string, string> = {
  date_modified: 'Date de modification',
  filename: 'Nom',
  size: 'Taille',
}

/** Options du sélecteur de tri (l'ordre est celui affiché). */
export const SORT_OPTIONS = [
  { value: '_score', text: 'Pertinence' },
  { value: 'date_modified', text: 'Date de modification' },
  { value: 'filename', text: 'Nom' },
  { value: 'size', text: 'Taille' },
]
