import { listBooks } from '$lib/server/db.js';

export function load() {
  return { books: listBooks() };
}
