<script setup lang="ts">
/**
 * Sommaire collant d'une page à panneaux : une ligne de recherche, puis
 * l'arbre des sections. Partagé par l'administration et les
 * statistiques, qui lui passent leurs sections et leur index — il ne
 * connaît ni les unes ni les autres (voir `utils/sommaire.ts`).
 *
 * Deux modes, jamais les deux à la fois : saisie vide, l'arbre des
 * sections ; saisie non vide, la liste des résultats. Les résultats
 * remplacent l'arbre au lieu de s'afficher au-dessus de lui — le
 * sommaire est une colonne collante à défilement propre, une liste
 * flottante s'y ferait rogner par `overflow`.
 *
 * Sauter à une entrée déplie ses `<details>` ancêtres, défile, DONNE LE
 * FOCUS à la cible et la souligne deux secondes. Le focus compte plus
 * que le défilement : sans lui, on retombe devant une liste de vingt-cinq
 * cases à cocher sans savoir laquelle était visée.
 *
 * Le sommaire n'est PAS l'inventaire du repli : c'est le `sections.ts`
 * de chaque page qui l'est, et il sert aussi bien à « Tout replier »
 * qu'aux raccourcis chiffrés.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
import { chercher, type Entree, type Section } from '@/utils/sommaire'

/** Ce que le sommaire demande à un store de pli, et rien de plus. */
type StoreDePli = { deplier: (id: string) => void }

const props = defineProps<{
  /**
   * Identifiant du `<nav>` : la bascule qui escamote le sommaire vit
   * dans la page et le désigne par `aria-controls`.
   */
  menuId: string
  sections: Section[]
  index: Entree[]
  /**
   * Stores de pli à ouvrir pour atteindre une ancre. Chacun est
   * sollicité pour chaque identifiant : un identifiant qu'un store ne
   * connaît pas ne lui coûte rien, et ça évite d'avoir à savoir si
   * `group-interface` est un groupe ou un panneau.
   */
  stores: StoreDePli[]
}>()

const ID_CHAMP = 'sommaire-recherche'
const ID_RESULTATS = 'sommaire-resultats'

/** Espace laissé entre le haut de la fenêtre et la cible, après défilement. */
const MARGE_PX = 16

/** Durée du soulignement de la cible. */
const SURBRILLANCE_MS = 2000

/** Un peu plus que la transition d'ouverture d'un panneau — voir defiler(). */
const DUREE_OUVERTURE_MS = 350

const champ = useTemplateRef<HTMLInputElement>('champ')
const saisie = ref('')
const actif = ref(-1)

const resultats = computed(() => chercher(props.index, saisie.value))
const enRecherche = computed(() => normaliseeNonVide(saisie.value))
const listeOuverte = computed(() => enRecherche.value && resultats.value.entrees.length > 0)

function normaliseeNonVide(texte: string) {
  return texte.trim().length > 0
}

const idOption = (index: number) => `${ID_RESULTATS}-option-${index}`

/* ── Saut vers une ancre ──────────────────────────────────────────── */

let minuteur: ReturnType<typeof setTimeout> | undefined
let minuteurOuverture: ReturnType<typeof setTimeout> | undefined

/** Déplie tous les `<details>` qui contiennent l'élément, lui-même compris. */
function deplierAncetres(element: HTMLElement) {
  let details = element.closest('details')
  while (details) {
    if (details.id) {
      for (const store of props.stores) store.deplier(details.id)
    }
    details = details.parentElement?.closest('details') ?? null
  }
}

const FOCALISABLES = 'input, select, textarea, button, a[href], summary'

/**
 * Le focus va au contrôle lui-même quand c'en est un, au `<summary>`
 * quand la cible est un panneau. Sur un titre ou un tableau, `tabindex`
 * négatif : c'est ce qui fait suivre les lecteurs d'écran, sans ajouter
 * l'élément au parcours de tabulation.
 */
function focaliser(cible: HTMLElement) {
  const element =
    cible instanceof HTMLDetailsElement ? cible.querySelector<HTMLElement>('summary') : cible
  if (!element) return
  if (!element.matches(FOCALISABLES)) element.setAttribute('tabindex', '-1')
  element.focus({ preventScroll: true })
}

/**
 * Défilement calculé plutôt que `scrollIntoView` : l'en-tête est collant,
 * la cible se retrouverait dessous.
 *
 * L'en-tête est MESURÉ, et non lu dans `--ds-header-height` : le
 * défilement déclenche justement son repli (voir useHeaderReduit), si
 * bien que la variable vaut encore la hauteur d'avant au moment du
 * calcul. La seconde passe (voir allerA) mesure l'en-tête déjà replié.
 *
 * `instant` et non `smooth` : le défilement doux s'est révélé
 * purement inerte sur le Chrome de la VM — `scrollTo` n'y déplaçait
 * RIEN, sans erreur, et la cible recevait le focus sans qu'on la voie.
 * Un saut immédiat, doublé du soulignement de deux secondes, dit de
 * toute façon plus clairement où l'on vient d'atterrir qu'une
 * animation de mille pixels.
 */
function defiler(cible: HTMLElement) {
  const entete = document.querySelector('header.fr-header')?.getBoundingClientRect().height ?? 0
  const haut = cible.getBoundingClientRect().top + window.scrollY - entete - MARGE_PX
  window.scrollTo({ top: Math.max(0, haut), behavior: 'instant' })
}

/** Le geste complet une fois la cible connue : focus, puis défilement. */
function viser(cible: HTMLElement) {
  focaliser(cible)
  defiler(cible)
}

function souligner(cible: HTMLElement) {
  for (const ancienne of document.querySelectorAll('.ds-cible')) {
    ancienne.classList.remove('ds-cible')
  }
  cible.classList.add('ds-cible')
  clearTimeout(minuteur)
  minuteur = setTimeout(() => cible.classList.remove('ds-cible'), SURBRILLANCE_MS)
}

/**
 * `repli` couvre les ancres qui n'existent pas encore : un tableau n'est
 * rendu qu'une fois ses données chargées, et une entrée d'index ne peut
 * pas le savoir. On atterrit alors sur le panneau, ce qui reste utile.
 */
async function allerA(id: string, repli?: string) {
  const cible =
    document.getElementById(id) ?? (repli ? document.getElementById(repli) : null)
  if (!cible) return
  deplierAncetres(cible)
  // Le dépli passe par les stores : attendre le rendu, sinon la cible
  // est mesurée alors que son panneau est encore fermé.
  await nextTick()
  souligner(cible)
  viser(cible)

  // Puis une seconde fois, l'ouverture du panneau terminée. Constaté en
  // exécutant la page, et invisible autrement : pendant les 0,3 s de la
  // transition sur `::details-content` (app.css), le contenu est encore
  // `content-visibility: hidden` — `focus()` y est REFUSÉ sans la
  // moindre erreur, et le focus restait sur la ligne de recherche. La
  // page n'a pas non plus fini de grandir, si bien qu'un défilement
  // demandé plus bas que sa hauteur se fait rogner.
  clearTimeout(minuteurOuverture)
  minuteurOuverture = setTimeout(() => viser(cible), DUREE_OUVERTURE_MS)
}

function choisir(entree: Entree) {
  allerA(entree.id, entree.panneau)
  saisie.value = ''
  actif.value = -1
}

/* ── Clavier ──────────────────────────────────────────────────────── */

function surTouche(event: KeyboardEvent) {
  const entrees = resultats.value.entrees
  if (event.key === 'Escape') {
    // Première pression : on efface. Seconde (champ déjà vide) : on rend
    // le focus à la page, sans quoi « / » resterait la seule sortie.
    if (saisie.value) saisie.value = ''
    else champ.value?.blur()
    actif.value = -1
    return
  }
  if (!listeOuverte.value) return
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    actif.value = (actif.value + 1) % entrees.length
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    actif.value = actif.value <= 0 ? entrees.length - 1 : actif.value - 1
  } else if (event.key === 'Enter') {
    event.preventDefault()
    // Sans sélection explicite, Entrée prend le premier résultat : c'est
    // le comportement attendu quand on tape puis valide sans regarder.
    choisir(entrees[Math.max(0, actif.value)])
  }
}

/** `mousedown` et non `click` : le `blur` du champ arriverait avant. */
function surClic(event: MouseEvent, entree: Entree) {
  event.preventDefault()
  choisir(entree)
}

/* ── Section active au défilement ─────────────────────────────────── */

const sectionActive = ref(props.sections[0]?.id ?? '')

/**
 * La dernière section dont le haut est passé au-dessus du quart supérieur
 * de la fenêtre. Un seuil et non l'intersection exacte : les sections sont
 * hautes, et plusieurs sont visibles à la fois.
 */
function majSectionActive() {
  const seuil = window.innerHeight * 0.25
  let trouve = props.sections[0]?.id ?? ''
  for (const section of props.sections) {
    const element = document.getElementById(section.id)
    if (element && element.getBoundingClientRect().top <= seuil) trouve = section.id
  }
  sectionActive.value = trouve
}

let enAttente = false

function surDefilement() {
  if (enAttente) return
  enAttente = true
  requestAnimationFrame(() => {
    enAttente = false
    majSectionActive()
  })
}

onMounted(() => {
  window.addEventListener('scroll', surDefilement, { passive: true })
  majSectionActive()
  // Lien profond : /admin.html#ui-alerts_enabled ouvre le panneau et
  // pointe le réglage. C'est ce qui permet à l'aide de renvoyer vers un
  // réglage précis plutôt que vers la page entière.
  const ancre = decodeURIComponent(location.hash.slice(1))
  if (ancre) {
    const entree = props.index.find((candidate) => candidate.id === ancre)
    allerA(ancre, entree?.panneau)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', surDefilement)
  clearTimeout(minuteur)
  clearTimeout(minuteurOuverture)
})

function focaliserChamp() {
  champ.value?.focus()
  champ.value?.select()
}

defineExpose({ focaliserChamp, allerA, resultats, saisie })
</script>

<template>
  <DsfrSideMenu
    :id="menuId"
    class="ds-sommaire"
    heading-title="Sections"
    button-label="Aller à une section"
    :side-menu-list-id="`${menuId}-liste`"
  >
    <div class="fr-input-group ds-sommaire__recherche">
      <label class="fr-label" :for="ID_CHAMP">
        Aller à une section
        <span class="fr-hint-text">Titre de section, de réglage ou d’action (/)</span>
      </label>
      <!-- `type="search"` pour la croix d'effacement native, et
           `autocomplete="off"` pour que le navigateur ne superpose pas
           ses propres suggestions à la liste. -->
      <input
        :id="ID_CHAMP"
        ref="champ"
        v-model="saisie"
        class="fr-input fr-input--sm"
        type="search"
        role="combobox"
        aria-autocomplete="list"
        :aria-controls="ID_RESULTATS"
        :aria-expanded="listeOuverte"
        :aria-activedescendant="listeOuverte && actif >= 0 ? idOption(actif) : undefined"
        autocomplete="off"
        @keydown="surTouche"
      />
    </div>

    <!-- `v-show` : `aria-controls` doit désigner un élément existant,
         liste fermée comprise. -->
    <ul
      v-show="listeOuverte"
      :id="ID_RESULTATS"
      class="fr-sidemenu__list ds-sommaire__resultats"
      role="listbox"
      aria-label="Entrées correspondantes"
    >
      <li
        v-for="(entree, index) in resultats.entrees"
        :id="idOption(index)"
        :key="entree.id"
        class="fr-sidemenu__item ds-sommaire__resultat"
        :class="{ 'ds-sommaire__resultat--actif': index === actif }"
        role="option"
        :aria-selected="index === actif"
        data-testid="sommaire-resultat"
        :data-cible="entree.id"
        @mousedown="surClic($event, entree)"
        @mouseenter="actif = index"
      >
        <span class="ds-sommaire__libelle">{{ entree.libelle }}</span>
        <span v-if="entree.chemin" class="fr-hint-text ds-sommaire__chemin">{{ entree.chemin }}</span>
      </li>
    </ul>

    <p
      v-if="enRecherche && !resultats.entrees.length"
      id="sommaire-sans-resultat"
      class="fr-hint-text fr-mt-1w"
    >
      Aucune entrée ne correspond. Le sommaire ne cherche que dans l’interface, pas dans les données
      des panneaux.
    </p>

    <!-- Le décompte des résultats écartés est affiché : une liste
         tronquée en silence se lit comme une liste complète. -->
    <p
      v-else-if="resultats.total > resultats.entrees.length"
      id="sommaire-tronque"
      class="fr-hint-text fr-mt-1w"
    >
      {{ resultats.total - resultats.entrees.length }} autre(s) résultat(s) — précisez la recherche.
    </p>

    <ul v-show="!enRecherche" class="fr-sidemenu__list">
      <li
        v-for="section in sections"
        :key="section.id"
        class="fr-sidemenu__item"
        :class="{ 'fr-sidemenu__item--active': section.id === sectionActive }"
      >
        <a
          class="fr-sidemenu__link"
          :href="`#${section.id}`"
          :aria-current="section.id === sectionActive ? 'true' : undefined"
          data-testid="sommaire-section"
          @click.prevent="allerA(section.id)"
        >
          {{ section.titre }}
        </a>
        <!-- Second niveau seulement s'il y en a un : sur les
             statistiques, chaque section EST un panneau. -->
        <ul v-if="section.panneaux?.length" class="fr-sidemenu__list">
          <li v-for="panneau in section.panneaux" :key="panneau.id" class="fr-sidemenu__item">
            <a
              class="fr-sidemenu__link"
              :href="`#${panneau.id}`"
              data-testid="sommaire-panneau"
              @click.prevent="allerA(panneau.id)"
            >
              {{ panneau.titre }}
            </a>
          </li>
        </ul>
      </li>
    </ul>
  </DsfrSideMenu>
</template>
