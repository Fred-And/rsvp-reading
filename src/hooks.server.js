import { initDB } from '$lib/server/db.js';

initDB();

export function handle({ event, resolve }) {
  return resolve(event);
}
