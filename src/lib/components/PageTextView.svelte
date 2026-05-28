<script>
  import { createEventDispatcher } from 'svelte';

  /** @type {string[]} */
  export let words = [];
  /** @type {number} */
  export let currentWordIndex = 0;

  const dispatch = createEventDispatcher();

  $: selectedWordNumber = Math.max(1, currentWordIndex || 1);

  /** @param {number} wordIndex */
  function selectWord(wordIndex) {
    dispatch('start', { wordIndex });
  }
</script>

<div class="page-text-view" data-testid="page-text-view" aria-label="Page text view">
  {#each words as word, index}
    {@const wordNumber = index + 1}
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

<style>
  .page-text-view {
    width: min(100%, 760px);
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
