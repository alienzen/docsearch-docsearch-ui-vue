import { createCollapseStore } from './collapse'

/**
 * Deux niveaux de pli indépendants, comme docsearch-ui/public/admin.html :
 * les GROUPES (« Sources SQL »…) et les PANNEAUX qu'ils contiennent.
 * Replier un groupe puis le rouvrir doit retrouver chacun de ses
 * panneaux tel qu'il était — d'où deux jeux d'état séparés, et deux clés
 * localStorage distinctes.
 */
export const useAdminPanelsStore = createCollapseStore(
  'adminPanels',
  'docsearch-admin-collapsed-panels',
)

export const useAdminGroupsStore = createCollapseStore(
  'adminGroups',
  'docsearch-admin-collapsed-groups',
)
