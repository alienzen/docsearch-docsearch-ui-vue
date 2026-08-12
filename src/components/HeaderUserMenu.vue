<script setup lang="ts">
/**
 * Menu déroulant « compte » dans les outils de l'en-tête.
 *
 * Le badge « Connecté : … » et « Se déconnecter » occupaient deux entrées
 * de `quickLinks`, la première pouvant à elle seule être très longue —
 * elle porte le nom d'utilisateur ET la liste de ses groupes. Les deux
 * sont désormais repliés derrière un seul bouton.
 *
 * Rendu dans le slot `after-quick-links` de DsfrHeader, qui débouche DANS
 * `.fr-header__tools-links` : c'est le seul moyen d'y placer autre chose
 * qu'un `quickLink`, et c'est là que le DSFR pose lui-même son sélecteur
 * de langue, bâti sur ce même balisage `.fr-nav` + `.fr-menu`.
 */
import { computed, ref, useId } from 'vue'
import { useUiConfigStore } from '@/stores/uiConfig'
import { useOutsideClose } from '@/composables/useOutsideClose'

const props = withDefaults(
  defineProps<{
    /**
     * Jeu de bascules d'affichage à appliquer : les pages d'administration
     * ont les leurs (`show_current_user_enabled_admin`…).
     */
    family: 'search' | 'admin'
    /**
     * Liens à ranger dans le menu au-dessus de la déconnexion. C'est à la
     * page de décider ce qu'elle y verse et sous quelle condition : la
     * page de recherche y met « Statistiques » et « Administration », que
     * la même bascule et le même groupe LDAP gouvernent que le reste.
     */
    links?: { label: string; href: string; icon: string; current?: boolean }[]
  }>(),
  { links: () => [] },
)

const uiConfig = useUiConfigStore()

const menuId = `menu-${useId()}`
const open = ref(false)
const item = ref<HTMLElement | null>(null)
const button = ref<HTMLButtonElement | null>(null)

/**
 * « Connecté : untel · ses groupes », vide si l'administrateur a
 * désactivé le badge pour cette famille de pages.
 */
const label = computed(() =>
  props.family === 'admin' ? uiConfig.currentUserLabelAdmin : uiConfig.currentUserLabel,
)

/**
 * Le menu n'a de raison d'être que pour un utilisateur authentifié :
 * `currentUser` n'est renseigné que par /is-admin, qui rend `null` pour
 * un visiteur anonyme.
 */
const visible = computed(() => Boolean(uiConfig.currentUser.user))

/**
 * Badge désactivé = l'administrateur ne veut PAS qu'on affiche qui est
 * connecté : le bouton retombe alors sur un libellé générique, et le menu
 * ne sert plus qu'à la déconnexion.
 */
const buttonLabel = computed(() => (label.value && uiConfig.currentUser.user) || 'Mon compte')

function close(refocus: boolean) {
  open.value = false
  if (refocus) button.value?.focus()
}

// Clic extérieur et Échap, comme les menus de la navigation
// (NavMenuItem). Le focus ne revient au bouton que s'il était dans le
// menu — à Échap donc, mais pas au clic extérieur, où l'utilisateur vise
// déjà autre chose.
useOutsideClose(
  item,
  () => open.value,
  () => close(item.value?.contains(document.activeElement) ?? false),
)
</script>

<template>
  <!-- `position: relative` posé par app.css sur .ds-header__account :
       au-delà de 62em le DSFR passe .fr-nav__item en `position: initial`
       et le menu en absolu, qui s'ancrerait sinon sur un ancêtre
       lointain. C'est exactement ce que fait `.fr-translate`. -->
  <div v-if="visible" ref="item" class="fr-nav ds-header__account">
    <div class="fr-nav__item">
      <button
        ref="button"
        class="fr-btn fr-btn--sm fr-btn--tertiary fr-btn--icon-left fr-icon-account-line"
        type="button"
        :aria-expanded="open"
        :aria-controls="menuId"
        @click="open = !open"
      >
        {{ buttonLabel }}
      </button>

      <!-- Le JS du DSFR n'est pas chargé : le dépli tient à la seule
           bascule de `fr-collapse--expanded`, le reste est en CSS. -->
      <div
        :id="menuId"
        class="fr-collapse fr-menu ds-menu--right"
        :class="{ 'fr-collapse--expanded': open }"
      >
        <ul class="fr-menu__list">
          <li v-if="label" class="ds-header__account-user">{{ label }}</li>
          <li v-for="lien in links" :key="lien.href">
            <!-- `aria-current` sur la page où l'on se trouve déjà : le
                 menu liste les mêmes destinations partout, c'est ce
                 marqueur qui dit laquelle est ouverte. Le DSFR le signale
                 aussi visuellement, d'un trait à gauche de l'entrée. -->
            <a
              class="fr-nav__link fr-link--icon-left"
              :class="lien.icon"
              :href="lien.href"
              :aria-current="lien.current ? 'page' : undefined"
            >
              {{ lien.label }}
            </a>
          </li>
          <li class="ds-header__account-logout">
            <!-- Lien plein page plutôt qu'un gestionnaire de clic : la
                 déconnexion doit AUSSI poser le marqueur anti-boucle du
                 SSO (sans quoi le rechargement suivant reconnecte
                 aussitôt), et la page de connexion est le seul endroit
                 qui en sait quelque chose. -->
            <a
              class="fr-nav__link fr-link--icon-left fr-icon-logout-box-r-line"
              href="/connexion?deconnexion=1"
            >
              Se déconnecter
            </a>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
