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
import { SHORTCUTS } from '@/constants'

defineProps<{ opened: boolean }>()
defineEmits<{ close: [] }>()
</script>

<template>
  <DsfrModal
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
          <tr v-for="shortcut in SHORTCUTS" :key="shortcut.keys">
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
      class="fr-link fr-link--icon-left fr-icon-question-line"
      href="/help"
      target="_blank"
      rel="noopener"
      title="Aide complète — nouvelle fenêtre"
    >
      Aide complète (syntaxe avancée)
    </a>
  </DsfrModal>
</template>
