/**
 * Index de recherche du sommaire de la page d'administration.
 *
 * Ce que cet index contient : l'INTERFACE — groupes, panneaux, réglages
 * et actions. Pas les données. Chercher le nom d'une source n'y mènera
 * donc pas : les panneaux chargent leurs données à l'ouverture, indexer
 * celles-ci supposerait de les avoir toutes chargées, et un index qui ne
 * contiendrait que ce qui a déjà été ouvert donnerait des résultats
 * variables d'une visite à l'autre — pire qu'une absence de résultat.
 *
 * D'où viennent les entrées, par ordre de coût :
 *  - groupes et panneaux : de `sections.ts`, gratuitement ;
 *  - réglages : des tableaux déjà déclarés par les panneaux
 *    (`components/admin/champs.ts`), donc sans recopier un seul libellé ;
 *  - actions : écrites ci-dessous, pour ce qui n'est pas déclaratif.
 *
 * Le balayage du DOM a été écarté : il n'indexerait que ce qui est
 * monté, n'offrirait aucun endroit où poser des synonymes, et ramasserait
 * les données dynamiques au milieu des libellés d'interface.
 */
import { BASCULES_ENGAGEMENT, BASCULES_UI, CHAMPS_TEXTE_UI } from '@/components/admin/champs'
import { SECTIONS, groupeDuPanneau } from './sections'

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
 * Ce qui n'est pas déclaré sous forme de tableau dans son panneau :
 * boutons, titres de sous-section, champs isolés. `motsCles` porte les
 * termes qu'on tape sans qu'ils figurent dans le libellé — « réindexer »
 * pour un scan, « couleur » pour le thème.
 */
const ACTIONS: { id: string; libelle: string; panneau: string; motsCles?: string }[] = [
  { id: 'status-versions-titre', libelle: 'Versions déployées', panneau: 'status-panel' },
  {
    id: 'filesources-nouvelle',
    libelle: 'Ajouter une source fichiers',
    panneau: 'filesources-panel',
    motsCles: 'nouvelle répertoire dossier partage',
  },
  {
    id: 'filetypes-ajouter',
    libelle: 'Ajouter un type de fichier',
    panneau: 'filetypes-panel',
    motsCles: 'extension pdf docx xlsx taille maximale',
  },
  {
    id: 'filetypes-defauts',
    libelle: 'Rétablir les types de fichiers par défaut',
    panneau: 'filetypes-panel',
  },
  {
    id: 'pathfilters-exclure',
    libelle: 'Exclure un sous-dossier',
    panneau: 'pathfilters-panel',
    motsCles: 'motif glob exclusion',
  },
  {
    id: 'pathfilters-inclure',
    libelle: 'Inclure un sous-dossier',
    panneau: 'pathfilters-panel',
    motsCles: 'motif glob inclusion',
  },
  {
    id: 'pathfilters-apercu',
    libelle: 'Aperçu avant purge des documents filtrés',
    panneau: 'pathfilters-panel',
    motsCles: 'supprimer nettoyer',
  },
  {
    id: 'scan-lancer',
    libelle: 'Lancer un scan',
    panneau: 'scan-panel',
    motsCles: 'réindexer indexation moissonnage',
  },
  {
    id: 'doublons-recalculer',
    libelle: 'Recalculer les empreintes de contenu',
    panneau: 'duplicates-panel',
    motsCles: 'hash checksum doublons',
  },
  {
    id: 'sqlsources-nouvelle',
    libelle: 'Ajouter une source SQL',
    panneau: 'sqlsources-panel',
    motsCles: 'postgresql mysql requête',
  },
  {
    id: 'sqlsources-dsn-titre',
    libelle: 'DSN chiffrés',
    panneau: 'sqlsources-panel',
    motsCles: 'connexion base identifiants mot de passe',
  },
  {
    id: 'websources-nouvelle',
    libelle: 'Ajouter une source web',
    panneau: 'websources-panel',
    motsCles: 'crawler crawl site intranet',
  },
  {
    id: 'synonymes-ajouter',
    libelle: 'Ajouter un synonyme',
    panneau: 'synonyms-panel',
    motsCles: 'thésaurus équivalence',
  },
  {
    id: 'synonymes-tester',
    libelle: "Tester l'analyse d'une requête",
    panneau: 'synonyms-panel',
    motsCles: 'jetons tokens analyse',
  },
  {
    id: 'epingles-requete',
    libelle: 'Épingler des documents sur une requête',
    panneau: 'pinned-panel',
    motsCles: 'mise en avant résultat',
  },
  {
    id: 'ui-config-theme-recherche',
    libelle: 'Thème — Recherche',
    panneau: 'ui-config-panel',
    motsCles: 'apparence couleur clair sombre',
  },
  {
    id: 'ui-config-theme-admin',
    libelle: 'Thème — Administration',
    panneau: 'ui-config-panel',
    motsCles: 'apparence couleur clair sombre',
  },
  {
    id: 'ui-config-textes-titre',
    libelle: 'Personnalisation des textes',
    panneau: 'ui-config-panel',
    motsCles: 'logo titre pied de page favicon',
  },
  {
    id: 'config-defauts',
    libelle: 'Charger les paramètres par défaut',
    panneau: 'config-panel',
  },
]

/** « Interface et engagement › Interface » pour un panneau donné. */
function chemin(idPanneau: string): string {
  const groupe = groupeDuPanneau(idPanneau)
  if (!groupe) return ''
  const panneau = groupe.panneaux.find((p) => p.id === idPanneau)
  return panneau ? `${groupe.titre} › ${panneau.titre}` : groupe.titre
}

export function construireIndex(): Entree[] {
  const entrees: Entree[] = []

  for (const groupe of SECTIONS) {
    entrees.push({ id: groupe.id, libelle: groupe.titre, nature: 'groupe', chemin: '' })
    for (const panneau of groupe.panneaux) {
      entrees.push({
        id: panneau.id,
        libelle: panneau.titre,
        nature: 'panneau',
        panneau: panneau.id,
        chemin: groupe.titre,
      })
    }
  }

  for (const bascule of BASCULES_UI) {
    entrees.push({
      id: `ui-${bascule.key}`,
      libelle: bascule.label,
      nature: 'reglage',
      panneau: 'ui-config-panel',
      chemin: chemin('ui-config-panel'),
    })
  }

  for (const champ of CHAMPS_TEXTE_UI) {
    entrees.push({
      id: `ui-${champ.key}`,
      libelle: champ.label,
      nature: 'reglage',
      panneau: 'ui-config-panel',
      chemin: chemin('ui-config-panel'),
      motsCles: champ.hint,
    })
  }

  for (const bascule of BASCULES_ENGAGEMENT) {
    entrees.push({
      id: `eng-${bascule.key}`,
      libelle: bascule.label,
      nature: 'reglage',
      panneau: 'engagement-panel',
      chemin: chemin('engagement-panel'),
    })
  }

  for (const action of ACTIONS) {
    entrees.push({
      id: action.id,
      libelle: action.libelle,
      nature: 'action',
      panneau: action.panneau,
      chemin: chemin(action.panneau),
      motsCles: action.motsCles,
    })
  }

  return entrees
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
