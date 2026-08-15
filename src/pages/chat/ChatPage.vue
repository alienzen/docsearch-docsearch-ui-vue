<script setup lang="ts">
/**
 * Assistant de recherche.
 *
 * Les réponses viennent du module complémentaire servi sous
 * /ext/assistant/ (dépôt docsearch-plugin-assistant), qui interroge la
 * recherche AU NOM de l'utilisateur : chaque document cité est un
 * document qu'il a le droit de lire.
 *
 * ⚠️ Les réponses sont EXTRACTIVES, pas rédigées : le module assemble des
 * passages déjà présents dans les documents, il n'y a aucun modèle de
 * langage derrière. Le bandeau de la page le dit, et il doit continuer de
 * le dire tant que c'est vrai — sans quoi l'utilisateur lira ces extraits
 * comme une synthèse.
 */
import { computed, nextTick, onMounted, ref } from 'vue'
import { SUGGESTIONS } from './suggestions'
import { AssistantIndisponible, poserQuestion, type SegmentReponse } from '@/api/assistant'
import { useUiConfigStore } from '@/stores/uiConfig'

// Chargée pour la marque et pour le menu du compte, qui a besoin de
// savoir qui est connecté et s'il est administrateur.
const uiConfig = useUiConfigStore()

/**
 * Mêmes entrées que dans le menu du compte des autres pages. Aucune n'est
 * marquée `current` : cette page n'est ni l'une ni l'autre.
 */
const adminLinks = computed(() =>
  uiConfig.showAdminLinks
    ? [
        { label: 'Statistiques', href: '/stats.html', icon: 'fr-icon-bar-chart-line' },
        { label: 'Administration', href: '/admin.html', icon: 'fr-icon-settings-5-line' },
      ]
    : [],
)

type Message = {
  role: 'user' | 'ai'
  answer: SegmentReponse[]
  sources: string[]
  /** Vrai tant que la réponse du module n'est pas arrivée. */
  pending?: boolean
}

const messages = ref<Message[]>([])
const question = ref('')
const list = ref<HTMLElement | null>(null)

async function scrollToBottom() {
  await nextTick()
  if (list.value) list.value.scrollTop = list.value.scrollHeight
}

async function ask(text: string) {
  question.value = ''
  messages.value.push({ role: 'user', answer: [{ text }], sources: [] })
  messages.value.push({ role: 'ai', answer: [], sources: [], pending: true })
  // On retient l'INDICE, pas une référence à l'objet poussé : Vue expose
  // un proxy réactif de celui-ci dans le tableau, et muter l'objet brut
  // d'origine ne déclencherait aucun rendu — la bulle resterait
  // éternellement sur « … ».
  const index = messages.value.length - 1
  await scrollToBottom()

  try {
    const { answer, sources } = await poserQuestion(text)
    messages.value[index] = { role: 'ai', answer, sources }
  } catch (e) {
    // L'échec se dit DANS la conversation, pas dans une alerte à part :
    // la question posée reste à l'écran, et la réponse manquante a sa
    // place là où elle aurait dû s'afficher.
    const texte =
      e instanceof AssistantIndisponible
        ? "L'assistant n'est pas disponible sur cette installation. La recherche classique, elle, fonctionne."
        : e instanceof Error
          ? e.message
          : "L'assistant n'a pas pu répondre."
    messages.value[index] = { role: 'ai', answer: [{ text: texte }], sources: [] }
  }
  await scrollToBottom()
}

function send() {
  const text = question.value.trim()
  if (text) ask(text)
}

onMounted(() => {
  uiConfig.loadUiConfig()
  // Le menu du compte n'existe que pour un utilisateur authentifié, et
  // ses deux liens d'administration que pour un administrateur : les deux
  // viennent de /is-admin, que cette page ne demandait pas jusqu'ici.
  uiConfig.loadIsAdmin()
  messages.value.push({
    role: 'ai',
    answer: [
      {
        text: "Bonjour ! Posez votre question en français : je cherche dans les documents auxquels vous avez accès et je vous montre les passages les plus proches, avec leur source. Je ne rédige pas de synthèse — tout ce que je cite est écrit tel quel dans un document.",
      },
    ],
    sources: [],
  })
})
</script>

<template>
  <DsfrHeader
    service-title="DocSearch"
    service-description="Assistant IA"
    :logo-text="uiConfig.logoText"
    home-to="/"
    operator-img-src="/logo-docsearch.svg"
    operator-img-alt="DocSearch"
    operator-img-style="max-width: 2.5rem"
    :quick-links="[
      {
        label: 'Retour à la recherche',
        to: '/',
        class: 'fr-link--icon-left fr-icon-arrow-left-line',
      },
    ]"
  >
    <!-- Ce lien est conservé ICI, et non versé dans le menu du compte
         comme sur les autres pages, pour deux raisons qui n'en font
         qu'une : vue-dsfr ne rend `.fr-header__tools-links` — donc ce
         slot — que si `quick-links` n'est pas vide, et le bouton du menu
         mobile n'apparaît que s'il y a des liens rapides, une navigation
         ou une barre de recherche. Cette page n'a rien de tout cela : le
         vider laissait l'en-tête sans aucun outil sous 62em, menu du
         compte compris. -->
    <template #after-quick-links>
      <HeaderUserMenu family="search" :links="adminLinks" />
    </template>
  </DsfrHeader>

  <main id="main-content" class="fr-container fr-my-4w ds-chat">
    <DsfrAlert
      id="chat-avertissement"
      type="info"
      title="Réponses extraites de vos documents"
      description="L'assistant cherche dans les documents auxquels vous avez accès et cite les passages trouvés. Il ne rédige pas de synthèse et n'invente rien : chaque phrase citée figure telle quelle dans le document indiqué."
      class="fr-mb-3w"
    />

    <div id="chat-conversation" ref="list" class="ds-chat__messages">
      <!-- `data-role` plutôt que de se raccrocher à la classe
           `ds-chat__msg--user` : la classe décrit une apparence et peut
           être renommée avec la feuille de style, l'attribut décrit qui
           parle. -->
      <div
        v-for="(message, i) in messages"
        :key="i"
        class="ds-chat__msg"
        :class="`ds-chat__msg--${message.role}`"
        data-testid="chat-message"
        :data-role="message.role"
      >
        <div class="ds-chat__bubble">
          <p v-if="message.pending" class="fr-mb-0" data-testid="chat-attente">
            <span class="fr-sr-only">Réponse en cours de rédaction</span>
            <span aria-hidden="true">…</span>
          </p>
          <p v-else class="fr-mb-0">
            <template v-for="(segment, j) in message.answer" :key="j">
              <strong v-if="segment.strong">{{ segment.text }}</strong>
              <template v-else>{{ segment.text }}</template>
            </template>
          </p>
          <p v-if="message.sources.length" class="ds-chat__sources fr-mb-0">
            Sources :
            <template v-for="(source, j) in message.sources" :key="source">
              <a class="fr-link fr-link--sm" href="/" data-testid="chat-source">{{ source }}</a>
              <template v-if="j < message.sources.length - 1">, </template>
            </template>
          </p>
        </div>
      </div>
    </div>

    <ul id="chat-suggestions" class="fr-tags-group fr-mt-2w">
      <li v-for="suggestion in SUGGESTIONS" :key="suggestion">
        <button class="fr-tag" data-testid="chat-suggestion" @click="ask(suggestion)">
          {{ suggestion }}
        </button>
      </li>
    </ul>

    <div id="chat-saisie" class="ds-chat__input fr-mt-2w">
      <div class="fr-input-group fr-mb-0">
        <label class="fr-label fr-sr-only" for="chat-question">Votre question</label>
        <input
          id="chat-question"
          v-model="question"
          class="fr-input"
          type="text"
          placeholder="Posez votre question en français…"
          @keydown.enter.prevent="send"
        />
      </div>
      <DsfrButton id="chat-envoyer" label="Envoyer" @click="send" />
    </div>
  </main>
</template>
