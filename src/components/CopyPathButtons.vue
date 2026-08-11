<script setup lang="ts">
/**
 * Boutons « Copier le dossier » / « Copier le chemin », réduits à leurs
 * icônes — ils accompagnent un chemin de fichier déjà long, où deux
 * libellés en toutes lettres prenaient plus de place que la donnée.
 *
 * Le libellé subsiste en `fr-sr-only` et en `title` : l'icône seule ne
 * porte pas de nom accessible, et un bouton sans nom est inutilisable au
 * lecteur d'écran.
 *
 * Écrit une fois pour deux appelants (la carte de résultat et la fiche
 * détail), qui en avaient chacun une copie identique au chemin source
 * près.
 */
import { ref } from 'vue'
import { copyText, dirOfPath, displayPath } from '@/utils/paths'
import { useUiConfigStore } from '@/stores/uiConfig'

const props = defineProps<{ filepath: string }>()

const uiConfig = useUiConfigStore()

const copied = ref<'dir' | 'full' | null>(null)

async function copy(kind: 'dir' | 'full') {
  // Le chemin copié est celui que l'utilisateur peut coller dans son
  // explorateur, pas le chemin interne aux conteneurs.
  const full = displayPath(
    props.filepath,
    uiConfig.config.sources_mount,
    uiConfig.config.sources_mount_display,
  )
  await copyText(kind === 'dir' ? dirOfPath(full) : full)
  copied.value = kind
  setTimeout(() => (copied.value = null), 1200)
}
</script>

<template>
  <span class="ds-copy">
    <!-- L'icône bascule sur une coche : c'est le seul retour visible une
         fois le libellé masqué. -->
    <!-- Aucun `id` : ce composant est rendu une fois par carte de
         résultat, et une seconde fois dans la fiche détail. -->
    <button
      class="fr-btn fr-btn--sm fr-btn--tertiary-no-outline"
      :class="copied === 'dir' ? 'fr-icon-check-line' : 'fr-icon-folder-2-line'"
      data-testid="copier-dossier"
      type="button"
      :title="copied === 'dir' ? 'Dossier copié' : 'Copier le dossier'"
      @click="copy('dir')"
    >
      <span class="fr-sr-only">{{ copied === 'dir' ? 'Dossier copié' : 'Copier le dossier' }}</span>
    </button>
    <button
      class="fr-btn fr-btn--sm fr-btn--tertiary-no-outline"
      :class="copied === 'full' ? 'fr-icon-check-line' : 'fr-icon-clipboard-line'"
      data-testid="copier-chemin"
      type="button"
      :title="copied === 'full' ? 'Chemin copié' : 'Copier le chemin'"
      @click="copy('full')"
    >
      <span class="fr-sr-only">{{ copied === 'full' ? 'Chemin copié' : 'Copier le chemin' }}</span>
    </button>
  </span>
</template>
