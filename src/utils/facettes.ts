/**
 * Quelles facettes fixes ont un sens pour les sources sélectionnées.
 *
 * Les cinq facettes fixes de la colonne de gauche décrivent des
 * documents de fichiers : extension, auteur, mots-clés, dossier, date de
 * modification. Une source SQL (« agents ») ou web n'apporte pas les
 * mêmes champs — chercher dans le seul annuaire affichait jusqu'ici
 * « Type de fichier : aucun type », « Dossier : aucun dossier »… quatre
 * sections vides qui repoussaient vers le bas les facettes réellement
 * utiles, celles de la source.
 *
 * La correspondance se lit sur le TYPE de la source (voir
 * /searchable-sources côté API) :
 *
 *   `file` → les cinq (indexer.py les renseigne toutes) ;
 *   `web`  → extension (toujours « html ») et date, seuls champs posés
 *            par web_indexer.py ;
 *   `sql`  → uniquement les colonnes que la source déclare, une source
 *            SQL ayant le droit de mapper `author`, `keywords` ou
 *            `date_modified` comme n'importe quel autre nom de champ ;
 *   `plugin` → ni extension ni dossier, que le contrat lui refuse (voir
 *            ci-dessous).
 *
 * Les facettes SQL personnalisées, elles, n'ont pas besoin de ce
 * traitement : l'API ne les renvoie déjà que pour les sources en jeu.
 */
import type { FacetBucket } from '@/api/types'
import type { SearchableSource } from '@/stores/uiConfig'

export type DimensionFacette = 'ext' | 'author' | 'keywords' | 'folder' | 'date'

const TOUTES: DimensionFacette[] = ['ext', 'author', 'keywords', 'folder', 'date']

/**
 * Champ Elasticsearch derrière chaque dimension — sert à reconnaître les
 * colonnes d'une source SQL. La facette « Dossier » agrège en réalité
 * `folder_top`, dérivé de `folder` par l'ingestion : c'est bien la
 * présence de `folder` qui la rend pertinente.
 */
const CHAMP_ES: Record<DimensionFacette, string> = {
  ext: 'extension',
  author: 'author',
  keywords: 'keywords',
  folder: 'folder',
  date: 'date_modified',
}

function dimensionsDeLaSource(source: SearchableSource): DimensionFacette[] {
  switch (source.type) {
    case 'file':
      return TOUTES
    case 'web':
      return ['ext', 'date']
    case 'sql':
      // `card_fields` porte TOUTES les colonnes déclarées par la source
      // (voir /searchable-sources) ; une valeur vide n'y masque que le
      // libellé dans la carte de résultat, la colonne existe quand même.
      return TOUTES.filter((d) => CHAMP_ES[d] in (source.card_fields || {}))
    case 'plugin':
      // Une source portée par un module complémentaire ne peut porter ni
      // `extension` — le contrat l'écrit VIDE sur tout document poussé,
      // sans exception (documents.py, construire_document) — ni
      // `folder`, qui fait partie des champs réservés qu'un module n'a
      // pas le droit de renseigner. Deux sections vides, sur toute
      // source de module, garanties par le contrat lui-même.
      //
      // Restent les trois champs du schéma commun qu'un module remplit
      // vraiment. `date` est de la liste parce qu'un module PEUT pousser
      // `date_modified` (docsearch-plugin-rss le fait depuis sa 0.1.1) ;
      // celui qui ne le fait pas laisse une section « Période » qui ne
      // filtre rien, faute pour l'interface de pouvoir le deviner —
      // aucune agrégation ne dit si les résultats portent une date.
      //
      // Un module qui poserait de VRAIES extensions n'est pas perdant :
      // le second terme d'`affiche()` rattrape la section dès qu'elle a
      // des seaux non vides.
      return ['author', 'keywords', 'date']
    default:
      // Type inconnu — ou source d'une installation plus récente que
      // cette interface : on affiche tout plutôt que de masquer une
      // facette qui aurait peut-être des valeurs. Même repli tolérant
      // que sourceLabel()/sourceCollectable().
      return TOUTES
  }
}

/**
 * Dimensions à afficher pour une sélection de sources. Sélection vide =
 * recherche fédérée sur tout : toutes les dimensions sont en jeu, ce qui
 * laisse la colonne exactement telle qu'elle était avant cette règle.
 *
 * Une source absente d'`allSources` (registre pas encore chargé, source
 * retirée depuis le permalien) fait retomber sur « tout afficher » : à
 * défaut de savoir, on ne masque rien.
 */
export function dimensionsAffichables(
  selection: string[],
  toutesSources: SearchableSource[],
): Set<DimensionFacette> {
  if (!selection.length) return new Set(TOUTES)
  const dimensions = new Set<DimensionFacette>()
  for (const nom of selection) {
    const source = toutesSources.find((s) => s.name === nom)
    if (!source) return new Set(TOUTES)
    for (const dimension of dimensionsDeLaSource(source)) dimensions.add(dimension)
  }
  return dimensions
}

/**
 * Seaux réellement affichables d'une facette : Elasticsearch en renvoie
 * un à clé vide pour les documents dont le champ n'est pas renseigné, et
 * une ligne de facette sans libellé n'est pas cliquable utilement.
 */
export function seauxAffichables(buckets: FacetBucket[]): FacetBucket[] {
  return buckets.filter((b) => b.key !== '' && b.key != null)
}
