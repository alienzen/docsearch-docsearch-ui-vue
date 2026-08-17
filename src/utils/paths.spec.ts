import { describe, expect, it } from 'vitest'
import { lienExterne } from './paths'

/**
 * `lienExterne` décide si un `filepath` devient un lien cliquable. Elle
 * est le seul garde-fou entre une valeur écrite par un TIERS — l'URL
 * d'une entrée RSS vient de l'éditeur du flux — et un `:href`, que Vue
 * n'assainit pas.
 */
describe('lienExterne — ce qui devient un lien', () => {
  it('accepte http et https', () => {
    expect(lienExterne('https://exemple.fr/article')).toBe('https://exemple.fr/article')
    expect(lienExterne('http://intranet.local/page')).toBe('http://intranet.local/page')
  })

  it('accepte quel que soit la casse du schéma', () => {
    expect(lienExterne('HTTPS://exemple.fr/a')).toBe('HTTPS://exemple.fr/a')
  })

  it('ignore les espaces autour', () => {
    expect(lienExterne('  https://exemple.fr/a  ')).toBe('https://exemple.fr/a')
  })
})

/* eslint-disable no-script-url --
   Ces URL sont l'objet même des tests : la règle vise le code qui en
   FABRIQUE, pas celui qui vérifie qu'on les refuse. Les écrire autrement
   (concaténation, échappement) masquerait ce qui est éprouvé. */
describe('lienExterne — ce qui reste du texte', () => {
  it('refuse javascript:', () => {
    // LE test de ce fichier. Sans liste blanche, ce `filepath` produirait
    // un lien exécutable au clic — et il vient d'un flux tiers.
    expect(lienExterne('javascript:alert(1)')).toBeNull()
    expect(lienExterne('JavaScript:alert(1)')).toBeNull()
  })

  it('refuse un javascript: maquillé en URL', () => {
    expect(lienExterne('javascript:alert(1)//https://exemple.fr')).toBeNull()
  })

  it('refuse les autres schémas', () => {
    expect(lienExterne('data:text/html,<script>alert(1)</script>')).toBeNull()
    expect(lienExterne('file:///etc/passwd')).toBeNull()
    expect(lienExterne('ftp://exemple.fr/f.txt')).toBeNull()
  })

  it('laisse les chemins de fichiers tranquilles', () => {
    expect(lienExterne('/sources/finance/budget.pdf')).toBeNull()
    expect(lienExterne('\\\\serveur\\partage\\budget.pdf')).toBeNull()
    // Chemin de repli d'un document de module sans URL, posé par le
    // contrat (documents.construire_document).
    expect(lienExterne('plugin:rss_presse/abc123')).toBeNull()
  })

  it("accepte l'absence de valeur", () => {
    expect(lienExterne('')).toBeNull()
    expect(lienExterne(null)).toBeNull()
    expect(lienExterne(undefined)).toBeNull()
  })
})
