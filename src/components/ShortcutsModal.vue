<script setup lang="ts">
/**
 * Palette des raccourcis clavier, ouverte par la touche « ? » ou par le
 * bouton de la barre d'outils.
 *
 * Elle ne duplique pas l'aide : elle en extrait la seule partie qu'on
 * cherche en cours de frappe, et renvoie vers /help pour le reste (la
 * syntaxe avancée, qui se lit et ne se mémorise pas). Les deux affichages
 * partagent SHORTCUTS, donc ne peuvent pas diverger.
 */
import { SHORTCUTS, type Shortcut } from '@/constants'

const props = withDefaults(
  defineProps<{
    opened: boolean
    /** Liste à publier. Par défaut celle de la recherche. */
    shortcuts?: Shortcut[]
    /** Lien vers l'aide, masqué là où elle n'existe pas. */
    helpHref?: string | null
    /**
     * Libellé du lien. Le défaut ne vaut que pour la recherche : c'est sa
     * syntaxe avancée qui justifie d'aller lire l'aide en entier. Les
     * pages d'administration et de statistiques annoncent la leur.
     */
    helpLabel?: string
  }>(),
  {
    shortcuts: () => SHORTCUTS,
    helpHref: '/help',
    helpLabel: 'Aide complète (syntaxe avancée)',
  },
)
defineEmits<{ close: [] }>()
</script>

<template>
  <DsfrModal
    modal-id="modale-raccourcis"
    :opened="opened"
    title="Raccourcis clavier"
    icon="fr-icon-keyboard-line"
    size="md"
    @close="$emit('close')"
  >
    <div class="fr-table fr-table--bordered">
      <table>
        <thead>
          <tr>
            <th scope="col">Raccourci</th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="shortcut in props.shortcuts" :key="shortcut.keys">
            <td><kbd>{{ shortcut.keys }}</kbd></td>
            <td>{{ shortcut.label }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="fr-hint-text">
      Inactifs pendant la saisie dans un champ de texte ou une liste déroulante.
    </p>

    <!-- Nouvel onglet, comme le lien « Aide » de l'en-tête : on consulte
         la syntaxe sans perdre la recherche en cours. -->
    <a
      v-if="props.helpHref"
      class="fr-link fr-link--icon-left fr-icon-question-line"
      :href="props.helpHref"
      target="_blank"
      rel="noopener"
      title="Aide complète — nouvelle fenêtre"
    >
      {{ props.helpLabel }}
    </a>
  </DsfrModal>
</template>
