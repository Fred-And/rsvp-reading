import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { join } from 'path';

export const DATA_DIR = process.env.DATA_DIR || './data';
export const UPLOADS_DIR = join(DATA_DIR, 'uploads');
const DB_PATH = join(DATA_DIR, 'rsvp.db');

/** @type {import('better-sqlite3').Database} */
let db;

export function getDB() {
  if (!db) throw new Error('DB not initialized — initDB() not called');
  return db;
}

export function initDB() {
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(UPLOADS_DIR, { recursive: true });

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS books (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT    NOT NULL,
      author      TEXT,
      filename    TEXT    NOT NULL,
      file_path   TEXT    NOT NULL,
      cover_path  TEXT,
      total_words INTEGER NOT NULL DEFAULT 0,
      uploaded_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chapters (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id       INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      title         TEXT    NOT NULL,
      word_start    INTEGER NOT NULL,
      word_end      INTEGER NOT NULL,
      chapter_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS book_texts (
      book_id INTEGER PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE,
      content TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reading_sessions (
      book_id      INTEGER PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE,
      current_word INTEGER NOT NULL DEFAULT 0,
      settings     TEXT    NOT NULL DEFAULT '{}',
      updated_at   INTEGER NOT NULL
    );
  `);

  // Migrate existing DBs that predate cover_path column
  try { db.exec(`ALTER TABLE books ADD COLUMN cover_path TEXT`); } catch {}

  return db;
}

// ─── Books ────────────────────────────────────────────────────────────────────

export function insertBook({ title, author, filename, filePath, totalWords }) {
  const db = getDB();
  const result = db
    .prepare(
      `INSERT INTO books (title, author, filename, file_path, total_words, uploaded_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(title, author ?? null, filename, filePath, totalWords, Date.now());
  return result.lastInsertRowid;
}

export function updateBookCover(id, coverPath) {
  getDB().prepare('UPDATE books SET cover_path = ? WHERE id = ?').run(coverPath, id);
}

export function insertChapters(bookId, chapters) {
  const db = getDB();
  const stmt = db.prepare(
    `INSERT INTO chapters (book_id, title, word_start, word_end, chapter_order)
     VALUES (?, ?, ?, ?, ?)`
  );
  const insertMany = db.transaction((items) => {
    for (const c of items) stmt.run(bookId, c.title, c.word_start, c.word_end, c.chapter_order);
  });
  insertMany(chapters);
}

export function insertBookText(bookId, content) {
  getDB()
    .prepare('INSERT INTO book_texts (book_id, content) VALUES (?, ?)')
    .run(bookId, content);
}

export function listBooks() {
  return getDB()
    .prepare(
      `SELECT b.id, b.title, b.author, b.total_words, b.uploaded_at,
              b.cover_path IS NOT NULL as has_cover,
              COALESCE(s.current_word, 0) as current_word
       FROM books b
       LEFT JOIN reading_sessions s ON s.book_id = b.id
       ORDER BY b.uploaded_at DESC`
    )
    .all();
}

export function getBook(id) {
  return getDB().prepare('SELECT * FROM books WHERE id = ?').get(id);
}

export function getBookText(bookId) {
  const row = getDB().prepare('SELECT content FROM book_texts WHERE book_id = ?').get(bookId);
  return row?.content ?? null;
}

export function getChapters(bookId) {
  return getDB()
    .prepare('SELECT * FROM chapters WHERE book_id = ? ORDER BY chapter_order')
    .all(bookId);
}

export function deleteBook(id) {
  getDB().prepare('DELETE FROM books WHERE id = ?').run(id);
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export function getSession(bookId) {
  return getDB().prepare('SELECT * FROM reading_sessions WHERE book_id = ?').get(bookId);
}

export function upsertSession(bookId, currentWord, settings) {
  getDB()
    .prepare(
      `INSERT INTO reading_sessions (book_id, current_word, settings, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(book_id) DO UPDATE SET
         current_word = excluded.current_word,
         settings     = excluded.settings,
         updated_at   = excluded.updated_at`
    )
    .run(bookId, currentWord, JSON.stringify(settings), Date.now());
}
