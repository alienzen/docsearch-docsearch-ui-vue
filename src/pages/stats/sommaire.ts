/**
 * Index de recherche du sommaire de la page de statistiques.
 *
 * Même principe que celui de l'administration : on indexe l'INTERFACE —
 * panneaux, tableaux, filtres et actions — jamais les données. Le texte
 * d'une suggestion ou la requête d'une ligne de journal ne s'y trouvent
 * donc pas ; le panneau qui les montre, si.
 *
 * La différence tient à la matière : cette page n'a pas de réglages
 * déclarés en tableau, rien ne peut donc être moissonné automatiquement.
 * Tout ce qui n'est pas un panneau est écrit dans ACTIONS ci-dessous, et
 * chaque identifiant y désigne une ancre réelle de la page — les tests
 * de StatsPage vérifient qu'elles existent toutes.
 *
 * Les ancres des trois tableaux « par groupe » sont posées par
 * StatsGroupCounts, qui donne à son titre l'identifiant `<id>-titre`.
 * Elles n'apparaissent qu'une fois les données chargées : d'où le repli
 * sur le panneau, prévu par `Entree.panneau`.
 */
import { cheminDe, entreesDesSections, type Entree } from '@/utils/sommaire'
import { SECTIONS } from './sections'

/**
 * `motsCles` porte les termes qu'on tape sans qu'ils figurent dans le
 * libellé — « xls » pour l'export, « qui a fait quoi » pour l'audit.
 */
const ACTIONS: { id: string; libelle: string; panneau: string; motsCles?: string }[] = [
  {
    id: 'summary-cartes',
    libelle: 'Chiffres clés',
    panneau: 'summary-panel',
    motsCles: 'recherches effectuées utilisateurs distincts avis positifs total',
  },
  {
    id: 'summary-duree-moyenne',
    libelle: 'Temps de recherche moyen',
    panneau: 'summary-panel',
    motsCles: 'durée médiane centile lenteur performance',
  },
  {
    id: 'summary-histogramme',
    libelle: 'Recherches par jour',
    panneau: 'summary-panel',
    motsCles: 'histogramme quatorze derniers jours volume',
  },
  {
    id: 'summary-groupes-titre',
    libelle: 'Recherches par groupe',
    panneau: 'summary-panel',
    motsCles: 'annuaire ldap répartition',
  },
  {
    id: 'summary-avis-groupes-titre',
    libelle: 'Avis par groupe',
    panneau: 'summary-panel',
    motsCles: 'pouce satisfaction positifs négatifs',
  },
  {
    id: 'nps-cartes',
    libelle: 'Score NPS',
    panneau: 'nps-panel',
    motsCles: 'promoteurs passifs détracteurs recommandation',
  },
  {
    id: 'nps-groupes-titre',
    libelle: 'Score par groupe',
    panneau: 'nps-panel',
    motsCles: 'annuaire ldap répartition',
  },
  {
    id: 'suggestions-tableau',
    libelle: 'Suggestions reçues',
    panneau: 'suggestions-panel',
    motsCles: 'idée catégorie statut anonyme supprimer',
  },
  {
    id: 'suggestions-groupes-titre',
    libelle: 'Suggestions par groupe',
    panneau: 'suggestions-panel',
    motsCles: 'annuaire ldap répartition',
  },
  {
    id: 'zero-results-tableau',
    libelle: 'Requêtes sans résultat',
    panneau: 'zero-results-panel',
    motsCles: 'silence lacune contenu manquant critères filtres',
  },
  {
    id: 'zero-results-groupes-titre',
    libelle: 'Recherches sans résultat par groupe',
    panneau: 'zero-results-panel',
    motsCles: 'annuaire ldap répartition',
  },
  {
    id: 'logs-filter',
    libelle: 'Filtrer par mot-clé',
    panneau: 'logs-panel',
    motsCles: 'requête chercher journal',
  },
  {
    id: 'logs-sans-navigation',
    libelle: 'Recherches véritables seulement',
    panneau: 'logs-panel',
    motsCles: 'tours de page pagination masquer',
  },
  {
    id: 'logs-export',
    libelle: 'Exporter en XLS',
    panneau: 'logs-panel',
    motsCles: 'tableur excel télécharger extraction',
  },
  {
    id: 'logs-tableau',
    libelle: 'Détail des recherches',
    panneau: 'logs-panel',
    motsCles: 'journal durée clics avis source critères',
  },
  {
    id: 'audit-log-tableau',
    libelle: "Actions d'administration",
    panneau: 'audit-log-panel',
    motsCles: 'audit trace qui a fait quoi route méthode',
  },
]

export function construireIndex(): Entree[] {
  const entrees: Entree[] = entreesDesSections(SECTIONS)

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
