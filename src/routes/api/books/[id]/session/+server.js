import { json, error } from '@sveltejs/kit';
import { getBook, getSession, upsertSession } from '$lib/server/db.js';

export async function GET({ params }) {
  const id = Number(params.id);
  if (!getBook(id)) throw error(404, 'Book not found');
  const session = getSession(id);
  if (!session) return json(null);
  return json({
    currentWord: session.current_word,
    settings: JSON.parse(session.settings)
  });
}

export async function PUT({ params, request }) {
  const id = Number(params.id);
  if (!getBook(id)) throw error(404, 'Book not found');
  const { currentWord, settings } = await request.json();
  upsertSession(id, currentWord ?? 0, settings ?? {});
  return json({ ok: true });
}
