import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/svelte'
import ReaderPage from '../routes/read/[bookId]/+page.svelte'

vi.mock('$app/navigation', () => ({
  goto: vi.fn(),
  beforeNavigate: vi.fn()
}))

vi.mock('$app/environment', () => ({
  browser: true
}))

const words = ['Alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel']

function readerData(overrides = {}) {
  return {
    book: { id: 1, title: 'Test Book', author: 'Tester', totalWords: words.length },
    words,
    chapters: [],
    savedWord: 0,
    savedSettings: null,
    ...overrides
  }
}

describe('reader page/e-reader and RSVP mode switching', () => {
  it('renders a normal page text view by default while keeping RSVP available', () => {
    render(ReaderPage, { props: { data: readerData() } })

    expect(screen.getByRole('button', { name: /page view/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /rsvp view/i })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('page-text-view')).toHaveTextContent('Alpha bravo charlie delta')
    expect(screen.queryByText('Ready')).not.toBeInTheDocument()
  })

  it('switches between page and RSVP modes without losing the current position', async () => {
    render(ReaderPage, { props: { data: readerData({ savedWord: 3 }) } })

    expect(screen.getByTestId('page-word-3')).toHaveClass('current')

    await fireEvent.click(screen.getByRole('button', { name: /rsvp view/i }))
    expect(screen.getByRole('button', { name: /rsvp view/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByTestId('page-text-view')).not.toBeInTheDocument()
    expect(screen.getByText('charlie')).toBeInTheDocument()

    await fireEvent.click(screen.getByRole('button', { name: /page view/i }))
    expect(screen.getByTestId('page-text-view')).toBeInTheDocument()
    expect(screen.getByTestId('page-word-3')).toHaveClass('current')
  })

  it('lets the user choose a start word in page mode and starts RSVP from there', async () => {
    render(ReaderPage, { props: { data: readerData() } })

    await fireEvent.click(screen.getByRole('button', { name: 'Start RSVP from word 5: echo' }))

    expect(screen.getByRole('button', { name: /rsvp view/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('echo')).toBeInTheDocument()
    expect(screen.queryByTestId('page-text-view')).not.toBeInTheDocument()
  })

  it('preserves the page-selected start word when returning from RSVP to page view', async () => {
    render(ReaderPage, { props: { data: readerData() } })

    await fireEvent.click(screen.getByRole('button', { name: 'Start RSVP from word 5: echo' }))
    await fireEvent.click(screen.getByRole('button', { name: /page view/i }))

    expect(screen.getByTestId('page-word-5')).toHaveClass('current')
  })
})
