import { error } from '@sveltejs/kit';
import { readFileSync } from 'fs';
import { getBook } from '$lib/server/db.js';

export function GET({ params }) {
  const book = getBook(Number(params.id));
  if (!book?.cover_path) throw error(404, 'No cover');

  try {
    const data = readFileSync(book.cover_path);
    const mime = book.cover_path.endsWith('.png') ? 'image/png' : 'image/jpeg';
    return new Response(data, {
      headers: {
        'Content-Type': mime,
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    });
  } catch {
    throw error(404, 'Cover file missing');
  }
}
