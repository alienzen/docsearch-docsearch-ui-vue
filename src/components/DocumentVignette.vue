<script setup lang="ts">
/**
 * Vignette d'un document — l'illustration qu'un module complémentaire a
 * jointe au sien. Aujourd'hui l'image d'un article de flux, portée par
 * le champ `image` que les sources du module RSS déclarent.
 *
 * Ce n'est PAS un aperçu : rien n'est converti ni stocké par le produit.
 * Le document ne porte qu'une adresse, que le navigateur de
 * l'utilisateur va chercher lui-même — d'où les trois précautions
 * ci-dessous, l'adresse venant d'un tiers (l'éditeur du flux) et
 * restant indexée indéfiniment en mode archive.
 */
import { computed, ref, watch } from 'vue'
import { lienExterne } from '@/utils/paths'

const props = defineProps<{
  url?: string
  /** `carte` dans la liste des résultats, `detail` dans la fiche. */
  format?: 'carte' | 'detail'
}>()

/**
 * 1. Liste blanche de schémas, la même que le lien de la carte : le
 *    `:src` de Vue n'assainit rien, et une adresse écrite par un module
 *    tiers n'a pas à devenir une requête du navigateur sans contrôle.
 */
const src = computed(() => lienExterne(props.url))

/**
 * 2. Une image qui ne répond pas est RETIRÉE, pas laissée en cadre
 *    brisé. Le cas est attendu et non exceptionnel : le module ne
 *    télécharge rien et ne vérifie pas que l'adresse existe, et un
 *    article reste indexé longtemps après le retrait de son
 *    illustration.
 *
 * La remise à zéro sur changement d'adresse n'est pas de la précaution
 * gratuite : une carte de résultat est réutilisée d'une recherche à
 * l'autre, et sans elle, une vignette cassée masquerait celle du
 * document affiché ensuite au même endroit.
 */
const casse = ref(false)
watch(src, () => (casse.value = false))
</script>

<template>
  <!-- 3. `referrerpolicy` : le serveur d'images n'a pas à apprendre
          depuis quelle page on la demande. Sans conséquence sur un flux
          interne, qui est le cas d'emploi visé, mais le jour où une
          adresse externe se glisse dans un flux, elle ne dira rien.

       `alt` vide, et c'est délibéré : l'image est DÉCORATIVE, le titre
       de l'article la précède et porte déjà l'information. Un `alt`
       reprenant ce titre le ferait entendre deux fois à un lecteur
       d'écran.

       Un `data-testid` et non un `id`, dans les DEUX emplois : sur la
       carte de résultat l'élément est répété vingt fois, ce qui l'impose
       (voir « Identifiants des éléments d'interface » du README), et la
       fiche détail garde le même plutôt que d'ajouter un attribut
       conditionnel à un composant de dix lignes. Le format se lit dans
       la classe, que les tests vérifient. -->
  <img
    v-if="src && !casse"
    class="ds-vignette"
    :class="format === 'detail' ? 'ds-vignette--detail' : 'ds-vignette--carte'"
    :src="src"
    alt=""
    loading="lazy"
    decoding="async"
    referrerpolicy="no-referrer"
    data-testid="vignette"
    @error="casse = true"
  />
</template>
