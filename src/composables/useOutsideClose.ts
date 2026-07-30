import { onBeforeUnmount, onMounted, type Ref } from 'vue'

/**
 * Ferme un panneau déroulant au clic hors de lui et à Échap.
 *
 * C'est ce que docsearch-ui faisait à la main dans init.js, et ce que le
 * JS du DSFR ferait si nous le chargions — nous ne chargeons que sa
 * feuille de styles, le repli des `.fr-collapse` étant purement CSS.
 *
 * `container` délimite l'intérieur : un clic dedans ne ferme pas, ce qui
 * laisse cocher plusieurs cases d'affilée.
 */
export function useOutsideClose(
  container: Ref<HTMLElement | null>,
  isOpen: () => boolean,
  close: () => void,
) {
  function onDocumentClick(e: MouseEvent) {
    if (!isOpen()) return
    const el = container.value
    if (el && !el.contains(e.target as Node)) close()
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && isOpen()) close()
  }

  onMounted(() => {
    document.addEventListener('click', onDocumentClick)
    document.addEventListener('keydown', onKeydown)
  })
  onBeforeUnmount(() => {
    document.removeEventListener('click', onDocumentClick)
    document.removeEventListener('keydown', onKeydown)
  })
}
