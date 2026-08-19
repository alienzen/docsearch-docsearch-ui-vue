/**
 * Sommaire latéral : forme des sections, forme de l'index et recherche
 * dedans. Partagé par la page d'administration et celle de statistiques.
 *
 * Ce module ne connaît NI l'une NI l'autre : chaque page déclare ses
 * sections (`sections.ts`) et construit son index (`sommaire.ts`), et ce
 * sont ces fichiers-là qui portent les libellés. Ici ne vivent que la
 * mécanique de recherche et l'énumération de l'arbre — les partager est
 * ce qui garantit que « chercher un réglage » se comporte pareil des
 * deux côtés, jusqu'au classement des résultats.
 *
 * Ce qu'un index contient : l'INTERFACE — sections, panneaux, réglages
 * et actions. Pas les données. Chercher le nom d'une source, ou le texte
 * d'une suggestion, n'y mènera donc pas : les panneaux chargent leurs
 * données à l'ouverture, indexer celles-ci supposerait de les avoir
 * toutes chargées, et un index qui ne contiendrait que ce qui a déjà été
 * ouvert donnerait des résultats variables d'une visite à l'autre —
 * pire qu'une absence de résultat.
 */

/**
 * Une entrée de l'arbre du sommaire. Deux niveaux au plus : les
 * `panneaux` d'une section, et rien en dessous.
 *
 * L'administration s'en sert sur deux niveaux (des groupes, qui
 * contiennent des panneaux) ; les statistiques sur un seul, chaque
 * section y ÉTANT un panneau. C'est la seule différence de structure
 * entre les deux sommaires, d'où le champ facultatif plutôt que deux
 * types.
 */
export type Section = {
  /** Identifiant du `<details>`, et clé de pli dans le store. */
  id: string
  titre: string
  panneaux?: Section[]
}

export type NatureEntree = 'groupe' | 'panneau' | 'reglage' | 'action'

export type Entree = {
  /** Ancre visée : identifiant d'un élément de la page. */
  id: string
  libelle: string
  nature: NatureEntree
  /**
   * Panneau qui contient l'entrée. Sert de repli quand l'ancre n'existe
   * pas encore dans le document — un tableau rendu seulement une fois
   * les données chargées, par exemple.
   */
  panneau?: string
  /** « Interface et engagement › Interface », affiché sous le libellé. */
  chemin: string
  /** Cherché mais non affiché : synonymes et mots du texte d'aide. */
  motsCles?: string
}

/**
 * Les entrées que l'arbre fournit gratuitement : une par section, une
 * par panneau. Une section sans panneaux est elle-même un panneau — sur
 * les statistiques, l'arbre est plat.
 */
export function entreesDesSections(sections: Section[]): Entree[] {
  const entrees: Entree[] = []
  for (const section of sections) {
    const panneaux = section.panneaux ?? []
    if (!panneaux.length) {
      entrees.push({
        id: section.id,
        libelle: section.titre,
        nature: 'panneau',
        panneau: section.id,
        chemin: '',
      })
      continue
    }
    entrees.push({ id: section.id, libelle: section.titre, nature: 'groupe', chemin: '' })
    for (const panneau of panneaux) {
      entrees.push({
        id: panneau.id,
        libelle: panneau.titre,
        nature: 'panneau',
        panneau: panneau.id,
        chemin: section.titre,
      })
    }
  }
  return entrees
}

/**
 * Chemin affiché sous le libellé d'une entrée : « Interface et
 * engagement › Interface » pour un panneau de second niveau, le seul
 * titre du panneau quand l'arbre est plat.
 */
export function cheminDe(sections: Section[], idPanneau: string): string {
  for (const section of sections) {
    if (section.id === idPanneau) return section.titre
    const panneau = section.panneaux?.find((p) => p.id === idPanneau)
    if (panneau) return `${section.titre} › ${panneau.titre}`
  }
  return ''
}

/**
 * Casse, accents et ponctuation écartés, sur la saisie comme sur les
 * libellés. La ponctuation devient une espace des DEUX côtés : sans
 * cela, « droits d'accès » ne trouverait pas « Droits d’accès » (deux
 * apostrophes différentes) et « pied de page » raterait un libellé qui
 * finit par « … « recherche » ».
 */
export function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Pertinence d'une entrée pour des jetons déjà normalisés. Zéro dès
 * qu'un jeton ne porte nulle part : on restreint, on n'élargit pas —
 * « alerte recherche » doit donner moins de résultats que « alerte », pas
 * plus.
 */
function pertinence(entree: Entree, jetons: string[]): number {
  const libelle = normaliser(entree.libelle)
  const reste = `${normaliser(entree.chemin)} ${normaliser(entree.motsCles ?? '')}`
  let total = 0
  for (const jeton of jetons) {
    if (libelle === jeton) total += 8
    else if (libelle.startsWith(jeton) || libelle.includes(` ${jeton}`)) total += 4
    else if (libelle.includes(jeton)) total += 2
    else if (reste.includes(jeton)) total += 1
    else return 0
  }
  return total
}

/** Au-delà, la liste ne se lit plus — voir `total` pour ce qui est écarté. */
export const MAX_RESULTATS = 12

export type Resultats = { entrees: Entree[]; total: number }

export function chercher(index: Entree[], saisie: string): Resultats {
  const jetons = normaliser(saisie).split(' ').filter(Boolean)
  if (!jetons.length) return { entrees: [], total: 0 }

  const notees = index
    .map((entree, rang) => ({ entree, rang, note: pertinence(entree, jetons) }))
    .filter((candidat) => candidat.note > 0)
    // À note égale, l'ordre de déclaration : c'est celui de la page.
    .sort((a, b) => b.note - a.note || a.rang - b.rang)

  return {
    entrees: notees.slice(0, MAX_RESULTATS).map((candidat) => candidat.entree),
    total: notees.length,
  }
}
