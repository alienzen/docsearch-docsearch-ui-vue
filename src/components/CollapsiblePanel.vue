<script setup lang="ts">
/**
 * Panneau repliable, partagé par les pages de statistiques et
 * d'administration. Portage de panelWrap()/toggleAccordion(), commun aux
 * deux pages d'origine à quelques détails près.
 *
 * Le store est passé en prop plutôt que résolu ici : c'est ce qui permet
 * aux deux pages — et aux deux niveaux de pli de l'administration
 * (groupes et panneaux) — de partager ce composant sans se marcher
 * dessus.
 *
 * S'appuie sur <details>/<summary> natif : accessible au clavier et aux
 * lecteurs d'écran sans code supplémentaire, contrairement au
 * <div onclick> d'origine.
 */
import { computed } from 'vue'

type CollapseStore = {
  isCollapsed: (id: string) => boolean
  toggle: (id: string) => void
  /** Identifiants affichés, dans l'ordre — voir shortcutDigit. */
  known: string[]
}

const props = defineProps<{
  /**
   * Clé de pli dans le store ET identifiant du `<details>` dans le
   * document. Les deux rôles se confondent volontairement : un panneau
   * est unique dans sa page, et une clé de pli qui ne serait pas unique
   * replierait déjà deux panneaux à la fois.
   */
  id: string
  title: string
  subtitle?: string
  store: CollapseStore
  /** Message d'erreur, affiché à la place du contenu. */
  error?: string | null
  /** Style « groupe » : titre plus marqué, contenu en retrait. */
  group?: boolean
}>()

const open = computed(() => !props.store.isCollapsed(props.id))

/**
 * Chiffre du raccourci qui replie cette section, ou null au-delà de la
 * neuvième. Sans cet indice, les touches 1 à 9 ne se découvriraient que
 * dans la palette — la même raison qui a fait poser des infobulles sur
 * les autres commandes.
 *
 * `known` est renseigné par la page dans l'ordre d'affichage : c'est le
 * même ordre que celui parcouru par le raccourci.
 */
const shortcutDigit = computed(() => {
  const i = props.store.known.indexOf(props.id)
  return i >= 0 && i < 9 ? String(i + 1) : null
})

/**
 * `toggle` est émis APRÈS que le navigateur a changé l'état : il faut
 * recopier l'état réel de l'élément et non l'inverser, sous peine de
 * boucle de rendu (l'onglet se fige, sans erreur en console).
 */
function onToggle(event: Event) {
  const isOpen = (event.target as HTMLDetailsElement).open
  if (isOpen !== open.value) props.store.toggle(props.id)
}
</script>

<template>
  <details
    :id="id"
    class="fr-accordion ds-panel-block"
    :class="{ 'ds-panel-block--group': group }"
    :open="open"
    @toggle="onToggle"
  >
    <!-- `fr-ml-1w` et non une espace littérale : Vue supprime les nœuds
         de texte purement blancs entre une interpolation et un élément,
         et le titre se retrouvait collé à son sous-titre. -->
    <!-- `aria-expanded` est INDISPENSABLE au rendu, pas seulement à
         l'accessibilité : le DSFR pivote le chevron et colore le fond
         sur .fr-accordion__btn[aria-expanded=true]. L'attribut natif
         `open` de <details> ne déclenche aucune de ces deux règles, si
         bien que le chevron restait figé quel que soit l'état. -->
    <summary
      class="fr-accordion__btn"
      :aria-expanded="open"
      :title="shortcutDigit ? `${title} — replier ou déplier (${shortcutDigit})` : title"
      :aria-keyshortcuts="shortcutDigit || undefined"
    >
      {{ title }}
      <small v-if="subtitle" class="fr-hint-text fr-ml-1w">{{ subtitle }}</small>
    </summary>
    <div class="fr-accordion__inner">
      <DsfrAlert v-if="error" type="error" small :description="error" />
      <slot v-else />
    </div>
  </details>
</template>
