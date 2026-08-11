<script setup lang="ts">
/**
 * Assistant conversationnel — portage de docsearch-ui/public/chat.html.
 *
 * ⚠️ DÉMONSTRATION : aucune requête n'est envoyée, les réponses sont
 * préenregistrées (voir cannedResponses.ts). Le bandeau d'avertissement
 * en haut de page est la seule chose qui empêche de prendre cet écran
 * pour une fonctionnalité opérationnelle — ne pas le retirer tant que
 * l'endpoint /ask n'existe pas.
 */
import { computed, nextTick, onMounted, ref } from 'vue'
import { findResponse, SUGGESTIONS, type CannedResponse } from './cannedResponses'
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
  answer: CannedResponse['answer']
  sources: string[]
  /** Vrai tant que la réponse simulée n'est pas arrivée. */
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

  // Délai simulé : une réponse instantanée trahirait immédiatement le
  // caractère fictif de la démonstration.
  await new Promise((r) => setTimeout(r, 700 + Math.random() * 600))

  const { answer, sources } = findResponse(text)
  messages.value[index] = { role: 'ai', answer, sources }
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
        text: "Bonjour ! Je suis une démonstration de l'assistant IA envisagé pour DocSearch (option RAG). Mes réponses ici sont des exemples préparés à l'avance, pas une vraie recherche dans vos documents — utilisez les suggestions ci-dessous ou la recherche classique pour une vraie requête.",
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
      type="warning"
      title="Aperçu — réponses de démonstration"
      description="Cette page illustre l'assistant envisagé. Les réponses sont préparées à l'avance : aucune recherche n'est faite dans vos documents."
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
