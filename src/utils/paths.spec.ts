import { describe, expect, it } from 'vitest'
import { lienExterne, urlAbregee } from './paths'

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

/**
 * `urlAbregee` ne touche QUE le texte affiché. Ce qui compte ici : rien
 * ne doit disparaître silencieusement d'un bout ou de l'autre — l'hôte
 * dit d'où vient le document, le dernier segment dit ce que c'est.
 */
describe('urlAbregee', () => {
  it("retire le schéma, le « www. » et le slash final, qui ne distinguent rien", () => {
    expect(urlAbregee('https://www.exemple.fr/actualites/')).toBe('exemple.fr/actualites')
    expect(urlAbregee('http://intranet.local/page')).toBe('intranet.local/page')
  })

  it('laisse une adresse courte intacte', () => {
    const court = 'exemple.fr/a/b/c'
    expect(urlAbregee(`https://${court}`)).toBe(court)
  })

  it("garde l'hôte et le dernier segment, et élide les rubriques du milieu", () => {
    const abrege = urlAbregee(
      'https://www.exemple.gouv.fr/politiques-publiques/transition-ecologique/mobilites/rapport-annuel-2026.pdf',
    )
    expect(abrege.startsWith('exemple.gouv.fr/…/')).toBe(true)
    expect(abrege.endsWith('rapport-annuel-2026.pdf')).toBe(true)
    expect(abrege.length).toBeLessThanOrEqual(72)
  })

  it('coupe au milieu du dernier segment quand lui seul est démesuré', () => {
    const abrege = urlAbregee(`https://exemple.fr/${'a'.repeat(200)}-fin.html`)
    expect(abrege.startsWith('exemple.fr/aaa')).toBe(true)
    expect(abrege.endsWith('fin.html')).toBe(true)
    expect(abrege).toContain('…')
    expect(abrege.length).toBeLessThanOrEqual(72)
  })

  it('garde les paramètres de requête lisibles quand ils sont courts', () => {
    expect(urlAbregee('https://exemple.fr/rubrique/sous/article.php?id=42')).toBe(
      'exemple.fr/rubrique/sous/article.php?id=42',
    )
  })

  it('coupe un hôte à lui seul trop long, faute de chemin où élider', () => {
    const abrege = urlAbregee(`https://${'s'.repeat(90)}.exemple.fr`)
    expect(abrege.endsWith('.exemple.fr')).toBe(true)
    expect(abrege.length).toBeLessThanOrEqual(72)
  })

  it("coupe l'ensemble quand l'hôte ne laisse pas la place à un segment lisible", () => {
    const abrege = urlAbregee(`https://${'h'.repeat(68)}.fr/rubrique/document-final.pdf`)
    expect(abrege.length).toBeLessThanOrEqual(72)
    expect(abrege.endsWith('document-final.pdf')).toBe(true)
  })

  it("n'invente rien sur une valeur vide", () => {
    expect(urlAbregee('')).toBe('')
  })
})
