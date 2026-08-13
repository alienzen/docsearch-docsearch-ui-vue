<script setup lang="ts">
/**
 * Aide administrateur — portage de
 * docsearch-ui/public/admin-help.html.
 *
 * Contenu repris tel quel, présentation en DSFR. Les raccourcis publiés
 * ici sont ceux réellement branchés par useAdminShortcuts : les tenir
 * synchronisés, une aide qui décrit une touche inopérante est pire que
 * pas d'aide du tout.
 */
import { onMounted } from 'vue'
import { useUiConfigStore } from '@/stores/uiConfig'
import { ADMIN_SHORTCUTS } from '@/constants'

const uiConfig = useUiConfigStore()

onMounted(async () => {
  await uiConfig.loadUiConfig()
  uiConfig.applyScheme('admin')
  uiConfig.loadIsAdmin()
})
</script>

<template>
  <DsfrHeader
    service-title="DocSearch"
    service-description="Aide administrateur"
    :logo-text="uiConfig.logoText"
    home-to="/"
    operator-img-src="/logo-docsearch.svg"
    operator-img-alt="DocSearch"
    operator-img-style="max-width: 2.5rem"
    :quick-links="[
      {
        label: 'Aide des statistiques',
        to: '/stats-help',
        class: 'fr-link--icon-left fr-icon-question-line',
      },
    ]"
  >
    <!-- Les liens de navigation sont dans le menu du compte, et non
         déployés dans les outils de l'en-tête : mêmes entrées, dans le
         même ordre, que sur les pages d'administration et de
         statistiques. Ils s'adressent aux mêmes personnes que la
         déconnexion — celles qui sont connectées — et le menu est déjà
         l'endroit où l'on va chercher ce qui dépend de qui l'on est.

         ⚠️  Le lien rapide ci-dessus n'est PAS décoratif : DsfrHeader ne
         rend le bloc `.fr-header__tools-links` — et donc ce slot — que
         si `quickLinks` contient au moins une entrée. Vider la liste
         ferait disparaître le menu du compte, déconnexion comprise,
         sans la moindre erreur. -->
    <template #after-quick-links>
      <HeaderUserMenu
        family="admin"
        :links="[
          { label: 'Statistiques', href: '/stats.html', icon: 'fr-icon-bar-chart-line' },
          { label: 'Administration', href: '/admin.html', icon: 'fr-icon-settings-5-line' },
        ]"
      />
    </template>
  </DsfrHeader>

  <main id="main-content" class="fr-container ds-prose fr-my-4w">
    <h1 id="aide-admin-titre" class="fr-h3">Aide administrateur</h1>

    <h2 id="aide-admin-raccourcis" class="fr-h5">Raccourcis clavier</h2>
    <div class="fr-table fr-table--bordered">
      <table id="aide-admin-raccourcis-tableau">
        <thead>
          <tr><th scope="col">Raccourci</th><th scope="col">Action</th></tr>
        </thead>
        <tbody>
          <tr
            v-for="shortcut in ADMIN_SHORTCUTS"
            :key="shortcut.keys"
            data-testid="aide-admin-raccourci"
          >
            <td><kbd>{{ shortcut.keys }}</kbd></td>
            <td>{{ shortcut.label }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="fr-hint-text">
      Inactifs pendant la saisie dans un champ texte, une liste déroulante ou un formulaire.
    </p>

    <h2 id="aide-admin-sources" class="fr-h5">Sources</h2>
    <p>
      Les panneaux « Sources fichiers », « Sources SQL » et « Sources web » permettent d'enregistrer
      une source, d'activer ou de désactiver sa visibilité dans la recherche, de modifier son
      libellé et sa description, et de la retirer. Le nom d'une source — utilisé en interne, dans le
      registre et dans les documents déjà indexés — ne peut plus être modifié une fois créé ; seuls
      le libellé affiché et la description peuvent l'être à tout moment.
    </p>

    <h2 id="aide-admin-etat" class="fr-h5">État des composants</h2>
    <p>
      Vue d'ensemble d'Elasticsearch, Redis, Kafka, Tika et des workers, avec la file d'indexation
      en attente. Ce panneau se rafraîchit seul toutes les 5 secondes ; en cas d'échec passager, il
      conserve les dernières valeurs connues et le signale plutôt que d'afficher une erreur.
    </p>

    <h2 id="aide-admin-thesaurus" class="fr-h5">Thésaurus</h2>
    <p>
      Déclare les termes qui désignent la même chose pour vos agents mais pas pour le moteur —
      un sigle et son développé, l'ancien et le nouveau nom d'un service. Une règle par ligne,
      termes séparés par une virgule&nbsp;: <code>DRH, direction des ressources humaines</code>.
      Tous les termes d'une règle se trouvent mutuellement.
    </p>
    <p>
      L'effet est <strong>immédiat et sans réindexation</strong>&nbsp;: Elasticsearch recharge
      seul ses analyseurs de recherche, et le panneau affiche le nombre de shards rechargés —
      c'est la preuve que la règle est en vigueur.
    </p>
    <p class="fr-hint-text">
      ⚠️ Une règle mal écrite ne produit <strong>aucune erreur</strong>, seulement une
      recherche qui ne trouve rien de plus qu'avant. D'où le champ « Essayer une requête »&nbsp;:
      il montre les termes que le moteur retient réellement, synonymes appliqués. À utiliser
      systématiquement après un ajout. Les recherches sans résultat de la page Statistiques
      sont le meilleur endroit où trouver quoi déclarer.
    </p>
    <p class="fr-hint-text">
      L'élargissement ne s'applique pas aux recherches entre guillemets, qui restent
      littérales. Sur une installation mise à jour depuis une version antérieure, la commande
      <code>./manage.sh migrer-synonymes</code> doit avoir été passée une fois&nbsp;: sans elle,
      les index existants n'ont pas l'analyseur et le thésaurus reste sans effet.
    </p>

    <h2 id="aide-admin-epingles" class="fr-h5">Résultats épinglés</h2>
    <p>
      Associe une requête à un ou plusieurs documents, affichés en tête de la première page
      sous la mention « Proposé par votre administration ». Utile sur les questions que tout
      le monde pose&nbsp;: « congés », « note de frais ». La requête est comparée sans tenir
      compte de la casse ni des accents.
    </p>
    <p class="fr-hint-text">
      ⚠️ Épingler <strong>met en avant, cela n'autorise pas</strong>&nbsp;: le document reste
      filtré par les droits de chaque utilisateur, et celui qui n'y a pas accès ne le voit
      pas. Un document supprimé de l'index disparaît de lui-même côté recherche&nbsp;; le
      panneau le signale alors comme <strong>introuvable</strong>, pour que la règle soit
      nettoyée — c'est le seul endroit où cela se voit.
    </p>

    <h2 id="aide-admin-doublons" class="fr-h5">Doublons</h2>
    <p>
      Compte les documents indexés en plusieurs exemplaires et chiffre la place qu'occupent
      les copies, avec les chemins où aller regarder. Le classement se fait par place occupée
      et non par nombre de copies&nbsp;: dix copies d'une note pèsent moins que deux copies
      d'une vidéo.
    </p>
    <p class="fr-hint-text">
      Le rapport est calculé une fois par jour — l'agrégation parcourt tout l'index, elle ne
      doit pas se relancer à chaque ouverture du panneau. « Recalculer » force la mise à jour.
    </p>
    <p class="fr-hint-text">
      ⚠️ Ne pas confondre « aucun doublon » et « rien n'est encore mesuré ». Seuls les
      documents portant une empreinte de contenu sont comptés&nbsp;: les sources SQL et web
      n'en ont pas (elles n'ont pas de fichier), et les documents indexés avant cette
      fonctionnalité non plus tant que <code>./manage.sh backfill-hashes --apply</code> n'a
      pas été passé. Le panneau le dit explicitement quand c'est le cas.
    </p>

    <h2 id="aide-admin-conservation" class="fr-h5">Conservation des journaux</h2>
    <p>
      Fixe la durée de conservation de chaque journal — recherches, connexions, audit
      d'administration, réponses NPS, suggestions. Une purge quotidienne supprime au-delà.
      Deux raisons de s'en servir&nbsp;: le disque, et la durée de conservation de données
      personnelles (identifiant, requêtes, adresse IP) qu'une installation doit pouvoir
      justifier.
    </p>
    <p class="fr-hint-text">
      <code>0</code> signifie <strong>conservation illimitée</strong>. Le bouton d'aperçu
      montre ce que la prochaine purge emporterait, sans rien supprimer&nbsp;: à consulter
      avant de raccourcir une durée. Chaque passage journalise le nombre de documents
      supprimés, et la purge du journal d'audit s'inscrit elle-même dans le journal d'audit.
      Les collections et les mots-clés personnalisés ne sont jamais purgés&nbsp;: ce sont des
      données d'utilisateur, pas des traces.
    </p>
    <p class="fr-hint-text">
      Conséquence à connaître&nbsp;: les statistiques, l'historique de recherche personnel et
      les documents récemment consultés ne portent que sur la fenêtre conservée.
    </p>

    <h2 id="aide-admin-apparence" class="fr-h5">Apparence</h2>
    <p>
      L'interface suit le Système de Design de l'État. Le panneau « Interface » ne règle plus que le
      mode clair ou sombre, séparément pour les pages de recherche et d'administration ; les anciens
      thèmes de couleur ont été retirés.
    </p>

    <h2 id="aide-admin-contact" class="fr-h5">Besoin d'aide&nbsp;?</h2>
    <p>
      Consultez la documentation du projet (<code>docsearch-docs</code>) ou contactez l'équipe
      technique.
    </p>
  </main>

  <!-- Pied de page réduit à l'essentiel : ni liens d'écosystème
       (info.gouv.fr…), ni liens obligatoires, ni licence codée en dur.
       `licence-name` vidé neutralise le lien que DsfrFooter accole
       toujours à la mention de bas de page ; il est masqué en CSS, une
       ancre vide subsistant sinon. -->
  <DsfrFooter
    v-if="uiConfig.config.footer_enabled_admin"
    :logo-text="uiConfig.logoText"
    :desc-text="'DocSearch — Aide administrateur'"
    :licence-text="uiConfig.footerBottomText"
    licence-name=""
    :mandatory-links="[]"
    :ecosystem-links="[]"
    operator-img-src="/logo-docsearch.svg"
    operator-img-alt="DocSearch"
    operator-img-style="max-width: 2.5rem"
  />
</template>
