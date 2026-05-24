<script>
  import { onMount, onDestroy } from 'svelte';
  import { goto, beforeNavigate } from '$app/navigation';
  import { browser } from '$app/environment';
  import {
    getWordDelay as getWordDelayUtil,
    formatTimeRemaining,
    shouldPauseAtWord,
    extractWordFrame
  } from '$lib/rsvp-utils.js';
  import RSVPDisplay from '$lib/components/RSVPDisplay.svelte';
  import Controls from '$lib/components/Controls.svelte';
  import Settings from '$lib/components/Settings.svelte';
  import ProgressBar from '$lib/components/ProgressBar.svelte';
  import ChapterDrawer from '$lib/components/ChapterDrawer.svelte';

  export let data;

  const { book, words, chapters } = data;

  // ─── State ────────────────────────────────────────────────────────────────
  let currentWordIndex = data.savedWord ?? 0;
  let isPlaying = false;
  let isPaused = false;
  let showSettings = false;
  let showJumpTo = false;
  let jumpToValue = '';
  let showChapters = false;
  let frameWordCount = 4;

  // Settings (restore from saved session or defaults)
  const s = data.savedSettings ?? {};
  let wordsPerMinute        = s.wordsPerMinute        ?? 300;
  let fadeEnabled           = s.fadeEnabled           ?? true;
  let fadeDuration          = s.fadeDuration          ?? 150;
  let pauseAfterWords       = s.pauseAfterWords       ?? 0;
  let pauseDuration         = s.pauseDuration         ?? 500;
  let pauseOnPunctuation    = s.pauseOnPunctuation    ?? true;
  let punctuationPauseMultiplier = s.punctuationPauseMultiplier ?? 2;
  let wordLengthWPMMultiplier    = s.wordLengthWPMMultiplier    ?? 5;
  frameWordCount = Math.max(4, s.frameWordCount ?? 4);

  // Animation
  let wordOpacity = 1;
  let intervalId = null;
  let fadeTimeoutId = null;
  let saveIntervalId = null;

  // ─── Derived ──────────────────────────────────────────────────────────────
  $: progress = words.length > 0 ? (currentWordIndex / words.length) * 100 : 0;
  $: currentWord = words[currentWordIndex - 1] || (words.length > 0 ? words[0] : '');
  $: wordFrame = extractWordFrame(words, Math.max(0, currentWordIndex - 1), frameWordCount);
  $: timeRemaining = formatTimeRemaining(words.length - currentWordIndex, wordsPerMinute);
  $: isFocusMode = isPlaying || isPaused;

  $: currentChapterIndex = (() => {
    if (!chapters.length) return 0;
    let idx = 0;
    for (let i = 0; i < chapters.length; i++) {
      if (chapters[i].word_start <= currentWordIndex) idx = i;
      else break;
    }
    return idx;
  })();

  $: currentChapterTitle = chapters[currentChapterIndex]?.title ?? '';

  // ─── Playback ─────────────────────────────────────────────────────────────
  function getWordDelay(word) {
    return getWordDelayUtil(word, wordsPerMinute, pauseOnPunctuation, punctuationPauseMultiplier, wordLengthWPMMultiplier);
  }

  function showNextWord() {
    if (currentWordIndex >= words.length) { pause(); return; }

    if (shouldPauseAtWord(currentWordIndex, pauseAfterWords)) {
      isPaused = true;
      setTimeout(() => {
        if (isPlaying) { isPaused = false; scheduleNextWord(); }
      }, pauseDuration);
      return;
    }

    if (fadeEnabled) {
      wordOpacity = 0;
      fadeTimeoutId = setTimeout(() => { wordOpacity = 1; }, 10);
    }

    currentWordIndex++;
    scheduleNextWord();
  }

  function scheduleNextWord() {
    if (!isPlaying || currentWordIndex >= words.length) return;
    const word = words[currentWordIndex - 1] || '';
    intervalId = setTimeout(showNextWord, getWordDelay(word));
  }

  function start() {
    if (words.length === 0) return;
    isPlaying = true;
    isPaused = false;
    showSettings = false;
    showJumpTo = false;
    showChapters = false;
    showNextWord();
    startAutoSave();
  }

  async function pause() {
    isPlaying = false;
    isPaused = true;
    clearTimeout(intervalId);
    intervalId = null;
    stopAutoSave();
    await saveSession();
  }

  function resume() {
    if (currentWordIndex < words.length) {
      isPlaying = true;
      isPaused = false;
      scheduleNextWord();
      startAutoSave();
    }
  }

  async function handleBack() {
    clearTimeout(intervalId);
    intervalId = null;
    stopAutoSave();
    isPlaying = false;
    isPaused = false;
    await saveSession();
    goto('/');
  }

  // ─── Chapter navigation ───────────────────────────────────────────────────
  function handleChapterSelect(e) {
    const wasPlaying = isPlaying;
    if (isPlaying) { clearTimeout(intervalId); isPlaying = false; }
    currentWordIndex = e.detail.wordIndex;
    if (wasPlaying) { isPlaying = true; scheduleNextWord(); }
  }

  function prevChapter() {
    const prev = chapters[currentChapterIndex - 1];
    if (prev) jumpToWordIndex(prev.word_start);
  }

  function nextChapter() {
    const next = chapters[currentChapterIndex + 1];
    if (next) jumpToWordIndex(next.word_start);
  }

  function jumpToWordIndex(idx) {
    const wasPlaying = isPlaying;
    if (isPlaying) { clearTimeout(intervalId); isPlaying = false; }
    currentWordIndex = idx;
    if (wasPlaying) { isPlaying = true; scheduleNextWord(); }
  }

  // ─── Jump to position ─────────────────────────────────────────────────────
  function jumpToWord(value) {
    if (!value || words.length === 0) return;
    const trimmed = value.trim();
    let targetIndex;

    if (trimmed.endsWith('%')) {
      const pct = parseFloat(trimmed.slice(0, -1));
      if (!isNaN(pct)) targetIndex = Math.floor((Math.max(0, Math.min(100, pct)) / 100) * words.length);
    } else {
      const num = parseInt(trimmed, 10);
      if (!isNaN(num)) targetIndex = Math.max(0, Math.min(words.length, num));
    }

    if (targetIndex !== undefined) currentWordIndex = targetIndex;
    showJumpTo = false;
    jumpToValue = '';
  }

  function handleProgressClick(e) {
    currentWordIndex = Math.max(0, Math.min(words.length, Math.floor((e.detail.percentage / 100) * words.length)));
  }

  // ─── Session persistence ──────────────────────────────────────────────────
  function buildSettings() {
    return { wordsPerMinute, fadeEnabled, fadeDuration, pauseOnPunctuation,
             punctuationPauseMultiplier, wordLengthWPMMultiplier, pauseAfterWords,
             pauseDuration, frameWordCount };
  }

  async function saveSession() {
    if (words.length === 0) return;
    await fetch(`/api/books/${book.id}/session`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentWord: currentWordIndex, settings: buildSettings() })
    });
  }

  function startAutoSave() {
    stopAutoSave();
    saveIntervalId = setInterval(saveSession, 30_000);
  }

  function stopAutoSave() {
    if (saveIntervalId) { clearInterval(saveIntervalId); saveIntervalId = null; }
  }

  // ─── Keyboard ─────────────────────────────────────────────────────────────
  function handleKeydown(e) {
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        if (isPlaying) pause();
        else if (isPaused) resume();
        else start();
        break;
      case 'Escape':
        if (showJumpTo) { showJumpTo = false; jumpToValue = ''; }
        else if (showChapters) { showChapters = false; }
        else if (showSettings) { showSettings = false; }
        else if (isPlaying) pause();
        else if (isPaused) handleBack();
        break;
      case 'KeyG':
        if (!isPlaying && !showSettings) { e.preventDefault(); showJumpTo = !showJumpTo; }
        break;
      case 'KeyS':
        if (e.ctrlKey || e.metaKey) { e.preventDefault(); saveSession(); }
        break;
      case 'ArrowUp':   e.preventDefault(); wordsPerMinute = Math.min(1000, wordsPerMinute + 25); break;
      case 'ArrowDown': e.preventDefault(); wordsPerMinute = Math.max(50, wordsPerMinute - 25); break;
      case 'ArrowLeft':
        e.preventDefault();
        if (currentWordIndex > 1) currentWordIndex = Math.max(0, currentWordIndex - 2);
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (currentWordIndex < words.length) currentWordIndex++;
        break;
    }
  }

  beforeNavigate(() => { saveSession(); });

  onMount(() => { window.addEventListener('keydown', handleKeydown); });
  onDestroy(() => {
    clearTimeout(intervalId);
    clearTimeout(fadeTimeoutId);
    stopAutoSave();
    if (browser) window.removeEventListener('keydown', handleKeydown);
  });
</script>

<svelte:head>
  <title>{book.title} — RSVP</title>
</svelte:head>

<main class:focus-mode={isFocusMode}>

  {#if !isFocusMode}
    <header>
      <button class="icon-btn back-btn" on:click={handleBack} title="Library">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
      </button>

      <div class="header-center">
        <span class="header-title">{book.title}</span>
        {#if currentChapterTitle}
          <button class="chapter-pill" on:click={() => showChapters = true}>
            {currentChapterTitle}
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>
          </button>
        {/if}
      </div>

      <div class="header-actions">
        <button class="icon-btn" on:click={() => { showJumpTo = !showJumpTo; showSettings = false; }} title="Jump (G)" class:active={showJumpTo}>
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg>
        </button>
        <button class="icon-btn" on:click={saveSession} title="Save (Ctrl+S)">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>
        </button>
        <button class="icon-btn" on:click={() => { showSettings = !showSettings; showJumpTo = false; }} title="Settings" class:active={showSettings}>
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>
        </button>
      </div>
    </header>
  {/if}

  <!-- Panels -->
  {#if showSettings && !isFocusMode}
    <div class="panel-overlay">
      <Settings
        bind:wordsPerMinute bind:fadeEnabled bind:fadeDuration
        bind:pauseOnPunctuation bind:punctuationPauseMultiplier
        bind:wordLengthWPMMultiplier bind:pauseAfterWords bind:pauseDuration
        bind:frameWordCount
        on:close={() => showSettings = false}
      />
    </div>
  {/if}

  {#if showJumpTo && !isFocusMode}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="panel-overlay" on:click|self={() => showJumpTo = false}>
      <div class="jump-panel">
        <h3>Jump to position</h3>
        <p class="hint">Word number or percentage (e.g. 50%)</p>
        <form on:submit|preventDefault={() => jumpToWord(jumpToValue)}>
          <!-- svelte-ignore a11y_autofocus -->
          <input type="text" bind:value={jumpToValue} placeholder="Word # or %" autofocus />
          <div class="jump-actions">
            <button type="button" class="secondary" on:click={() => showJumpTo = false}>Cancel</button>
            <button type="submit" class="primary">Go</button>
          </div>
        </form>
        <div class="quick-jumps">
          <button on:click={() => jumpToWord('0')}>Start</button>
          <button on:click={() => jumpToWord('25%')}>25%</button>
          <button on:click={() => jumpToWord('50%')}>50%</button>
          <button on:click={() => jumpToWord('75%')}>75%</button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Main display -->
  <div class="display-area">
    <RSVPDisplay
      word={currentWord}
      wordGroup={wordFrame.subset}
      highlightIndex={wordFrame.centerOffset}
      opacity={wordOpacity}
      {fadeDuration}
      {fadeEnabled}
      multiWordEnabled={true}
    />
  </div>

  <!-- Bottom bar -->
  <div class="bottom-bar" class:minimal={isFocusMode}>
    <ProgressBar
      {progress}
      currentWord={currentWordIndex}
      totalWords={words.length}
      wpm={wordsPerMinute}
      {timeRemaining}
      minimal={isFocusMode}
      clickable={!isPlaying}
      on:seek={handleProgressClick}
    />

    <!-- Chapter bar (visible when not in focus mode) -->
    {#if !isFocusMode && chapters.length > 1}
      <div class="chapter-bar">
        <button class="ch-nav-btn" on:click={prevChapter} disabled={currentChapterIndex === 0} title="Previous chapter">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
        </button>
        <button class="chapter-label" on:click={() => showChapters = true}>
          <span>{currentChapterTitle || 'Chapters'}</span>
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>
        </button>
        <button class="ch-nav-btn" on:click={nextChapter} disabled={currentChapterIndex === chapters.length - 1} title="Next chapter">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/></svg>
        </button>
      </div>
    {/if}

    <div class="controls-area">
      <Controls
        {isPlaying} {isPaused}
        canPlay={words.length > 0}
        minimal={isFocusMode}
        on:play={start} on:pause={pause} on:resume={resume}
        on:back={handleBack}
      />
    </div>

    {#if !isFocusMode}
      <div class="shortcuts desktop-only">
        <kbd>Space</kbd> Play
        <kbd>Esc</kbd> Exit
        <kbd>↑↓</kbd> Speed
        <kbd>←→</kbd> Skip
        <kbd>G</kbd> Jump
        <kbd>Ctrl+S</kbd> Save
      </div>
      <div class="touch-controls mobile-only">
        <button class="touch-btn" aria-label="Back 5 words" on:click={() => currentWordIndex = Math.max(0, currentWordIndex - 5)}>
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
        </button>
        <button class="touch-btn" on:click={() => wordsPerMinute = Math.max(50, wordsPerMinute - 50)}>
          <span>−WPM</span>
        </button>
        <span class="wpm-display">{wordsPerMinute}</span>
        <button class="touch-btn" on:click={() => wordsPerMinute = Math.min(1000, wordsPerMinute + 50)}>
          <span>+WPM</span>
        </button>
        <button class="touch-btn" aria-label="Forward 5 words" on:click={() => currentWordIndex = Math.min(words.length, currentWordIndex + 5)}>
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/></svg>
        </button>
      </div>
    {/if}
  </div>
</main>

<!-- Chapter drawer (outside main for z-index) -->
<ChapterDrawer
  {chapters}
  {currentChapterIndex}
  bind:open={showChapters}
  on:select={handleChapterSelect}
/>

<style>
  :global(body) {
    background-color: #000 !important;
    margin: 0; padding: 0;
    overflow: hidden;
    position: fixed;
    width: 100%; height: 100%;
  }

  main {
    height: 100vh;
    height: 100dvh;
    display: flex;
    flex-direction: column;
    background-color: #000;
    color: #fff;
    font-family: 'Segoe UI', system-ui, sans-serif;
    padding:
      calc(env(safe-area-inset-top, 0px) + 1rem)
      calc(env(safe-area-inset-right, 0px) + 1.5rem)
      calc(env(safe-area-inset-bottom, 0px) + 1.5rem)
      calc(env(safe-area-inset-left, 0px) + 1.5rem);
    box-sizing: border-box;
    transition: padding 0.3s ease;
    overflow: hidden;
  }

  main.focus-mode {
    padding:
      calc(env(safe-area-inset-top, 0px) + 0.5rem)
      calc(env(safe-area-inset-right, 0px) + 1rem)
      calc(env(safe-area-inset-bottom, 0px) + 0.5rem)
      calc(env(safe-area-inset-left, 0px) + 1rem);
  }

  header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
    flex-shrink: 0;
  }

  .header-center {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .header-title {
    font-size: 0.75rem;
    color: #444;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .chapter-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    background: none;
    border: none;
    color: #666;
    font-size: 0.75rem;
    padding: 0;
    cursor: pointer;
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    -webkit-tap-highlight-color: transparent;
  }

  .chapter-pill svg { width: 14px; height: 14px; flex-shrink: 0; }
  .chapter-pill:active { color: #fff; }

  .header-actions {
    display: flex;
    gap: 0.25rem;
    flex-shrink: 0;
  }

  .back-btn { margin-right: 0.25rem; }

  .icon-btn {
    background: transparent;
    border: 1px solid #222;
    color: #555;
    padding: 0.45rem;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    -webkit-tap-highlight-color: transparent;
  }

  .icon-btn:active, .icon-btn.active { border-color: #ff4444; color: #ff4444; }
  .icon-btn svg { width: 18px; height: 18px; }

  .display-area {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
    overflow: hidden;
  }

  .bottom-bar {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding-top: 0.75rem;
    transition: all 0.3s ease;
  }

  .bottom-bar.minimal { gap: 0.5rem; padding-top: 0.5rem; }

  /* Chapter bar */
  .chapter-bar {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .chapter-label {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    background: #0d0d0d;
    border: 1px solid #1a1a1a;
    border-radius: 8px;
    color: #666;
    font-size: 0.8rem;
    padding: 0.5rem 0.75rem;
    cursor: pointer;
    overflow: hidden;
    -webkit-tap-highlight-color: transparent;
    transition: all 0.15s;
  }

  .chapter-label:active { color: #fff; border-color: #333; }
  .chapter-label span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .chapter-label svg { width: 16px; height: 16px; flex-shrink: 0; }

  .ch-nav-btn {
    background: #0d0d0d;
    border: 1px solid #1a1a1a;
    border-radius: 8px;
    color: #555;
    padding: 0.5rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    -webkit-tap-highlight-color: transparent;
    transition: all 0.15s;
    flex-shrink: 0;
  }

  .ch-nav-btn:active { color: #fff; border-color: #333; }
  .ch-nav-btn:disabled { opacity: 0.25; cursor: not-allowed; }
  .ch-nav-btn svg { width: 20px; height: 20px; }

  .controls-area { display: flex; justify-content: center; }

  .shortcuts {
    display: flex;
    justify-content: center;
    gap: 1.25rem;
    color: #333;
    font-size: 0.75rem;
  }

  kbd {
    background: #111;
    padding: 0.1rem 0.35rem;
    border-radius: 3px;
    font-family: monospace;
    color: #555;
    margin-right: 0.2rem;
  }

  .touch-controls {
    display: none;
    justify-content: center;
    align-items: center;
    gap: 0.5rem;
  }

  .touch-btn {
    background: #111;
    border: 1px solid #222;
    color: #888;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    font-size: 0.75rem;
    cursor: pointer;
    min-width: 44px;
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
    -webkit-tap-highlight-color: transparent;
  }

  .touch-btn:active { background: #222; color: #fff; }
  .touch-btn svg { width: 20px; height: 20px; }

  .wpm-display {
    color: #ff4444;
    font-family: monospace;
    font-size: 0.85rem;
    min-width: 3rem;
    text-align: center;
  }

  .mobile-only  { display: none; }
  .desktop-only { display: flex; }

  /* Jump panel */
  .panel-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 1.5rem;
  }

  .jump-panel {
    background: #111;
    border: 1px solid #222;
    border-radius: 16px;
    padding: 1.5rem;
    max-width: 320px;
    width: 100%;
  }

  .jump-panel h3 { margin: 0 0 0.25rem; color: #fff; font-size: 1.1rem; }

  .hint { color: #555; font-size: 0.8rem; margin: 0 0 1rem; }

  .jump-panel input {
    width: 100%;
    padding: 0.75rem;
    background: #000;
    border: 1px solid #333;
    border-radius: 8px;
    color: #fff;
    font-size: 1rem;
    margin-bottom: 0.75rem;
    box-sizing: border-box;
  }

  .jump-panel input:focus { outline: none; border-color: #ff4444; }

  .jump-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  .jump-actions button, .quick-jumps button {
    padding: 0.5rem 1rem;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.15s;
  }

  .jump-actions button.primary { background: #ff4444; color: #fff; }
  .jump-actions button.primary:active { background: #ff6666; }
  .jump-actions button.secondary { background: #222; color: #fff; }
  .jump-actions button.secondary:active { background: #333; }

  .quick-jumps {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid #1a1a1a;
  }

  .quick-jumps button {
    flex: 1;
    background: #1a1a1a;
    border: 1px solid #222 !important;
    color: #888;
    padding: 0.4rem !important;
    font-size: 0.8rem !important;
  }

  .quick-jumps button:active { background: #333; color: #fff; }

  @media (max-width: 600px) {
    main { padding: 0.75rem 1rem 1rem; }
    main.focus-mode { padding: 0.5rem; }
    .desktop-only { display: none; }
    .mobile-only { display: flex; }
    .panel-overlay { padding: 1rem; }
  }
</style>
