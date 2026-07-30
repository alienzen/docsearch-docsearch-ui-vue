import { useDialogsStore } from '@/stores/dialogs'

/**
 * Remplaçants promissifs de `confirm()` et `prompt()`, de même contrat :
 * `confirm` résout à `false` et `prompt` à `null` en cas d'annulation.
 *
 * La forme d'appel reste donc celle du code d'origine, à un `await`
 * près :
 *
 *     if (!(await confirm(`Supprimer « ${nom} » ?`))) return
 *
 * ⚠️ Les versions natives BLOQUAIENT le fil d'exécution ; celles-ci sont
 * asynchrones. Toute fonction appelante doit devenir `async`, et son
 * résultat être attendu — un appel oublié ne lèverait aucune erreur, la
 * suppression se ferait simplement sans confirmation.
 */
export function useDialogs() {
  const dialogs = useDialogsStore()

  function confirm(
    message: string,
    options: { title?: string; danger?: boolean; confirmLabel?: string } = {},
  ): Promise<boolean> {
    return dialogs.ask({
      kind: 'confirm',
      title: options.title ?? 'Confirmation',
      message,
      // Destructeur par défaut : tous les appels remplacés sont des
      // suppressions ou des écrasements.
      danger: options.danger ?? true,
      confirmLabel: options.confirmLabel ?? 'Confirmer',
    })
  }

  function prompt(
    message: string,
    initial = '',
    options: { title?: string; validate?: (value: string) => string | null } = {},
  ): Promise<string | null> {
    return dialogs.ask({
      kind: 'prompt',
      title: options.title ?? 'Saisie',
      message,
      initial,
      validate: options.validate,
    })
  }

  return { confirm, prompt }
}
