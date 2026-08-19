/**
 * Découpage de la page de statistiques : ses PANNEAUX, dans l'ordre
 * d'affichage.
 *
 * Même rôle que le `sections.ts` de l'administration — source unique du
 * sommaire, du bouton « Tout replier » et des raccourcis chiffrés — mais
 * sur un seul niveau : cette page n'a pas de groupes, chaque section y
 * EST un panneau. Le test de StatsPage compare cette déclaration au DOM
 * réellement rendu, ce qui rend acceptable la recopie des titres depuis
 * chaque `StatsPanel`.
 */
import type { Section } from '@/utils/sommaire'

export const SECTIONS: Section[] = [
  { id: 'summary-panel', titre: "Vue d'ensemble" },
  { id: 'nps-panel', titre: 'NPS' },
  { id: 'suggestions-panel', titre: 'Suggestions' },
  { id: 'zero-results-panel', titre: 'Recherches sans résultat' },
  { id: 'logs-panel', titre: 'Historique des recherches' },
  { id: 'audit-log-panel', titre: "Journal d'audit" },
]

export const PANEL_IDS = SECTIONS.map((section) => section.id)
