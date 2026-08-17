<script setup lang="ts">
/**
 * Aide de la page de statistiques — pendant de AdminHelpPage pour
 * /stats.html.
 *
 * Même règle que l'aide administrateur : les raccourcis publiés ici sont
 * ceux que la page branche réellement (STATS_SHORTCUTS, la liste de
 * l'administration MOINS « r »), et les seuils cités — 14 jours, 50
 * requêtes, tailles de page — sont ceux du code des panneaux. Une aide
 * qui décrit autre chose que ce que fait la page est pire que pas d'aide
 * du tout.
 */
import { onMounted } from 'vue'
import { useUiConfigStore } from '@/stores/uiConfig'
import { STATS_SHORTCUTS } from '@/constants'

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
    service-description="Aide des statistiques"
    :logo-text="uiConfig.logoText"
    home-to="/"
    operator-img-src="/logo-docsearch.svg"
    operator-img-alt="DocSearch"
    operator-img-style="max-width: 2.5rem"
    :quick-links="[
      {
        label: 'Aide administrateur',
        to: '/admin-help',
        class: 'fr-link--icon-left fr-icon-question-line',
      },
    ]"
  >
    <!-- Les liens de navigation sont dans le menu du compte, comme sur
         les pages de statistiques, d'administration et d'aide
         administrateur : mêmes entrées, même ordre, d'une page à
         l'autre.

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
    <h1 id="aide-stats-titre" class="fr-h3">Aide des statistiques</h1>

    <p>
      La page « Statistiques » rassemble ce que DocSearch enregistre de son propre usage :
      recherches effectuées, avis donnés sur les résultats, réponses au NPS, suggestions déposées et
      actions d'administration. Tout vient des journaux tenus par l'API elle-même — aucun outil de
      mesure tiers n'est appelé. Son accès est réservé au groupe d'administration ; un autre
      utilisateur n'obtient qu'un bandeau « Accès refusé » à la place des panneaux.
    </p>

    <h2 id="aide-stats-raccourcis" class="fr-h5">Raccourcis clavier</h2>
    <div class="fr-table fr-table--bordered">
      <table id="aide-stats-raccourcis-tableau">
        <thead>
          <tr><th scope="col">Raccourci</th><th scope="col">Action</th></tr>
        </thead>
        <tbody>
          <tr
            v-for="shortcut in STATS_SHORTCUTS"
            :key="shortcut.keys"
            data-testid="aide-stats-raccourci"
          >
            <td><kbd>{{ shortcut.keys }}</kbd></td>
            <td>{{ shortcut.label }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="fr-hint-text">
      Inactifs pendant la saisie dans un champ texte, une liste déroulante ou un formulaire. La
      touche « r » de l'administration — recharger tous les panneaux — n'existe pas ici : chaque
      panneau charge ses données seul, il n'y a pas de rechargement global à déclencher.
    </p>

    <h2 id="aide-stats-panneaux" class="fr-h5">Panneaux</h2>
    <p>
      Les six panneaux se replient et se déplient d'un clic sur leur titre, ou avec les touches 1 à
      9 dans l'ordre d'affichage ; « Tout replier » agit sur l'ensemble. L'état de pli est conservé
      dans le navigateur, séparément de celui de la page d'administration : on retrouve la page
      telle qu'on l'avait laissée.
    </p>
    <p>
      Chaque panneau interroge son propre point d'entrée et affiche son propre message d'erreur : si
      l'un échoue, les autres restent lisibles. Seul un refus d'accès remplace la page entière,
      puisqu'il vaut pour tous.
    </p>

    <h2 id="aide-stats-vue-ensemble" class="fr-h5">Vue d'ensemble</h2>
    <p>
      Trois compteurs portant sur <strong>tout l'historique conservé</strong>, et non sur les seuls
      14 derniers jours : le nombre de recherches enregistrées, le nombre d'utilisateurs distincts
      les ayant lancées, et la part d'avis positifs — pouces levés rapportés à l'ensemble des avis,
      « — » tant qu'aucun avis n'a été donné. Le nombre d'utilisateurs distincts est calculé par
      Elasticsearch et devient une estimation au-delà de quelques milliers d'utilisateurs.
    </p>
    <p>
      L'histogramme « Recherches par jour » couvre les 14 derniers jours ; la hauteur des barres est
      relative à la journée la plus chargée de la période, pas à une échelle absolue.
    </p>
    <p>
      Ces compteurs portent sur les <strong>recherches véritables</strong> : les tours de page
      en sont écartés, et la carte dit combien. Deux mesures y échappent délibérément.
      Les <strong>avis</strong> d'abord : le pouce est rattaché à la dernière recherche
      affichée, si bien qu'un avis donné depuis la page 3 porte sur une ligne « page 3 » —
      l'écarter jetterait un avis réel, et la part positive est un rapport entre avis, pas
      entre recherches. Les <strong>temps de recherche</strong> ensuite : un tour de page est
      une requête pleine et entière, et c'est en pagination profonde que le moteur est le plus
      lent ; les filtrer masquerait précisément les requêtes lentes qu'on veut voir. C'est
      pourquoi la mention sous les temps compte des <em>lignes de journal</em>, plus nombreuses
      que les recherches.
    </p>
    <p>
      Deux tableaux ventilent ensuite ces chiffres par groupe. « Recherches par groupe » les liste
      tous ; « Avis par groupe » ne retient que ceux ayant donné au moins un avis — un groupe qui
      cherche sans jamais se prononcer n'apprend rien sur la satisfaction. La part positive y est
      recalculée groupe par groupe, elle ne se déduit pas du taux global.
    </p>

    <h2 id="aide-stats-nps" class="fr-h5">NPS</h2>
    <p>
      Réponses à la question « Recommanderiez-vous DocSearch à un collègue ? », notées de 0 à 10 :
      détracteurs de 0 à 6, passifs 7 et 8, promoteurs 9 et 10. Le score est le calcul standard —
      pourcentage de promoteurs moins pourcentage de détracteurs — et va donc de −100 à +100 ; les
      passifs n'y entrent pas, ils ne pèsent que par leur présence au dénominateur. Il vaut « — »
      tant qu'aucune réponse n'a été recueillie.
    </p>
    <p>
      Le score par groupe est recalculé sur le seul périmètre du groupe. Sur quelques réponses il
      varie énormément d'une réponse à l'autre : à lire avec la colonne « Réponses » sous les yeux.
    </p>

    <h2 id="aide-stats-suggestions" class="fr-h5">Suggestions</h2>
    <p>
      Les messages déposés via « Suggérer une idée », 20 par page, les plus récents d'abord. La
      colonne « Statut » permet de suivre leur traitement — Nouveau, En cours, Traité ; le
      changement est immédiat et <strong>purement interne à l'équipe</strong> : son auteur n'en est
      jamais informé.
    </p>
    <p>
      Les suggestions sont anonymes par défaut : la colonne « Utilisateur » n'affiche un nom que si
      son auteur a choisi de le joindre, et « Anonyme » sinon. Le décompte par groupe porte sur
      toutes les suggestions, pas sur la page affichée — il ne change donc pas quand on tourne les
      pages.
    </p>
    <p>
      Le bouton « Supprimer » efface une suggestion <strong>définitivement</strong>, après
      confirmation : c'est le geste pour un doublon, un dépôt accidentel ou un texte nominatif
      qu'on ne veut pas conserver. À ne pas confondre avec le statut « Traité », qui garde la
      suggestion et sa trace. Une suggestion anonyme effacée ne peut plus être redemandée à son
      auteur. La suppression est enregistrée dans le journal d'audit (qui, quand) ; le texte
      supprimé, lui, n'y figure pas.
    </p>

    <h2 id="aide-stats-zero" class="fr-h5">Recherches sans résultat</h2>
    <p>
      Les requêtes ayant retourné zéro document, regroupées et comptées, les 50 plus fréquentes
      d'abord — c'est un palmarès, pas un inventaire, il n'y a donc pas de pagination. Le sous-titre
      rappelle le nombre total de recherches infructueuses, toutes requêtes confondues.
    </p>
    <p>
      C'est le panneau qui signale le contenu manquant : une requête qui revient souvent sans jamais
      rien retourner désigne soit une source à indexer, soit un vocabulaire que les documents
      n'emploient pas.
    </p>
    <p>
      La colonne <strong>« Critères rencontrés »</strong> dit ce qui accompagnait la requête — type
      de fichier, auteur, dossier, mot-clé, source, champ interrogé, période. Elle sépare deux
      situations qui se ressemblent trait pour trait à l'écran de l'utilisateur : un résultat vide
      parce que le contenu manque, et un résultat vide parce qu'un filtre était trop serré. C'est
      l'étiquette <strong>« Sans filtre »</strong> qui tranche : des occurrences sans aucun filtre
      désignent du contenu absent, leur absence désigne un filtrage.
    </p>
    <p>
      Ces comptes ne s'additionnent pas jusqu'aux occurrences de la ligne : une recherche portant
      deux filtres est comptée dans les deux, et une recherche sans filtre n'apparaît que dans
      « Sans filtre ». « Recherche dans » n'est montré que lorsque la recherche était restreinte à
      un champ — « Tout », qui est le cas courant, ne restreint rien et n'apprend rien. Au-delà de
      cinq valeurs distinctes pour un même critère, seules les plus fréquentes sont affichées.
    </p>

    <h2 id="aide-stats-historique" class="fr-h5">Historique des recherches</h2>
    <p>
      Le détail des recherches, 50 par page, les plus récentes d'abord : requête, source interrogée
      (« toutes » quand aucune n'était sélectionnée), critères actifs au moment de la recherche
      (extensions, auteur, dossier, période), nombre de résultats, trois premiers documents
      retournés suivis de « +N », avis donné et nombre de documents ouverts.
    </p>
    <p>
      La colonne <strong>« Nature »</strong> distingue une <strong>recherche</strong> d'un
      <strong>tour de page</strong>. C'est nécessaire parce que chaque clic sur « Suivant »
      relance la recherche et écrit une ligne de plus, identique à la précédente : sans cette
      colonne, une requête consultée sur cinq pages se lit comme cinq recherches. La case
      « Recherches véritables seulement » masque les tours de page, à l'écran comme dans
      l'export.
    </p>
    <p>
      Un tiret dans cette colonne veut dire <strong>inconnu</strong>, et non « recherche » : les
      lignes enregistrées avant la capture du numéro de page ne portent pas l'information. Elles
      restent affichées même quand la case est cochée — les écarter reviendrait à faire
      disparaître tout l'historique antérieur au nom d'une supposition. Même principe pour
      « Recherche exacte », signalée parmi les critères : son absence sur une ligne ancienne ne
      veut pas dire que la recherche n'était pas exacte.
    </p>
    <p>
      La vue d'ensemble applique le même filtre : son total, les utilisateurs distincts, les
      recherches par jour et par groupe ne comptent plus les tours de page, et la carte annonce
      combien en ont été écartés. Les <strong>avis</strong> et les <strong>temps de
      recherche</strong> y échappent volontairement — voir la vue d'ensemble ci-dessus.
    </p>
    <p>
      Le champ de filtre porte sur les mots de la requête ; il s'applique avec le bouton
      « Filtrer » ou la touche Entrée, et « Réinitialiser » le vide. L'export XLS reprend le filtre
      courant mais <strong>ignore la pagination</strong> : il contient toutes les lignes
      correspondantes, pas seulement la page affichée.
    </p>
    <p>
      La colonne « Utilisateur » de l'export porte <strong>« (anonymisée) »</strong> pour les
      recherches dont l'auteur a effacé son historique : ce geste ôte du journal, définitivement,
      le compte et l'adresse IP de ses recherches passées. La requête, ses résultats et les
      groupes restent — la ligne compte toujours dans les volumétries et dans les répartitions
      par service, elle sort seulement des décomptes par utilisateur.
    </p>
    <p>
      La colonne « Clics » indique, elle, <strong>« 3 (dont 2 effacés) »</strong> quand
      l'utilisateur a effacé ses documents consultés : le détail de ces clics — quel document, à
      quelle heure — est supprimé du journal, seul leur nombre subsiste. La recherche a bien mené
      à trois consultations et le tableau continue de le dire ; ce qu'on ne peut plus savoir,
      c'est lesquelles. L'export XLS reprend ce total et détaille la part effacée en dernière
      colonne.
    </p>

    <h2 id="aide-stats-audit" class="fr-h5">Journal d'audit</h2>
    <p>
      Les actions d'administration, 30 par page, les plus récentes d'abord. N'y figurent que les
      <strong>modifications réussies</strong> : une consultation ne change rien, et un échec — refus,
      validation, service injoignable — ne représente aucun changement réel.
    </p>
    <p>
      Chaque ligne reprend la requête telle qu'elle a été reçue : méthode HTTP, route (sans son
      préfixe d'administration), cible de l'action et détails envoyés. Les valeurs sensibles — mot
      de passe, chaîne de connexion, jeton — y sont remplacées par <code>***</code> : ce journal ne
      doit jamais devenir une seconde fuite du secret que le registre chiffré protège.
    </p>

    <h2 id="aide-stats-conservation" class="fr-h5">Sur quelle période portent ces chiffres</h2>
    <p>
      Les journaux qui alimentent cette page ne sont plus conservés indéfiniment : au-delà d'une
      durée réglable par journal (paramètres <code>retention_*_days</code> du panneau
      d'administration), les entrées les plus anciennes sont supprimées une fois par jour. Une
      volumétrie qui baisse d'un mois sur l'autre peut donc traduire une purge et non une baisse
      d'usage.
    </p>
    <p>
      La valeur <code>0</code> signifie <strong>conservation illimitée</strong>. Le panneau
      d'administration indique, journal par journal, combien d'entrées la purge emporterait avec
      le réglage courant — à consulter avant de raccourcir une durée.
    </p>

    <h2 id="aide-stats-groupes" class="fr-h5">Lire les répartitions par groupe</h2>
    <p>
      Trois précautions valent pour tous les tableaux « par groupe » de cette page :
    </p>
    <ul>
      <li>
        Un utilisateur appartenant à plusieurs groupes compte dans chacun d'eux : la somme des
        lignes dépasse donc le total global, et ce n'est pas une anomalie.
      </li>
      <li>
        « Non renseigné » rassemble les enregistrements antérieurs à la capture des groupes et les
        utilisateurs sans appartenance — et, pour les suggestions, celles déposées anonymement, que
        rien ne permet de distinguer sans percer l'anonymat. Les recherches anonymisées par leur
        auteur, elles, gardent leurs groupes : elles restent comptées dans leur service.
      </li>
      <li>
        Aucun effectif minimum n'est appliqué : dans un groupe très restreint, ces chiffres peuvent
        désigner une seule personne. À manier en conséquence — y compris pour les recherches
        anonymisées, dont le service subsiste : l'anonymisation ôte le nom, elle ne rend pas
        indevinable ce qu'un effectif de trois laisse deviner.
      </li>
    </ul>

    <h2 id="aide-stats-contact" class="fr-h5">Besoin d'aide&nbsp;?</h2>
    <p>
      L'aide de la page d'administration est sur
      <a class="fr-link" href="/admin-help">/admin-help</a>. Pour le reste, consultez la
      documentation du projet (<code>docsearch-docs</code>) ou contactez l'équipe technique.
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
    :desc-text="'DocSearch — Aide des statistiques'"
    :licence-text="uiConfig.footerBottomText"
    licence-name=""
    :mandatory-links="[]"
    :ecosystem-links="[]"
    operator-img-src="/logo-docsearch.svg"
    operator-img-alt="DocSearch"
    operator-img-style="max-width: 2.5rem"
  />
</template>
