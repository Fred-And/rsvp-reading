import { error } from '@sveltejs/kit';
import { getBook, getBookText, getChapters, getPages, getSession } from '$lib/server/db.js';
import { parseText } from '$lib/rsvp-utils.js';

export function load({ params }) {
  const id = Number(params.bookId);
  const book = getBook(id);
  if (!book) throw error(404, 'Book not found');

  const text = getBookText(id);
  if (!text) throw error(500, 'Book text missing');

  const words = parseText(text);
  const chapters = getChapters(id);
  const pages = getPages(id);
  const session = getSession(id);

  return {
    book: { id: book.id, title: book.title, author: book.author, totalWords: book.total_words },
    words,
    chapters,
    pages,
    savedWord: session?.current_word ?? 0,
    savedSettings: session ? JSON.parse(session.settings) : null
  };
}
