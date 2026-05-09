<script>
  import { createEventDispatcher } from 'svelte';

  export let isPlaying = false;
  export let isPaused = false;
  export let canPlay = true;
  export let minimal = false;

  const dispatch = createEventDispatcher();
</script>

<div class="controls" class:minimal>
  {#if isPlaying}
    <!-- Playing → show Pause -->
    <button
      class="control-btn pause"
      on:click={() => dispatch('pause')}
      title="Pause (Space)"
      aria-label="Pause"
    >
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
      </svg>
      {#if !minimal}<span>Pause</span>{/if}
    </button>

  {:else if isPaused}
    <!-- Paused → show Resume + Back -->
    <button
      class="control-btn back"
      on:click={() => dispatch('back')}
      title="Back to library"
      aria-label="Back to library"
    >
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
      </svg>
      {#if !minimal}<span>Library</span>{/if}
    </button>

    <button
      class="control-btn play"
      on:click={() => dispatch('resume')}
      title="Resume (Space)"
      aria-label="Resume"
    >
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5v14l11-7z"/>
      </svg>
      {#if !minimal}<span>Resume</span>{/if}
    </button>

  {:else}
    <!-- Idle → show Play -->
    <button
      class="control-btn play"
      on:click={() => dispatch('play')}
      disabled={!canPlay}
      title="Play (Space)"
      aria-label="Play"
    >
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5v14l11-7z"/>
      </svg>
      {#if !minimal}<span>Play</span>{/if}
    </button>
  {/if}
</div>

<style>
  .controls {
    display: flex;
    justify-content: center;
    gap: 1rem;
  }

  .controls.minimal { gap: 0.75rem; }

  .control-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s;
    font-weight: 500;
    color: #fff;
    -webkit-tap-highlight-color: transparent;
  }

  .controls.minimal .control-btn {
    padding: 0.5rem;
    border-radius: 50%;
    width: 48px;
    height: 48px;
  }

  .control-btn svg {
    width: 22px;
    height: 22px;
    flex-shrink: 0;
  }

  .control-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .control-btn.play  { background: #ff4444; }
  .control-btn.play:active:not(:disabled) { background: #ff6666; }

  .control-btn.pause { background: #ffaa00; color: #000; }
  .control-btn.pause:active { background: #ffcc44; }

  .control-btn.back  { background: #222; }
  .control-btn.back:active { background: #333; }

  @media (max-width: 600px) {
    .controls { gap: 0.75rem; }

    .control-btn {
      padding: 0.875rem 1.25rem;
      min-height: 52px;
      min-width: 52px;
    }

    .control-btn span { display: none; }

    .controls.minimal .control-btn {
      width: 52px;
      height: 52px;
    }
  }
</style>
