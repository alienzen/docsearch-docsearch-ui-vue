import { ref } from 'vue'
import { setSourceField, type SourceType } from '@/api/admin'

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

  async function edit(
    type: SourceType,
    name: string,
    field: 'label' | 'description',
    current: string,
  ) {
    const promptLabel = field === 'label' ? 'Nouveau libellé' : 'Nouvelle description'
    const value = prompt(`${promptLabel} pour la source « ${name} » :`, current)
    if (value === null || value.trim() === current) return
    const trimmed = value.trim()
    if (field === 'label' && !trimmed) {
      error.value = 'Le libellé ne peut pas être vide.'
      return
    }
    error.value = null
    try {
      await setSourceField(type, name, field, trimmed)
      onSaved()
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  return { error, edit }
}
