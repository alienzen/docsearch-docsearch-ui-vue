<script setup lang="ts">
/**
 * Accueil animé de la page de recherche, tant qu'aucune recherche n'a
 * été lancée. Purement décoratif, pilotable par l'administrateur
 * (`empty_state_animation_enabled`).
 *
 * Six variantes tirées au sort à chaque chargement. Le tirage se fait au
 * montage et n'est pas mémorisé : c'est le principe même du procédé, et
 * il n'y a rien à retrouver d'une visite à l'autre puisque aucune ne
 * porte d'état.
 *
 * Les illustrations sont dessinées ici plutôt que reprises des
 * pictogrammes livrés par @gouvfr/dsfr : ces derniers embarquent leurs
 * couleurs en dur dans une balise <style>, donc du bleu France sur fond
 * sombre en thème nuit. Un SVG en ligne peut, lui, consommer les jetons
 * DSFR et suivre le thème.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useSearchStore } from '@/stores/search'

const store = useSearchStore()

/**
 * Les trois dernières illustrent la devise « Explorez, trouvez,
 * comprenez » : la boussole et la constellation pour l'exploration,
 * l'ampoule pour la compréhension — les trois premières couvrant déjà
 * la recherche proprement dite.
 */
const VARIANTS = ['picto', 'suggestions', 'scan', 'compass', 'constellation', 'bulb'] as const
const variant = VARIANTS[Math.floor(Math.random() * VARIANTS.length)]

/**
 * Réglage système « réduire les animations ». Il prime sur la bascule
 * d'administration : celle-ci autorise l'animation pour l'installation,
 * elle ne peut pas l'imposer à quelqu'un que le mouvement gêne. Le bloc
 * reste affiché — c'est le mouvement qui disparaît, la CSS neutralisant
 * par ailleurs les animations.
 */
const reducedMotion =
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

// Exemples repris de la syntaxe avancée, présentés par les TROIS
// variantes : ils occupent la page vide et enseignent des opérateurs
// qu'on ne découvre autrement que dans l'aide. Seule leur présentation
// change — la variante « suggestions » les fait défiler un à un, les
// deux autres les affichent ensemble sous leur illustration.
const EXAMPLES = [
  'auteur:Dupont budget',
  'type:pdf marché public',
  '"délégation de service"',
  'source:RH congés 2025',
]

const current = ref(0)
let timer: ReturnType<typeof setInterval> | undefined

/** Un exemple à la fois, qui tourne — sinon les quatre d'un bloc. */
const rotating = variant === 'suggestions' && !reducedMotion

function runExample(example: string) {
  store.query = example
  store.searchFromFirstPage()
}

onMounted(() => {
  if (!rotating) return
  timer = setInterval(() => (current.value = (current.value + 1) % EXAMPLES.length), 3200)
})

onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <section
    id="invite-recherche"
    class="ds-empty"
    :class="`ds-empty--${variant}`"
    :data-variante="variant"
    aria-label="Bienvenue"
  >
    <!-- Variante « balayage » : une loupe dérive lentement au-dessus
         d'un semis de documents, qui s'éclairent à tour de rôle sur son
         passage. Tout est visible à l'arrêt — seuls la dérive et les
         éclats sont animés — pour que la variante tienne encore debout
         quand le mouvement est neutralisé. -->
    <svg
      v-if="variant === 'scan'"
      class="ds-empty__picto ds-empty__scan"
      viewBox="0 0 160 96"
      role="img"
      aria-label="Une loupe parcourt un ensemble de documents"
    >
      <g class="ds-empty__dots">
        <template v-for="row in 4" :key="row">
          <rect
            v-for="col in 7"
            :key="`${row}-${col}`"
            :x="10 + (col - 1) * 22"
            :y="10 + (row - 1) * 22"
            width="12"
            height="15"
            rx="2"
            :style="{ animationDelay: `${((row * 7 + col) % 9) * 0.7}s` }"
          />
        </template>
      </g>
      <g class="ds-empty__lens">
        <circle cx="34" cy="46" r="17" />
        <line x1="46" y1="58" x2="57" y2="69" />
      </g>
    </svg>

    <svg
      v-if="variant === 'picto'"
      class="ds-empty__picto"
      viewBox="0 0 120 96"
      role="img"
      aria-label="Une loupe parcourt des documents"
    >
      <!-- Les trois feuillets, décalés dans le temps pour donner
           l'impression d'une pile qu'on feuillette. -->
      <g class="ds-empty__sheets">
        <rect class="ds-empty__sheet" x="18" y="14" width="52" height="68" rx="4" />
        <rect class="ds-empty__sheet ds-empty__sheet--2" x="26" y="20" width="52" height="68" rx="4" />
      </g>
      <g class="ds-empty__lines" aria-hidden="true">
        <rect x="34" y="32" width="36" height="4" rx="2" />
        <rect x="34" y="44" width="28" height="4" rx="2" />
        <rect x="34" y="56" width="32" height="4" rx="2" />
      </g>
      <!-- La loupe balaie la pile. -->
      <g class="ds-empty__lens">
        <circle cx="78" cy="46" r="18" />
        <line x1="91" y1="59" x2="104" y2="72" />
      </g>
    </svg>

    <!-- « Explorez » — l'aiguille oscille doucement autour du nord. -->
    <svg
      v-if="variant === 'compass'"
      class="ds-empty__picto"
      viewBox="0 0 120 96"
      role="img"
      aria-label="Une boussole"
    >
      <circle class="ds-empty__dial" cx="60" cy="48" r="34" />
      <g class="ds-empty__ticks">
        <line x1="60" y1="8" x2="60" y2="16" />
        <line x1="60" y1="80" x2="60" y2="88" />
        <line x1="20" y1="48" x2="28" y2="48" />
        <line x1="92" y1="48" x2="100" y2="48" />
      </g>
      <g class="ds-empty__needle">
        <polygon class="ds-empty__needle-n" points="60,20 66,48 54,48" />
        <polygon class="ds-empty__needle-s" points="60,76 66,48 54,48" />
      </g>
      <circle class="ds-empty__hub" cx="60" cy="48" r="3" />
    </svg>

    <!-- « Explorez » — le chemin se trace de proche en proche. -->
    <svg
      v-if="variant === 'constellation'"
      class="ds-empty__picto ds-empty__scan"
      viewBox="0 0 160 96"
      role="img"
      aria-label="Un chemin reliant des documents"
    >
      <polyline class="ds-empty__path" points="18,72 44,40 72,58 100,24 134,52" />
      <g class="ds-empty__stars">
        <circle
          v-for="(point, i) in [
            [18, 72],
            [44, 40],
            [72, 58],
            [100, 24],
            [134, 52],
          ]"
          :key="i"
          :cx="point[0]"
          :cy="point[1]"
          r="5"
          :style="{ animationDelay: `${i * 0.8}s` }"
        />
      </g>
    </svg>

    <!-- « Comprenez » — les rais s'allument l'un après l'autre. -->
    <svg
      v-if="variant === 'bulb'"
      class="ds-empty__picto"
      viewBox="0 0 120 96"
      role="img"
      aria-label="Une ampoule qui s'allume"
    >
      <g class="ds-empty__rays">
        <line x1="86" y1="40" x2="94" y2="40" style="animation-delay: 0s" />
        <line x1="73" y1="18" x2="77" y2="11" style="animation-delay: 0.5s" />
        <line x1="47" y1="18" x2="43" y2="11" style="animation-delay: 1s" />
        <line x1="34" y1="40" x2="26" y2="40" style="animation-delay: 1.5s" />
      </g>
      <circle class="ds-empty__glass" cx="60" cy="40" r="20" />
      <path class="ds-empty__filament" d="M53 38 L57 46 L60 38 L63 46 L67 38" />
      <rect class="ds-empty__socket" x="52" y="60" width="16" height="8" rx="2" />
      <line class="ds-empty__socket-line" x1="53" y1="73" x2="67" y2="73" />
    </svg>

    <div class="ds-empty__text">
      <p class="fr-h5 fr-mb-1w">Lancez une recherche</p>

      <p v-if="variant !== 'suggestions'" class="fr-hint-text fr-mb-1w">
        Saisissez des mots-clés dans la barre ci-dessus, puis affinez avec les filtres.
      </p>
      <p v-else class="fr-hint-text fr-mb-1w">Par exemple :</p>

      <!-- `aria-live` explicitement à off : la rotation ne doit pas être
           annoncée en boucle par un lecteur d'écran. Sans rotation, les
           quatre exemples sont donnés d'un coup — plus utile qu'un seul
           figé. -->
      <ul class="ds-empty__examples" aria-live="off">
        <li v-for="(example, i) in EXAMPLES" :key="example" v-show="!rotating || i === current">
          <button class="fr-tag fr-tag--sm" type="button" @click="runExample(example)">
            {{ example }}
          </button>
        </li>
      </ul>
    </div>
  </section>
</template>
