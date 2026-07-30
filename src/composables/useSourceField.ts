import { ref } from 'vue'
import { setSourceField, type SourceType } from '@/api/admin'
import { useDialogs } from '@/composables/useDialogs'

/**
 * Édition du libellé ou de la description d'une source, commune aux
 * trois types (fichiers, SQL, web).
 *
 * Ne touche JAMAIS au nom de la source, qui est sa clé de registre :
 * le renommer aurait des répercussions sur les documents déjà indexés.
 * Seuls ces deux champs d'affichage sont modifiables.
 */
export function useSourceField(onSaved: () => void) {
  const error = ref<string | null>(null)
  const { prompt } = useDialogs()

  async function edit(
    type: SourceType,
    name: string,
    field: 'label' | 'description',
    current: string,
  ) {
    const promptLabel = field === 'label' ? 'Nouveau libellé' : 'Nouvelle description'
    // La contrainte « libellé non vide » est portée par la fenêtre, qui
    // peut redemander. `prompt()` natif ne le permettait pas : il fallait
    // le vérifier après coup et abandonner la saisie sur un message
    // d'erreur affiché ailleurs dans la page.
    const value = await prompt(`${promptLabel} pour la source « ${name} » :`, current, {
      title: field === 'label' ? 'Libellé de la source' : 'Description de la source',
      validate:
        field === 'label' ? (v) => (v ? null : 'Le libellé ne peut pas être vide.') : undefined,
    })
    if (value === null || value === current) return
    error.value = null
    try {
      await setSourceField(type, name, field, value)
      onSaved()
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  return { error, edit }
}
