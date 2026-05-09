<script>
  import { createEventDispatcher } from 'svelte';

  export let chapters = [];
  export let currentChapterIndex = 0;
  export let open = false;

  const dispatch = createEventDispatcher();

  function select(chapter) {
    dispatch('select', { wordIndex: chapter.word_start });
    open = false;
  }

  function close() {
    open = false;
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="backdrop" on:click={close}></div>
  <div class="drawer" role="dialog" aria-label="Chapters">
    <div class="drawer-handle"></div>
    <h2 class="drawer-title">Chapters</h2>
    <ul class="chapter-list">
      {#each chapters as ch, i (ch.id ?? i)}
        <li>
          <button
            class="chapter-btn"
            class:active={i === currentChapterIndex}
            on:click={() => select(ch)}
          >
            <span class="ch-title">{ch.title}</span>
            {#if i === currentChapterIndex}
              <span class="ch-active-dot"></span>
            {/if}
          </button>
        </li>
      {/each}
    </ul>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 200;
    animation: fade-in 0.2s ease;
  }

  .drawer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: #0d0d0d;
    border-top: 1px solid #222;
    border-radius: 20px 20px 0 0;
    z-index: 201;
    max-height: 70dvh;
    display: flex;
    flex-direction: column;
    animation: slide-up 0.25s ease;
    padding-bottom: env(safe-area-inset-bottom, 0);
  }

  .drawer-handle {
    width: 36px;
    height: 4px;
    background: #333;
    border-radius: 2px;
    margin: 12px auto 0;
    flex-shrink: 0;
  }

  .drawer-title {
    margin: 1rem 1.25rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #555;
    flex-shrink: 0;
  }

  .chapter-list {
    list-style: none;
    margin: 0;
    padding: 0 0 1rem;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    flex: 1;
  }

  .chapter-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.875rem 1.25rem;
    background: none;
    border: none;
    color: #888;
    font-size: 1rem;
    text-align: left;
    cursor: pointer;
    transition: background 0.15s;
    -webkit-tap-highlight-color: transparent;
  }

  .chapter-btn:active { background: #111; }

  .chapter-btn.active {
    color: #fff;
  }

  .ch-title {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ch-active-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #ff4444;
    flex-shrink: 0;
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  @keyframes slide-up {
    from { transform: translateY(100%); }
    to   { transform: translateY(0); }
  }
</style>
