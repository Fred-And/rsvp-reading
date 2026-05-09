import { json, error } from '@sveltejs/kit';
import { unlinkSync } from 'fs';
import { getBook, deleteBook } from '$lib/server/db.js';

export async function DELETE({ params }) {
  const id = Number(params.id);
  const book = getBook(id);
  if (!book) throw error(404, 'Book not found');

  // Remove file from disk (best-effort)
  try { unlinkSync(book.file_path); } catch {}

  deleteBook(id);
  return json({ ok: true });
}
