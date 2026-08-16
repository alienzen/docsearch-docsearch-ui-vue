import type { UiConfig } from '@/stores/uiConfig'

/**
 * Libellés des réglages à cocher et à saisir des panneaux « Interface »
 * et « Mesure de satisfaction ».
 *
 * Sortis de leurs composants pour une seule raison : le sommaire de la
 * page d'administration les indexe (voir pages/admin/sommaire.ts) afin
 * qu'une recherche sur « alertes » mène à la case elle-même, et pas
 * seulement au panneau qui la contient. Un `<script setup>` n'exporte
 * rien — les recopier dans l'index aurait fait diverger deux listes de
 * libellés, ce qui est précisément ce qu'un index ne doit pas faire.
 *
 * L'`id` de chaque contrôle est dérivé de sa clé (`ui-<clé>`,
 * `eng-<clé>`) : c'est ce qui permet à l'index de viser l'ancre sans
 * qu'aucune liste d'identifiants n'ait à être tenue à part.
 */

export type BasculeUi = { key: keyof UiConfig; label: string }

export const BASCULES_UI: BasculeUi[] = [
  { key: 'chat_enabled', label: 'Lien « Assistant IA » dans l’en-tête de recherche' },
  { key: 'footer_enabled', label: 'Pied de page des pages « recherche »' },
  {
    key: 'footer_enabled_admin',
    label: 'Pied de page des pages « administration » (celle-ci, statistiques, aide admin)',
  },
  {
    key: 'admin_links_enabled',
    label: 'Liens « Administration » / « Statistiques » (même pour les utilisateurs autorisés)',
  },
  { key: 'export_enabled', label: 'Export des résultats de recherche (XLSX / DOCX)' },
  { key: 'help_enabled', label: 'Lien « Aide »' },
  { key: 'collections_enabled', label: '« Mes collections »' },
  { key: 'custom_keywords_enabled', label: 'Mots-clés personnalisés sur les documents' },
  { key: 'alerts_enabled', label: 'Alertes sur les recherches enregistrées' },
  {
    key: 'search_history_enabled',
    label: '« Mes recherches récentes » (chacun ne voit que les siennes)',
  },
  {
    key: 'autocomplete_enabled',
    label:
      'Suggestions sous la barre de recherche (ses recherches passées, puis les auteurs et mots-clés qu’il a le droit de voir)',
  },
  {
    key: 'recent_documents_enabled',
    label: '« Vos derniers documents consultés » sur l’écran d’accueil (relus selon les droits de chacun)',
  },
  {
    key: 'collections_shared_enabled',
    label:
      'Partage d’une collection avec ses groupes (partage la référence, jamais le droit de lecture)',
  },
  { key: 'sort_enabled', label: 'Sélecteur de tri des résultats' },
  {
    key: 'search_time_enabled',
    label:
      'Temps de recherche affiché à côté du décompte de résultats (chacun peut ensuite le masquer)',
  },
  {
    key: 'score_enabled',
    label:
      'Pourcentage de pertinence sur les cartes de résultat (masqué, le classement par pertinence reste le même)',
  },
  {
    key: 'acl_visible_enabled',
    label: 'Section « Droits d’accès » de la fiche détail, visible de tous (sinon : administrateurs seuls)',
  },
  {
    key: 'shortcuts_link_enabled',
    label: 'Lien « Raccourcis » (la touche « ? » reste active)',
  },
  {
    key: 'empty_state_animation_enabled',
    label: "Animation d'accueil sur la page de recherche vide",
  },
  {
    key: 'header_shrink_enabled',
    label:
      'En-tête réduit au défilement — bloc-marque et logo masqués, barre de recherche et navigation conservées (sans effet sur écran étroit)',
  },
  { key: 'show_current_user_enabled', label: 'Badge « Connecté : … » côté recherche' },
  { key: 'show_current_user_groups_enabled', label: '… avec ses groupes' },
  { key: 'show_current_user_enabled_admin', label: 'Badge « Connecté : … » côté administration' },
  { key: 'show_current_user_groups_enabled_admin', label: '… avec ses groupes' },
  {
    key: 'login_proconnect_enabled',
    label:
      'Connexion — jalon « Se connecter avec ProConnect » (bouton affiché mais désactivé : rien ne l’implémente côté serveur)',
  },
]

export type ChampTexteUi = {
  key: keyof UiConfig
  label: string
  hint?: string
  /** Rendu en zone de saisie multiligne plutôt qu'en champ d'une ligne. */
  multiline?: boolean
}

export const CHAMPS_TEXTE_UI: ChampTexteUi[] = [
  {
    key: 'logo_text',
    label: 'Texte du bloc-marque',
    hint: "Bloc « République Française » de l'en-tête et du pied de page. Une ligne de saisie = une ligne affichée.",
    multiline: true,
  },
  { key: 'header_logo_text', label: 'Titre (en-tête)' },
  { key: 'header_subtitle_text', label: 'Sous-titre (en-tête)' },
  { key: 'favicon_url', label: 'Favicon personnalisé' },
  { key: 'footer_text', label: 'Description (pied de page)' },
  {
    key: 'footer_bottom_text',
    label: 'Mention de bas de page',
    hint: 'Ligne tout en bas du pied de page. Vide = ligne masquée.',
    multiline: true,
  },
  {
    key: 'login_inscription_url',
    label: 'Connexion — lien « Pas encore de compte ? »',
    hint: "URL de la démarche de demande de compte (formulaire intranet, portail d'annuaire…). DocSearch ne gère pas les comptes lui-même : la destination est forcément externe. Vide = lien masqué.",
  },
  {
    key: 'login_mot_de_passe_oublie_url',
    label: 'Connexion — lien « Mot de passe oublié ? »',
    hint: 'URL du portail de réinitialisation. Vide = lien masqué.',
  },
  {
    key: 'sources_mount_display',
    label: 'Chemin affiché (bouton « Copier le chemin »)',
    hint: 'Ex. \\\\serveur\\partage — remplace le chemin interne aux conteneurs pour que le chemin copié soit utilisable.',
  },
]

export const BASCULES_ENGAGEMENT = [
  { key: 'feedback_enabled', label: 'Pouce haut/bas après chaque recherche' },
  {
    key: 'nps_enabled',
    label: 'Popup NPS occasionnelle (toutes les 20 recherches, délai de 30 jours)',
  },
  { key: 'suggestions_enabled', label: 'Lien « Suggérer une idée » dans l’en-tête de recherche' },
] as const

export type CleEngagement = (typeof BASCULES_ENGAGEMENT)[number]['key']
