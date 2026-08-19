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
 *
 * La recherche elle-même vit dans `utils/sommaire.ts`, partagée avec la
 * page de statistiques.
 */
import { BASCULES_ENGAGEMENT, BASCULES_UI, CHAMPS_TEXTE_UI } from '@/components/admin/champs'
import { cheminDe, entreesDesSections, type Entree } from '@/utils/sommaire'
import { SECTIONS } from './sections'

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

export function construireIndex(): Entree[] {
  const entrees: Entree[] = entreesDesSections(SECTIONS)

  for (const bascule of BASCULES_UI) {
    entrees.push({
      id: `ui-${bascule.key}`,
      libelle: bascule.label,
      nature: 'reglage',
      panneau: 'ui-config-panel',
      chemin: cheminDe(SECTIONS, 'ui-config-panel'),
    })
  }

  for (const champ of CHAMPS_TEXTE_UI) {
    entrees.push({
      id: `ui-${champ.key}`,
      libelle: champ.label,
      nature: 'reglage',
      panneau: 'ui-config-panel',
      chemin: cheminDe(SECTIONS, 'ui-config-panel'),
      motsCles: champ.hint,
    })
  }

  for (const bascule of BASCULES_ENGAGEMENT) {
    entrees.push({
      id: `eng-${bascule.key}`,
      libelle: bascule.label,
      nature: 'reglage',
      panneau: 'engagement-panel',
      chemin: cheminDe(SECTIONS, 'engagement-panel'),
    })
  }

  for (const action of ACTIONS) {
    entrees.push({
      id: action.id,
      libelle: action.libelle,
      nature: 'action',
      panneau: action.panneau,
      chemin: cheminDe(SECTIONS, action.panneau),
      motsCles: action.motsCles,
    })
  }

  return entrees
}
