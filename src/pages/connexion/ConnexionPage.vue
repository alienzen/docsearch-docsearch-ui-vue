<script setup lang="ts">
/**
 * Page de connexion — la SEULE page publique de DocSearch (avec /health
 * côté API). Toutes les autres sont gardées une par une par le
 * auth_request de Nginx, qui renvoie ici en cas d'échec, avec la
 * destination demandée en `?next=`.
 *
 * Trois chemins, dans cet ordre, et l'ordre compte :
 *
 * 1. **Reprise de session.** Un simple `/auth/refresh` : le jeton d'accès
 *    ne vit que quinze minutes, celui de rafraîchissement une semaine, et
 *    la plupart des arrivées ici sont de simples expirations. Coût : un
 *    aller-retour, aucune écriture.
 * 2. **Tentative SSO** par ticket Kerberos, seulement si l'étape 1 a
 *    échoué. Cet ordre n'est pas indifférent : ouvrir une session neuve
 *    écrit une ligne d'audit et sollicite l'annuaire — l'inverser ferait
 *    payer une vraie connexion à chaque rechargement de page.
 * 3. **Le formulaire**, si les deux précédents n'ont rien donné.
 *
 * Le garde-fou anti-boucle (voir `ssoAutorise` dans api/auth.ts) est ce
 * qui rend la déconnexion possible : sans lui, se déconnecter serait sans
 * effet, le SSO reconnectant au rechargement suivant.
 */
import { computed, onMounted, ref } from 'vue'

import {
  autoriserSsoANouveau,
  ErreurConnexion,
  seConnecter,
  seDeconnecter,
  ssoAutorise,
  ssoConnuEteint,
  tenterSso,
} from '@/api/auth'
import { useUiConfigStore } from '@/stores/uiConfig'

const uiConfig = useUiConfigStore()

const identifiant = ref('')
const motDePasse = ref('')
const erreur = ref('')
const enCours = ref(false)
/**
 * Échec SSO, tenu à part de `erreur` : c'est un avertissement affiché sous
 * le bouton « session Windows », pas une erreur de saisie affichée dans le
 * formulaire — même répartition que charlie/app-front (`ssoError` vs
 * `error` dans LoginView.vue).
 */
const erreurSso = ref('')
/** Tentative SSO déclenchée au clic ; l'automatique est couverte par `decouverte`. */
const ssoEnCours = ref(false)
/** Tant que la reprise de session et la tentative SSO n'ont pas répondu. */
const decouverte = ref(true)
/**
 * `false` dès qu'un 501 a été reçu — dans cette page ou plus tôt dans
 * l'onglet. Le second cas est celui de la déconnexion : on n'y sonde pas
 * le serveur (ce serait rouvrir la session qu'on vient de fermer), et sans
 * cette mémoire on afficherait un bouton « session Windows » sur une
 * installation qui n'a pas de SSO.
 */
const ssoDisponible = ref(!ssoConnuEteint())

const parametres = new URLSearchParams(window.location.search)
/**
 * Destination d'origine. Refusée si elle n'est pas un chemin interne :
 * un `?next=https://ailleurs` transformerait cette page en redirecteur
 * ouvert, commode pour un hameçonnage qui commencerait par une URL du
 * domaine.
 */
const destination = computed(() => {
  const brut = parametres.get('next') || '/'
  return brut.startsWith('/') && !brut.startsWith('//') ? brut : '/'
})

function entrer() {
  window.location.assign(destination.value)
}

/**
 * Liens optionnels sous le formulaire (« Pas encore de compte ? », « Mot
 * de passe oublié ? »), dont l'URL vient de l'administration — voir
 * `login_*_url` dans docsearch-api/app/ui_config.py. Vide = lien masqué.
 *
 * Seuls `http(s)://` et les chemins internes sont rendus : un
 * `javascript:…` enregistré dans la configuration s'exécuterait sur la
 * seule page que tout le monde traverse, session ou non. Écrire cette
 * configuration demande déjà d'être administrateur, mais ça reste le
 * genre de valeur qui se recopie d'une installation à l'autre sans être
 * relue.
 */
function lienExterne(brut: unknown): string {
  const url = typeof brut === 'string' ? brut.trim() : ''
  if (url.startsWith('/') && !url.startsWith('//')) return url
  return /^https?:\/\//i.test(url) ? url : ''
}

const lienInscription = computed(() => lienExterne(uiConfig.config.login_inscription_url))
const lienMotDePasseOublie = computed(() =>
  lienExterne(uiConfig.config.login_mot_de_passe_oublie_url),
)

async function reprendreSession(): Promise<boolean> {
  const reponse = await fetch('/auth/refresh', { method: 'POST' }).catch(() => null)
  return reponse?.ok ?? false
}

async function essayerSso(forcer = false) {
  if (!forcer && !ssoAutorise()) return false
  if (forcer) autoriserSsoANouveau()

  erreurSso.value = ''
  const resultat = await tenterSso()
  switch (resultat.etat) {
    case 'connecte':
      entrer()
      return true
    case 'eteint':
      ssoDisponible.value = false
      return false
    case 'refuse':
    case 'panne':
      // Un ticket valide refusé, ou une panne franche : à afficher. Les
      // taire enverrait chercher un mot de passe là où il n'y en a pas.
      erreurSso.value = resultat.message
      return false
    default:
      // Défi non relevé : poste hors domaine ou navigateur non
      // configuré. Silencieux — c'est un cas parfaitement normal.
      return false
  }
}

onMounted(async () => {
  uiConfig.loadUiConfig()

  // Déconnexion demandée depuis l'en-tête (lien « Se déconnecter »).
  // Traitée ici plutôt que par un gestionnaire de clic dans chaque page :
  // un seul endroit sait aussi poser le marqueur anti-boucle.
  if (parametres.has('deconnexion')) {
    await seDeconnecter()
    decouverte.value = false
    return
  }

  if (await reprendreSession()) {
    entrer()
    return
  }
  await essayerSso()
  decouverte.value = false
})

/** Rattrapage manuel du SSO — voir le bouton dans le <template>. */
async function ssoAuClic() {
  ssoEnCours.value = true
  try {
    await essayerSso(true)
  } finally {
    ssoEnCours.value = false
  }
}

async function soumettre() {
  erreur.value = ''
  enCours.value = true
  try {
    await seConnecter(identifiant.value, motDePasse.value)
    entrer()
  } catch (e) {
    // Le message vient du serveur : générique sur un échec
    // d'identifiants (il ne dit jamais lequel des deux est en cause),
    // explicite sur un refus de groupe, une panne ou un blocage.
    erreur.value =
      e instanceof ErreurConnexion ? e.message : 'Connexion impossible. Réessayer.'
    motDePasse.value = ''
  } finally {
    enCours.value = false
  }
}
</script>

<template>
  <DsfrHeader
    :service-title="uiConfig.headerTitle"
    :service-description="uiConfig.headerSubtitle"
    :logo-text="uiConfig.logoText"
    home-to="/"
    operator-img-src="/logo-docsearch.svg"
    operator-img-alt="DocSearch"
    operator-img-style="max-width: 2.5rem"
  />

  <!-- Largeur de saisie, champ de mot de passe et icône du bouton alignés
       sur charlie/app-front/src/views/LoginView.vue : c'est l'écran que les
       mêmes personnes voient dans les deux applications, deux mises en page
       différentes s'y remarquent immédiatement.

       Espacement vertical compris : `fr-mt-4w fr-mb-6w` (2 rem / 3 rem)
       reproduit le `.app-main-container` de charlie/app-front/src/style.css
       (padding-top 2rem, padding-bottom 3rem). L'en-tête DSFR hors session
       fait exactement la même hauteur dans les deux applications, donc à
       marge égale les deux écrans se superposent au pixel. Un `fr-my-6w`
       symétrique — ce qu'il y avait ici — descendait tout le formulaire de
       16 px par rapport à charlie. -->
  <main id="main-content" class="fr-container fr-mt-4w fr-mb-6w">
    <div class="fr-grid-row fr-grid-row--center">
      <div class="fr-col-12 fr-col-md-6">
        <h1 id="connexion-titre" class="fr-h4">Connexion</h1>

        <p v-if="decouverte" id="connexion-verification" class="fr-text--sm fr-mb-3w">
          Vérification de votre session…
        </p>

        <template v-else>
          <form id="formulaire-connexion" class="fr-mt-3w" @submit.prevent="soumettre">
            <DsfrInput
              id="identifiant"
              v-model="identifiant"
              label="Identifiant"
              label-visible
              name="username"
              autocomplete="username"
              autofocus
              required
              class="fr-mb-3w"
            />
            <PasswordInput
              id="mot-de-passe"
              v-model="motDePasse"
              label="Mot de passe"
              name="password"
              autocomplete="current-password"
              required
              class="fr-mb-3w"
            />
            <!-- Message d'échec ENTRE les champs et le bouton, comme dans
                 charlie : au-dessus du formulaire, il décalait vers le bas
                 tout ce qui suit dès la première erreur de saisie. -->
            <DsfrAlert
              v-if="erreur"
              id="connexion-erreur"
              type="error"
              :description="erreur"
              small
              class="fr-mb-3w"
            />

            <!-- Désactivé pendant l'envoi SEULEMENT : un bouton grisé tant
                 que les deux champs sont vides, c'est ce que charlie
                 n'affiche pas, et l'écran s'ouvrait donc sur un bouton gris
                 là où l'autre application en montre un bleu. Les champs sont
                 `required` : la soumission à vide reste bloquée par le
                 navigateur, qui pointe en plus le champ fautif. -->
            <DsfrButton
              id="connexion-valider"
              type="submit"
              icon="fr-icon-lock-unlock-line"
              :disabled="enCours"
              :label="enCours ? 'Connexion…' : 'Se connecter'"
            />
          </form>

          <!-- Liens de démarche, aux mêmes places que dans charlie
               (fr-mt-3w puis fr-mt-2w). Absents tant que l'administration
               n'a pas saisi d'URL : DocSearch ne gère ni demande de compte
               ni réinitialisation, la destination est donc propre à
               l'installation — annuaire, portail intranet — et personne ne
               peut la deviner à sa place. Voir `login_*_url` dans
               docsearch-api/app/ui_config.py. -->
          <p v-if="lienInscription" class="fr-mt-3w fr-mb-0">
            <a id="connexion-inscription" class="fr-link" :href="lienInscription">
              Pas encore de compte ? Faire une demande d'inscription
            </a>
          </p>

          <p v-if="lienMotDePasseOublie" class="fr-mt-2w fr-mb-0">
            <a id="connexion-mot-de-passe-oublie" class="fr-link" :href="lienMotDePasseOublie">
              Mot de passe oublié ?
            </a>
          </p>

          <!-- Rattrapage : pour qui vient de se déconnecter et veut se
               reconnecter sans changer de compte, et pour diagnostiquer
               un poste dont on ne sait pas s'il est configuré. Masqué si
               le serveur a répondu 501 — le SSO est éteint, le bouton ne
               ferait que promettre ce qui n'existe pas. -->
          <template v-if="ssoDisponible">
            <DsfrButton
              id="connexion-sso"
              class="fr-mt-3w"
              secondary
              :disabled="ssoEnCours"
              :label="ssoEnCours ? 'Connexion…' : 'Se connecter avec ma session Windows'"
              @click="ssoAuClic"
            />
            <DsfrAlert
              v-if="erreurSso"
              id="connexion-erreur-sso"
              type="warning"
              :description="erreurSso"
              small
              class="fr-mt-2w"
            />
          </template>

          <!-- Jalon ProConnect, désactivé — même bouton, même libellé et
               même place que dans charlie. Volontairement pas cliquable :
               aucune route de l'API ne l'implémente (voir
               docsearch-api/app/auth/router.py), un bouton actif mènerait
               droit à une erreur. Masqué par défaut ; à n'activer que sur
               une installation où ProConnect est effectivement attendu. -->
          <DsfrButton
            v-if="uiConfig.config.login_proconnect_enabled"
            id="connexion-proconnect"
            class="fr-mt-3w"
            secondary
            disabled
            title="ProConnect n'est pas encore implémenté côté serveur"
            label="Se connecter avec ProConnect (bientôt disponible)"
          />
        </template>
      </div>
    </div>
  </main>

  <!-- Même pied de page que les autres écrans, et gouverné par la même
       bascule : sans lui, la page de connexion — souvent la première vue —
       est la seule à ne porter ni mention légale ni bloc-marque de bas de
       page. `licence-name` vidé neutralise le lien que DsfrFooter accole
       toujours à la mention de bas de page (voir SearchPage.vue). -->
  <DsfrFooter
    v-if="uiConfig.config.footer_enabled"
    :logo-text="uiConfig.logoText"
    :desc-text="uiConfig.footerText"
    :licence-text="uiConfig.footerBottomText"
    licence-name=""
    :mandatory-links="[]"
    :ecosystem-links="[]"
    operator-img-src="/logo-docsearch.svg"
    operator-img-alt="DocSearch"
    operator-img-style="max-width: 2.5rem"
  />
</template>
