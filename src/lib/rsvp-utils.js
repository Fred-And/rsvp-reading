/**
 * RSVP utility functions for text processing and display calculations
 */

/**
 * Parse text into an array of words
 * @param {string} text - The input text to parse
 * @returns {string[]} Array of words
 */
export function parseText(text) {
  if (!text || typeof text !== "string") return [];
  return text.trim().split(/\s+/).filter((w) => w.length > 0);
}

/**
 * Calculate the Optimal Recognition Point (ORP) index for a word.
 * The ORP is the character position where the eye naturally focuses when reading.
 * Based on word length, this determines which letter should be highlighted.
 * Supports all Unicode letters (Latin, Cyrillic, CJK, Arabic, etc.)
 *
 * @param {string} word - The word to calculate ORP for
 * @returns {number} The index of the letter that should be highlighted
 */
export function getORPIndex(word) {
  if (!word || typeof word !== "string") return 0;
  const len = word.replace(/[^\p{L}]/gu, "").length;
  if (len <= 1) return 0;
  if (len <= 3) return 0;
  if (len <= 5) return 1;
  if (len <= 9) return 2;
  if (len <= 12) return 3;
  return Math.floor(Math.log2(len - 1)) + 1;
}

/**
 * Get the actual character index for ORP, accounting for leading punctuation.
 * This adjusts the ORP index to skip over non-letter characters.
 * Supports all Unicode letters.
 *
 * @param {string} word - The word to calculate actual ORP for
 * @returns {number} The actual character index in the word
 */
// Pre-compiled regex for performance
const unicodeLetterRegex = /\p{L}/u

export function getActualORPIndex(word) {
  if (!word || typeof word !== "string") return 0;

  const orpIndex = getORPIndex(word);
  let letterCount = 0;

  for (let i = 0; i < word.length; i++) {
    if (unicodeLetterRegex.test(word[i])) {
      if (letterCount === orpIndex) return i
      letterCount++
    }
  }

  return Math.min(orpIndex, word.length - 1);
}

/**
 * Calculate the display delay for a word based on WPM and punctuation.
 * Words ending with sentence punctuation get a longer pause.
 *
 * @param {string} word - The word to calculate delay for
 * @param {number} wordsPerMinute - Reading speed in WPM
 * @param {boolean} pauseOnPunctuation - Whether to add extra pause on punctuation
 * @param {number} punctuationMultiplier - Multiplier for sentence-ending punctuation
 * @returns {number} Delay in milliseconds
 */
export function getWordDelay(
  word,
  wordsPerMinute,
  pauseOnPunctuation = true,
  punctuationMultiplier = 2,
  wordLengthWPMMultiplier = 0,
) {
  if (!word || typeof word !== "string") return 60000 / wordsPerMinute;
  if (!wordsPerMinute || wordsPerMinute <= 0) return 200; // Default fallback

  var baseDelay = 60000 / wordsPerMinute;

  // Longer pause for long words (12+ characters is roughly 2 standard deviations above average English word length)
  if (wordLengthWPMMultiplier > 0 && word.length >= 12) {
    // For every character above 12, add wordLengthWPMMultiplier percentage points to delay
    baseDelay *= 1 + ((wordLengthWPMMultiplier / 100) * (word.length - 12));
  }

  if (pauseOnPunctuation) {
    // Longer pause for sentence-ending punctuation
    if (/[.!?;:]$/.test(word)) {
      return baseDelay * punctuationMultiplier;
    }
    // Shorter pause for commas
    if (/[,]$/.test(word)) {
      return baseDelay * 1.5;
    }
  }

  return baseDelay;
}

/**
 * Format remaining reading time as MM:SS
 *
 * @param {number} remainingWords - Number of words remaining
 * @param {number} wordsPerMinute - Reading speed in WPM
 * @returns {string} Formatted time string (e.g., "2:30")
 */
export function formatTimeRemaining(remainingWords, wordsPerMinute) {
  if (remainingWords <= 0 || !wordsPerMinute || wordsPerMinute <= 0) {
    return "0:00";
  }

  const seconds = Math.ceil((remainingWords / wordsPerMinute) * 60);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Split a word into parts for ORP display (before, ORP letter, after)
 *
 * @param {string} word - The word to split
 * @returns {{ before: string, orp: string, after: string }} Word parts
 */
export function splitWordForDisplay(word) {
  if (!word || typeof word !== "string") {
    return { before: "", orp: "", after: "" };
  }

  const orpIndex = getActualORPIndex(word);

  return {
    before: word.slice(0, orpIndex),
    orp: word[orpIndex] || "",
    after: word.slice(orpIndex + 1),
  };
}

/**
 * Check if a word should trigger a pause based on pause-every-N-words setting
 *
 * @param {number} wordIndex - Current word index (0-based)
 * @param {number} pauseAfterWords - Pause after every N words (0 = disabled)
 * @returns {boolean} Whether to pause
 */
export function shouldPauseAtWord(wordIndex, pauseAfterWords) {
  if (pauseAfterWords <= 0) return false;
  if (wordIndex <= 0) return false;
  return wordIndex % pauseAfterWords === 0;
}

/**
 * Extract a horizontal reading frame around the current word.
 *
 * The frame favors forward context: one previous word, the current word,
 * and as many upcoming words as the frame size allows.
 *
 * @param {string[]} allWords - Complete word array
 * @param {number} centerIdx - Current word index
 * @param {number} frameSize - Total words to display
 * @returns {{ subset: string[], centerOffset: number }}
 */
export function extractWordFrame(allWords, centerIdx, frameSize) {
  if (centerIdx >= allWords.length) {
    return { subset: [allWords[centerIdx] || ""], centerOffset: 0 };
  }

  const visibleFrameSize = Math.max(4, frameSize);
  const previousWordCount = Math.min(1, centerIdx);
  const nextWordCount = Math.max(0, visibleFrameSize - previousWordCount - 1);
  const leftBound = Math.max(0, centerIdx - previousWordCount);
  const rightBound = Math.min(allWords.length, centerIdx + nextWordCount + 1);

  const subset = allWords.slice(leftBound, rightBound);
  const centerOffset = centerIdx - leftBound;

  return { subset, centerOffset };
}

/**
 * Build page ranges from EPUB page marks, falling back to synthetic pages when
 * a book does not contain a real EPUB page-list.
 *
 * @param {number} totalWords
 * @param {{label?: string, word_start?: number}[]} pageMarks
 * @param {number} fallbackWordsPerPage
 * @returns {{label: string, start: number, end: number, source: 'epub'|'synthetic'}[]}
 */
export function buildPageRanges(totalWords, pageMarks = [], fallbackWordsPerPage = 350) {
  const safeTotal = Math.max(0, Number(totalWords) || 0);
  if (safeTotal === 0) return [];

  const cleanMarks = (Array.isArray(pageMarks) ? pageMarks : [])
    .map((mark) => ({
      label: String(mark?.label ?? ''),
      start: Math.max(0, Math.min(safeTotal, Number(mark?.word_start) || 0))
    }))
    .filter((mark) => mark.start < safeTotal)
    .sort((a, b) => a.start - b.start)
    .filter((mark, index, marks) => index === 0 || mark.start !== marks[index - 1].start);

  if (cleanMarks.length > 0) {
    return cleanMarks.map((mark, index) => ({
      label: mark.label || String(index + 1),
      start: mark.start,
      end: index + 1 < cleanMarks.length ? cleanMarks[index + 1].start : safeTotal,
      source: 'epub'
    })).filter((range) => range.end > range.start);
  }

  const pageSize = Math.max(1, Number(fallbackWordsPerPage) || 350);
  const ranges = [];
  for (let start = 0, pageNumber = 1; start < safeTotal; start += pageSize, pageNumber++) {
    ranges.push({
      label: String(pageNumber),
      start,
      end: Math.min(safeTotal, start + pageSize),
      source: 'synthetic'
    });
  }
  return ranges;
}

/**
 * Find the page containing a one-based currentWordIndex.
 * @param {{start: number, end: number}[]} ranges
 * @param {number} currentWordIndex
 * @returns {number}
 */
export function getCurrentPageIndex(ranges, currentWordIndex) {
  if (!Array.isArray(ranges) || ranges.length === 0) return 0;
  const zeroBasedWord = Math.max(0, (Number(currentWordIndex) || 1) - 1);
  const idx = ranges.findIndex((range) => zeroBasedWord >= range.start && zeroBasedWord < range.end);
  if (idx !== -1) return idx;
  return zeroBasedWord >= ranges[ranges.length - 1].end ? ranges.length - 1 : 0;
}
