import { createCollapseStore } from './collapse'

/** Panneaux repliés de la page de statistiques. */
export const useStatsPanelsStore = createCollapseStore(
  'statsPanels',
  'docsearch-stats-collapsed-panels',
)
