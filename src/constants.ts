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

/**
 * Raccourcis clavier de la page de recherche, source unique pour ses
 * trois consommateurs : l'aide (`SearchHelp`), la palette
 * (`ShortcutsModal`) et les infobulles posées sur les commandes.
 *
 * Cette liste doit rester exactement celle que branche
 * `useSearchShortcuts` — une aide qui décrit une touche inopérante est
 * pire que pas d'aide. La centraliser ici rend cette règle vérifiable
 * d'un coup d'œil plutôt qu'en comparant deux fichiers.
 */
export type Shortcut = {
  /** Libellé de la touche, tel qu'affiché dans un <kbd>. */
  keys: string
  label: string
  /**
   * Valeur de l'attribut `aria-keyshortcuts` de la commande
   * correspondante. Absente quand aucune commande n'existe à l'écran :
   * la barre de recherche et la pagination sont rendues par vue-dsfr,
   * qui n'offre pas de prise pour les annoter.
   */
  aria?: string
}

export const SHORTCUTS: Shortcut[] = [
  { keys: '/', label: 'Mettre le focus sur la barre de recherche' },
  { keys: 'Échap', label: 'Fermer le menu ou la fenêtre ouverte' },
  { keys: '← / →', label: 'Page de résultats précédente / suivante' },
  { keys: 'c', label: 'Basculer la vue compacte des résultats', aria: 'c' },
  { keys: 'f', label: 'Afficher ou masquer la colonne de filtres', aria: 'f' },
  { keys: 't', label: 'Replier ou déplier toutes les facettes', aria: 't' },
  { keys: '1 … 9', label: 'Replier ou déplier la facette correspondante' },
  { keys: 's', label: 'Enregistrer la recherche en cours', aria: 's' },
  { keys: 'r', label: 'Effacer tous les filtres', aria: 'r' },
  { keys: 'n', label: 'Réinitialiser la recherche (requête, filtres et tri)', aria: 'n' },
  { keys: 'h', label: 'Retourner en haut de la page', aria: 'h' },
  { keys: '?', label: 'Afficher les raccourcis clavier', aria: '?' },
]

/**
 * Raccourcis des pages d'administration et de statistiques, sur le même
 * modèle que SHORTCUTS — source unique de la palette, de l'aide
 * administrateur et des infobulles.
 *
 * Les touches communes gardent le SENS qu'elles ont sur la recherche :
 * « t » replie/déplie tout, « h » remonte, « ? » ouvre la palette. Seule
 * « r » diffère — « effacer les filtres » côté recherche, « recharger »
 * ici — parce qu'il n'y a pas de filtre à effacer sur ces pages et que
 * « r » y était déjà publié comme rechargement.
 *
 * « a », que l'administration utilisait pour le repli global, est
 * abandonnée : deux touches pour le même geste selon la page était
 * précisément l'incohérence à corriger.
 */
export const ADMIN_SHORTCUTS: Shortcut[] = [
  { keys: '/', label: 'Chercher une section ou un réglage dans le sommaire', aria: '/' },
  { keys: 's', label: 'Afficher ou masquer le sommaire', aria: 's' },
  { keys: 'r', label: 'Recharger tous les panneaux', aria: 'r' },
  { keys: 't', label: 'Replier ou déplier tous les panneaux', aria: 't' },
  { keys: '1 … 9', label: 'Replier ou déplier le panneau correspondant' },
  { keys: 'h', label: 'Retourner en haut de la page', aria: 'h' },
  { keys: '?', label: 'Afficher les raccourcis clavier', aria: '?' },
  { keys: 'Échap', label: 'Fermer le menu ou la fenêtre ouverte' },
]

/**
 * Touches branchées par la seule page d'administration : « r » pour le
 * rechargement global — la page de statistiques n'en a pas, chaque
 * panneau s'y recharge seul. Publier une touche inopérante est pire que
 * ne rien publier.
 *
 * « / » et « s » n'en font plus partie depuis que la page de
 * statistiques a, elle aussi, un sommaire.
 */
const TOUCHES_ADMIN_SEULEMENT = ['r']

/** Liste publiée par la page de statistiques. */
export const STATS_SHORTCUTS: Shortcut[] = ADMIN_SHORTCUTS.filter(
  (s) => !TOUCHES_ADMIN_SEULEMENT.includes(s.keys),
)

export const SEARCH_IN_LABELS: Record<string, string> = {
  title: 'Titre',
  author: 'Auteur',
  keywords: 'Mots-clés',
  filepath: 'Chemin',
}

export const SORT_LABELS: Record<string, string> = {
  date_created: 'Date de publication',
  date_modified: 'Date de modification',
  filename: 'Nom',
  size: 'Taille',
}

/**
 * Options du sélecteur de tri (l'ordre est celui affiché).
 *
 * `date_created` porte la publication d'un article de flux et la
 * création d'un fichier : trier par cette date était impossible, alors
 * que la carte l'affiche désormais sous « Publié ». Un document qui ne la
 * porte pas — une page web, une ligne de source SQL, dont l'index ne
 * mappe même pas le champ — part en fin de liste, comme pour tout autre
 * tri (`"missing": "_last"` côté API).
 */
export const SORT_OPTIONS = [
  { value: '_score', text: 'Pertinence' },
  { value: 'date_created', text: 'Date de publication' },
  { value: 'date_modified', text: 'Date de modification' },
  { value: 'filename', text: 'Nom' },
  { value: 'size', text: 'Taille' },
]
