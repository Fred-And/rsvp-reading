import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const readPageSource = readFileSync('src/routes/read/[bookId]/+page.svelte', 'utf8')
const appHtml = readFileSync('src/app.html', 'utf8')

describe('iOS PWA safe area layout', () => {
  it('allows Safari standalone PWAs to extend into safe areas so env() insets are available', () => {
    expect(appHtml).toContain('viewport-fit=cover')
  })

  it('keeps reader top and bottom controls inside safe areas at mobile breakpoints', () => {
    const mobileMediaMatch = readPageSource.match(/@media \(max-width: 600px\) \{[\s\S]*?\n  \}/)

    expect(mobileMediaMatch?.[0]).toContain('env(safe-area-inset-top')
    expect(mobileMediaMatch?.[0]).toContain('env(safe-area-inset-bottom')
    expect(mobileMediaMatch?.[0]).toContain('env(safe-area-inset-left')
    expect(mobileMediaMatch?.[0]).toContain('env(safe-area-inset-right')
  })
})
