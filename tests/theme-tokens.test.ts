import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const rendererRoot = resolve(process.cwd(), 'src/renderer/src')

function readRendererFile(relativePath: string): string {
  return readFileSync(resolve(rendererRoot, relativePath), 'utf8')
}

describe('renderer theme contract', () => {
  it('loads the token layer before legacy component styles', () => {
    const entry = readRendererFile('styles/index.css')
    const tokenImport = entry.indexOf("@import './tokens.css'")
    const legacyImport = entry.indexOf("@import '../styles.css'")
    const adoptionImport = entry.indexOf("@import './theme-adoption.css'")

    expect(tokenImport).toBeGreaterThanOrEqual(0)
    expect(legacyImport).toBeGreaterThan(tokenImport)
    expect(adoptionImport).toBeGreaterThan(legacyImport)
    expect(readRendererFile('main.tsx')).toContain("import './styles/index.css'")
  })

  it('defines the required primitive and semantic theme tokens', () => {
    const tokens = readRendererFile('styles/tokens.css')
    const requiredTokens = [
      '--color-electric-lime',
      '--color-just-black',
      '--color-surface-cream',
      '--surface-page-canvas',
      '--surface-panel',
      '--text-primary',
      '--text-muted',
      '--border-subtle',
      '--accent-primary',
      '--accent-application',
      '--accent-unclassified',
      '--accent-afk',
      '--section-gap-default',
      '--card-padding-default',
      '--radius-cards',
      '--transition-fast'
    ]

    for (const token of requiredTokens) expect(tokens).toContain(token)
    expect(tokens).not.toMatch(/:\s*\d+\s*-\s*\d+px/)
  })

  it('uses semantic tokens in the global application styles', () => {
    const styles = readRendererFile('styles/theme-adoption.css')

    expect(styles).toContain('var(--surface-page-canvas)')
    expect(styles).toContain('var(--text-primary)')
    expect(styles).toContain('var(--surface-panel)')
    expect(styles).toContain('var(--border-subtle)')
    expect(styles).toContain('var(--accent-primary)')
  })
})
