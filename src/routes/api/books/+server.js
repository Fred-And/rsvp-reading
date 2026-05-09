import { json, error } from '@sveltejs/kit';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { parseEPUBFile } from '$lib/server/epub-parser.js';
import {
  insertBook,
  insertChapters,
  insertBookText,
  updateBookCover,
  listBooks,
  UPLOADS_DIR
} from '$lib/server/db.js';

export async function GET() {
  return json(listBooks());
}

export async function POST({ request }) {
  const formData = await request.formData();
  const file = /** @type {File|null} */ (formData.get('file'));

  if (!file || !file.name.toLowerCase().endsWith('.epub')) {
    throw error(400, 'Only .epub files are supported');
  }

  // Write EPUB to disk
  const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const filePath = join(UPLOADS_DIR, safeName);
  writeFileSync(filePath, Buffer.from(await file.arrayBuffer()));

  // Parse EPUB
  let parsed;
  try {
    parsed = await parseEPUBFile(filePath);
  } catch (e) {
    throw error(422, `Failed to parse EPUB: ${e.message}`);
  }

  const { title, author, fullText, totalWords, chapters, cover } = parsed;

  const bookId = Number(insertBook({ title, author, filename: file.name, filePath, totalWords }));

  insertBookText(bookId, fullText);
  insertChapters(bookId, chapters);

  // Save cover image if found
  if (cover) {
    const ext = cover.mime.includes('png') ? 'png' : 'jpg';
    const coverPath = join(UPLOADS_DIR, `${bookId}_cover.${ext}`);
    writeFileSync(coverPath, cover.buffer);
    updateBookCover(bookId, coverPath);
  }

  return json({ id: bookId, title, author, totalWords, chapters: chapters.length }, { status: 201 });
}
