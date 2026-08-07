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

async function reprendreSession(): Promise<boolean> {
  const reponse = await fetch('/auth/refresh', { method: 'POST' }).catch(() => null)
  return reponse?.ok ?? false
}

async function essayerSso(forcer = false) {
  if (!forcer && !ssoAutorise()) return false
  if (forcer) autoriserSsoANouveau()

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
      erreur.value = resultat.message
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
       différentes s'y remarquent immédiatement. -->
  <main id="main-content" class="fr-container fr-my-6w">
    <div class="fr-grid-row fr-grid-row--center">
      <div class="fr-col-12 fr-col-md-6">
        <h1 class="fr-h4">Connexion</h1>

        <p v-if="decouverte" class="fr-text--sm fr-mb-3w">
          Vérification de votre session…
        </p>

        <template v-else>
          <DsfrAlert
            v-if="erreur"
            type="error"
            :description="erreur"
            small
            class="fr-mb-3w"
          />

          <form class="fr-mt-3w" @submit.prevent="soumettre">
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
            <DsfrButton
              type="submit"
              icon="fr-icon-lock-unlock-line"
              :disabled="enCours || !identifiant || !motDePasse"
              :label="enCours ? 'Connexion…' : 'Se connecter'"
            />
          </form>

          <!-- Rattrapage : pour qui vient de se déconnecter et veut se
               reconnecter sans changer de compte, et pour diagnostiquer
               un poste dont on ne sait pas s'il est configuré. Masqué si
               le serveur a répondu 501 — le SSO est éteint, le bouton ne
               ferait que promettre ce qui n'existe pas. -->
          <p v-if="ssoDisponible" class="fr-mt-4w">
            <DsfrButton
              secondary
              icon="ri-windows-line"
              label="Se connecter avec ma session Windows"
              :disabled="enCours"
              @click="essayerSso(true)"
            />
          </p>
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
