<script setup lang="ts">
/**
 * Suggestions sous la barre de recherche.
 *
 * Deux natures, dans cet ordre : ce que l'utilisateur a DÉJÀ cherché
 * lui-même, puis les auteurs et mots-clés du corpus qu'il a le droit de
 * voir (voir user_history.py côté API — les requêtes des autres
 * utilisateurs ne sont volontairement jamais proposées).
 *
 * ── Pourquoi ce composant manipule le DOM directement ────────────────
 *
 * L'input de recherche appartient à `DsfrHeader` (prop `show-search`) :
 * il n'y a aucune prise Vue pour lui poser `role="combobox"`,
 * `aria-expanded` ou `aria-activedescendant`, ni pour intercepter ses
 * touches avant que le formulaire ne se soumette. On le récupère donc
 * par son identifiant — celui que SearchPage passe en `searchbar-id`, et
 * qui est de toute façon nécessaire pour que `vue-dsfr` n'en tire pas un
 * au sort à chaque rendu — et on l'annote impérativement.
 *
 * Sans ces attributs, la liste existe pour la souris et n'existe pas pour
 * un lecteur d'écran : ce serait une régression d'accessibilité sur une
 * interface conforme au DSFR, pas une fonctionnalité en moins.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { suggerer, type Suggestion } from '@/api/historique'
import { useSearchStore } from '@/stores/search'
import { useUiConfigStore } from '@/stores/uiConfig'

const ID_BARRE = 'recherche'
const ID_LISTE = 'recherche-suggestions'

/** En dessous, la liste ne restreint rien et clignote à chaque frappe. */
const MIN_CARACTERES = 2

/**
 * Anti-rebond. 150 ms est le compromis habituel : assez pour ne pas
 * appeler l'API à chaque lettre d'une saisie rapide, assez peu pour que
 * la liste paraisse suivre les doigts.
 */
const REBOND_MS = 150

const store = useSearchStore()
const uiConfig = useUiConfigStore()

const propositions = ref<Suggestion[]>([])
const actif = ref(-1)
const ouvert = ref(false)

let minuteur: ReturnType<typeof setTimeout> | undefined
let enCours: AbortController | undefined
let barre: HTMLInputElement | null = null

const visible = computed(
  () => ouvert.value && uiConfig.config.autocomplete_enabled && propositions.value.length > 0,
)

const LIBELLES: Record<Suggestion['kind'], string> = {
  history: 'Votre recherche',
  author: 'Auteur',
  keyword: 'Mot-clé',
}

/**
 * ⚠️ Toute icône ajoutée ici doit exister DANS UNE FAMILLE IMPORTÉE
 * (`src/dsfr.ts`) ou avoir sa règle inlinée dans `app.css`. Une classe
 * `fr-icon-*` inconnue ne produit ni erreur ni avertissement : elle
 * n'affiche simplement rien. C'est ce qui est arrivé à
 * `fr-icon-price-tag-line`, qui n'existe dans aucune version du DSFR
 * livrée ici — d'où `fr-icon-hashtag`, inlinée dans app.css.
 */
const ICONES: Record<Suggestion['kind'], string> = {
  history: 'fr-icon-time-line',   // icons-system, importée
  author: 'fr-icon-user-line',    // icons-user, importée
  keyword: 'fr-icon-hashtag',     // inlinée dans app.css
}

/**
 * La syntaxe avancée (`auteur:Dupont`) a ses propres règles, et le
 * parseur la transforme en puces au moment de la recherche : proposer en
 * même temps une complétion sur le texte brut ferait s'affronter deux
 * mécanismes sur la même saisie. On se tait.
 */
function porteUnOperateur(saisie: string): boolean {
  return /\S+:\S/.test(saisie)
}

async function charger(saisie: string) {
  enCours?.abort()
  const controleur = new AbortController()
  enCours = controleur
  try {
    const { suggestions } = await suggerer(saisie, controleur.signal)
    // La réponse d'une saisie abandonnée entre-temps ne doit pas
    // réafficher des propositions périmées.
    if (controleur.signal.aborted) return
    propositions.value = suggestions
    actif.value = -1
    ouvert.value = true
  } catch {
    // Muet par construction : 403 (bascule désactivée), 503 (moteur
    // indisponible) ou saisie annulée n'ont rien à dire à quelqu'un qui
    // est en train de taper. La liste reste simplement vide.
    propositions.value = []
  }
}

watch(
  () => store.query,
  (saisie) => {
    clearTimeout(minuteur)
    const texte = saisie.trim()
    if (
      !uiConfig.config.autocomplete_enabled ||
      texte.length < MIN_CARACTERES ||
      porteUnOperateur(texte)
    ) {
      enCours?.abort()
      propositions.value = []
      return
    }
    minuteur = setTimeout(() => charger(texte), REBOND_MS)
  },
)

function fermer() {
  ouvert.value = false
  actif.value = -1
}

/**
 * Une suggestion retenue remplace TOUTE la saisie, et non son dernier
 * mot : c'est bien la saisie entière qui a servi de préfixe côté API,
 * proposer autre chose ferait diverger ce qui a été cherché de ce qui
 * est appliqué.
 *
 * Un auteur ou un mot-clé devient une PUCE de filtre, pas du texte
 * libre : c'est le même état que si la facette avait été cochée, donc le
 * même permalien (voir utils/permalien.ts).
 */
function choisir(proposition: Suggestion) {
  if (proposition.kind === 'history') {
    store.query = proposition.text
  } else {
    store.query = ''
    const cible = proposition.kind === 'author' ? store.author : store.keywords
    if (!cible.includes(proposition.text)) cible.push(proposition.text)
  }
  fermer()
  store.searchFromFirstPage('empiler')
}

const identifiantOption = (index: number) => `${ID_LISTE}-option-${index}`

function surTouche(event: KeyboardEvent) {
  if (!visible.value) return
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    actif.value = (actif.value + 1) % propositions.value.length
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    actif.value = actif.value <= 0 ? propositions.value.length - 1 : actif.value - 1
  } else if (event.key === 'Escape') {
    fermer()
  } else if (event.key === 'Enter' && actif.value >= 0) {
    // Sans ce preventDefault, le formulaire de DsfrHeader se soumet avec
    // le texte tapé et la suggestion choisie est perdue.
    event.preventDefault()
    choisir(propositions.value[actif.value])
  }
}

/** `mousedown` et non `click` : le `blur` de l'input arriverait avant. */
function surClic(event: MouseEvent, proposition: Suggestion) {
  event.preventDefault()
  choisir(proposition)
}

// Annotation ARIA de l'input, qui appartient à DsfrHeader — voir l'en-tête.
watch([visible, actif], () => {
  if (!barre) return
  barre.setAttribute('aria-expanded', String(visible.value))
  if (visible.value && actif.value >= 0) {
    barre.setAttribute('aria-activedescendant', identifiantOption(actif.value))
  } else {
    barre.removeAttribute('aria-activedescendant')
  }
})

onMounted(() => {
  barre = document.getElementById(ID_BARRE) as HTMLInputElement | null
  if (!barre) return
  barre.setAttribute('role', 'combobox')
  barre.setAttribute('aria-autocomplete', 'list')
  barre.setAttribute('aria-controls', ID_LISTE)
  barre.setAttribute('aria-expanded', 'false')
  barre.addEventListener('keydown', surTouche)
  barre.addEventListener('blur', fermer)
})

onBeforeUnmount(() => {
  clearTimeout(minuteur)
  enCours?.abort()
  barre?.removeEventListener('keydown', surTouche)
  barre?.removeEventListener('blur', fermer)
})

defineExpose({ propositions, choisir, surTouche })
</script>

<template>
  <!-- `v-show` et non `v-if` : l'`aria-controls` de l'input doit
       désigner un élément qui existe, y compris liste fermée. -->
  <ul
    v-show="visible"
    :id="ID_LISTE"
    class="ds-suggestions"
    role="listbox"
    aria-label="Suggestions de recherche"
  >
    <li
      v-for="(proposition, index) in propositions"
      :id="identifiantOption(index)"
      :key="`${proposition.kind}-${proposition.text}`"
      class="ds-suggestions__option"
      :class="{ 'ds-suggestions__option--actif': index === actif }"
      role="option"
      :aria-selected="index === actif"
      data-testid="suggestion"
      @mousedown="surClic($event, proposition)"
      @mouseenter="actif = index"
    >
      <span class="ds-suggestions__icone" :class="ICONES[proposition.kind]" aria-hidden="true" />
      <span class="ds-suggestions__texte">{{ proposition.text }}</span>
      <span class="fr-hint-text ds-suggestions__nature">{{ LIBELLES[proposition.kind] }}</span>
    </li>
  </ul>
</template>
