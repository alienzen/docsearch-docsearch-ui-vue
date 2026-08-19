/**
 * Découpage de la page d'administration : les GROUPES et, dans chacun,
 * les PANNEAUX, dans l'ordre d'affichage.
 *
 * Source unique de trois choses qui dérivaient auparavant chacune de son
 * côté : le sommaire latéral, le bouton « Tout replier » (qui ne replie
 * que ce qu'il connaît) et les raccourcis chiffrés (qui visent la Nième
 * section). Le gabarit d'AdminPage reste explicite — chaque panneau est
 * un composant avec ses propres props — mais un panneau ajouté au
 * gabarit sans l'être ici fait échouer le test d'AdminPage, qui compare
 * cette déclaration au DOM réellement rendu.
 *
 * Les titres sont donc à recopier de l'`AdminPanel` correspondant : la
 * duplication est assumée, mais elle est vérifiée.
 */

import type { Section } from '@/utils/sommaire'

/** Un panneau, feuille de l'arbre : pas de sous-niveau. */
export type Panneau = Section

/** Un groupe, qui a toujours au moins un panneau. */
export type Groupe = Section & { panneaux: Panneau[] }

export const SECTIONS: Groupe[] = [
  {
    id: 'group-overview',
    titre: "Vue d'ensemble",
    panneaux: [
      { id: 'status-panel', titre: 'État des composants' },
      { id: 'allsources-panel', titre: 'Toutes les sources' },
    ],
  },
  {
    id: 'group-file-sources',
    titre: 'Sources fichiers',
    panneaux: [
      { id: 'filesources-panel', titre: 'Sources fichiers' },
      { id: 'filetypes-panel', titre: 'Types de fichiers' },
      { id: 'pathfilters-panel', titre: 'Filtres de sous-dossiers' },
      { id: 'scan-panel', titre: 'Indexation' },
      { id: 'source-tree-panel', titre: 'Arborescence des sources' },
      { id: 'duplicates-panel', titre: 'Doublons' },
    ],
  },
  {
    id: 'group-sql-sources',
    titre: 'Sources SQL',
    panneaux: [{ id: 'sqlsources-panel', titre: 'Sources SQL' }],
  },
  {
    id: 'group-web-sources',
    titre: 'Sources web',
    panneaux: [{ id: 'websources-panel', titre: 'Sources web' }],
  },
  {
    id: 'group-plugins',
    titre: 'Modules complémentaires',
    panneaux: [{ id: 'plugins-panel', titre: 'Réglages des modules' }],
  },
  {
    id: 'group-recherche',
    titre: 'Recherche',
    panneaux: [
      { id: 'synonyms-panel', titre: 'Thésaurus' },
      { id: 'pinned-panel', titre: 'Résultats épinglés' },
    ],
  },
  {
    id: 'group-interface',
    titre: 'Interface et engagement',
    panneaux: [
      { id: 'engagement-panel', titre: 'Mesure de satisfaction' },
      { id: 'ui-config-panel', titre: 'Interface' },
      { id: 'config-panel', titre: 'Paramètres opérationnels' },
    ],
  },
]

export const GROUP_IDS = SECTIONS.map((groupe) => groupe.id)

export const PANEL_IDS = SECTIONS.flatMap((groupe) => groupe.panneaux.map((p) => p.id))
