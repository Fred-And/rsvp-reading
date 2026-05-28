<script>
  import { createEventDispatcher } from 'svelte';

  /** @type {string[]} */
  export let words = [];
  /** @type {number} */
  export let currentWordIndex = 0;
  /** @type {{label: string, start: number, end: number, source: 'epub'|'synthetic'}[]} */
  export let pageRanges = [];
  /** @type {number} */
  export let currentPageIndex = 0;

  const dispatch = createEventDispatcher();

  $: selectedWordNumber = Math.max(1, currentWordIndex || 1);
  $: currentPage = pageRanges[currentPageIndex] ?? { label: '1', start: 0, end: words.length, source: 'synthetic' };
  $: visibleWords = words.slice(currentPage.start, currentPage.end);
  $: pageLabel = currentPage?.label ?? String(currentPageIndex + 1);

  /** @param {number} wordIndex */
  function selectWord(wordIndex) {
    dispatch('start', { wordIndex });
  }

  /** @param {number} pageIndex */
  function goToPage(pageIndex) {
    dispatch('pagechange', { pageIndex });
  }
</script>

<section class="page-shell" aria-label="Paginated page text view">
  <div class="page-toolbar" aria-label="Page navigation">
    <button
      type="button"
      class="page-nav-btn"
      aria-label="Previous page"
      disabled={currentPageIndex <= 0}
      on:click={() => goToPage(currentPageIndex - 1)}
    >‹</button>
    <div class="page-status">
      <span>Page {pageLabel} of {pageRanges.length || 1}</span>
      <small>{currentPage.source === 'epub' ? 'EPUB page list' : 'estimated'}</small>
    </div>
    <button
      type="button"
      class="page-nav-btn"
      aria-label="Next page"
      disabled={currentPageIndex >= pageRanges.length - 1}
      on:click={() => goToPage(currentPageIndex + 1)}
    >›</button>
  </div>

  <div class="page-text-view" data-testid="page-text-view" aria-label="Page text view">
    {#each visibleWords as word, index}
      {@const wordNumber = currentPage.start + index + 1}
      <button
        type="button"
        class="page-word"
        class:current={wordNumber === selectedWordNumber}
        data-testid={`page-word-${wordNumber}`}
        aria-label={`Start RSVP from word ${wordNumber}: ${word}`}
        title={`Start RSVP from word ${wordNumber}`}
        on:click={() => selectWord(wordNumber)}
      >{word}</button>{' '}
    {/each}
  </div>
</section>

<style>
  .page-shell {
    width: min(100%, 760px);
    height: 100%;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .page-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.25rem 0 0.75rem;
    color: #888;
    flex-shrink: 0;
  }

  .page-status {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.1rem;
    font-family: 'Segoe UI', system-ui, sans-serif;
    font-size: 0.85rem;
  }

  .page-status small {
    color: #444;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .page-nav-btn {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 999px;
    border: 1px solid #222;
    background: #0d0d0d;
    color: #aaa;
    cursor: pointer;
    font-size: 1.7rem;
    line-height: 1;
    transition: all 0.15s ease;
  }

  .page-nav-btn:hover:not(:disabled),
  .page-nav-btn:focus-visible:not(:disabled) {
    border-color: #ff4444;
    color: #fff;
    outline: none;
  }

  .page-nav-btn:disabled {
    cursor: not-allowed;
    opacity: 0.3;
  }

  .page-text-view {
    flex: 1;
    min-height: 0;
    width: 100%;
    height: 100%;
    overflow-y: auto;
    padding: 1.5rem 1rem 2.5rem;
    box-sizing: border-box;
    color: #d8d8d8;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: clamp(1.1rem, 2.4vw, 1.45rem);
    line-height: 1.85;
    text-align: left;
    scrollbar-width: thin;
    scrollbar-color: #333 #050505;
  }

  .page-word {
    appearance: none;
    border: 0;
    border-radius: 0.25rem;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font: inherit;
    line-height: inherit;
    margin: 0;
    padding: 0 0.05rem;
    text-align: left;
    transition: background 0.12s ease, color 0.12s ease;
  }

  .page-word:hover,
  .page-word:focus-visible {
    background: rgba(255, 68, 68, 0.16);
    color: #fff;
    outline: none;
  }

  .page-word.current {
    background: rgba(255, 68, 68, 0.28);
    color: #fff;
  }
</style>
