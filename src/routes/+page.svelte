<script>
  import { invalidateAll } from '$app/navigation';

  export let data;

  let uploading = false;
  let uploadError = '';
  let fileInput;

  function progressPercent(book) {
    if (!book.total_words || book.total_words === 0) return 0;
    return Math.round((book.current_word / book.total_words) * 100);
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    uploading = true;
    uploadError = '';

    const form = new FormData();
    form.append('file', file);

    try {
      const res = await fetch('/api/books', { method: 'POST', body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        uploadError = err.message || 'Upload failed';
      } else {
        await invalidateAll();
      }
    } catch {
      uploadError = 'Network error';
    } finally {
      uploading = false;
      fileInput.value = '';
    }
  }

  async function handleDelete(id, title) {
    if (!confirm(`Delete "${title}"?`)) return;
    await fetch(`/api/books/${id}`, { method: 'DELETE' });
    await invalidateAll();
  }
</script>

<svelte:head>
  <title>Speed Reader</title>
</svelte:head>

<div class="library">
  <header class="lib-header">
    <h1>Speed Reader</h1>
  </header>

  {#if data.books.length === 0}
    <div class="empty">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/></svg>
      <p>No books yet</p>
      <p class="empty-hint">Tap the button below to add your first EPUB</p>
    </div>
  {:else}
    <ul class="book-list">
      {#each data.books as book (book.id)}
        {@const pct = progressPercent(book)}
        <li class="book-card">
          <a href="/read/{book.id}" class="book-link">
            <div class="book-icon">
              {#if book.has_cover}
                <img src="/api/books/{book.id}/cover" alt="" class="cover-img" />
              {:else}
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/></svg>
              {/if}
            </div>
            <div class="book-info">
              <span class="book-title">{book.title}</span>
              {#if book.author}
                <span class="book-author">{book.author}</span>
              {/if}
              <div class="book-progress-row">
                <div class="book-progress-bar">
                  <div class="book-progress-fill" style="width:{pct}%"></div>
                </div>
                <span class="book-pct">{pct}%</span>
              </div>
            </div>
          </a>
          <button
            class="delete-btn"
            on:click={() => handleDelete(book.id, book.title)}
            title="Delete book"
            aria-label="Delete {book.title}"
          >
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  {#if uploadError}
    <p class="upload-error">{uploadError}</p>
  {/if}

  <!-- Hidden file input -->
  <input
    bind:this={fileInput}
    type="file"
    accept=".epub"
    style="display:none"
    on:change={handleUpload}
  />

  <!-- FAB upload button -->
  <button
    class="fab"
    on:click={() => fileInput.click()}
    disabled={uploading}
    aria-label="Add book"
    title="Add EPUB"
  >
    {#if uploading}
      <span class="spinner"></span>
    {:else}
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
    {/if}
  </button>
</div>

<style>
  :global(body) {
    background: #000;
    color: #fff;
    margin: 0;
    padding: 0;
    font-family: 'Segoe UI', system-ui, sans-serif;
    min-height: 100dvh;
  }

  .library {
    max-width: 600px;
    margin: 0 auto;
    padding: 0 0 100px;
    min-height: 100dvh;
  }

  .lib-header {
    padding: 1.25rem 1.25rem 0.75rem;
    position: sticky;
    top: 0;
    background: #000;
    z-index: 10;
    border-bottom: 1px solid #111;
  }

  h1 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 500;
    color: #888;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    font-size: 0.85rem;
  }

  /* Empty state */
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 4rem 2rem;
    color: #444;
  }

  .empty svg {
    width: 64px;
    height: 64px;
    opacity: 0.3;
  }

  .empty p { margin: 0; font-size: 1.1rem; }
  .empty-hint { color: #333; font-size: 0.85rem !important; }

  /* Book list */
  .book-list {
    list-style: none;
    margin: 0;
    padding: 0.75rem 0;
  }

  .book-card {
    display: flex;
    align-items: center;
    border-bottom: 1px solid #111;
  }

  .book-link {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.25rem;
    text-decoration: none;
    color: inherit;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.15s;
  }

  .book-link:active { background: #0d0d0d; }

  .book-icon {
    width: 44px;
    height: 56px;
    background: #111;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: #333;
  }

  .book-icon svg { width: 24px; height: 24px; }

  .cover-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 6px;
  }

  .book-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .book-title {
    font-size: 1rem;
    font-weight: 500;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .book-author {
    font-size: 0.8rem;
    color: #555;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .book-progress-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.25rem;
  }

  .book-progress-bar {
    flex: 1;
    height: 3px;
    background: #1a1a1a;
    border-radius: 2px;
    overflow: hidden;
  }

  .book-progress-fill {
    height: 100%;
    background: #ff4444;
    border-radius: 2px;
    transition: width 0.3s;
  }

  .book-pct {
    font-size: 0.7rem;
    color: #444;
    font-family: monospace;
    min-width: 2.5rem;
    text-align: right;
  }

  .delete-btn {
    padding: 1rem 1rem 1rem 0;
    background: none;
    border: none;
    color: #2a2a2a;
    cursor: pointer;
    transition: color 0.15s;
    flex-shrink: 0;
    -webkit-tap-highlight-color: transparent;
  }

  .delete-btn:active { color: #ff4444; }
  .delete-btn svg { width: 20px; height: 20px; display: block; }

  .upload-error {
    margin: 1rem 1.25rem 0;
    color: #ff4444;
    font-size: 0.875rem;
  }

  /* FAB */
  .fab {
    position: fixed;
    bottom: 1.5rem;
    right: 1.5rem;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: #ff4444;
    border: none;
    color: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 16px rgba(255, 68, 68, 0.4);
    transition: transform 0.15s, box-shadow 0.15s;
    -webkit-tap-highlight-color: transparent;
    z-index: 20;
  }

  .fab:active { transform: scale(0.93); }
  .fab:disabled { opacity: 0.6; }
  .fab svg { width: 28px; height: 28px; }

  .spinner {
    width: 22px;
    height: 22px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }
</style>
