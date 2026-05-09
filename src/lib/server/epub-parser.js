import JSZip from 'jszip';
import { load } from 'cheerio';
import { readFileSync } from 'fs';

/**
 * Parse an EPUB file and return title, author, full extracted text, and chapters.
 * @param {string} filePath
 * @returns {Promise<{title:string, author:string|null, fullText:string, totalWords:number, chapters:Array}>}
 */
export async function parseEPUBFile(filePath) {
  const data = readFileSync(filePath);
  const zip = await JSZip.loadAsync(data);

  // 1. container.xml → OPF path
  const containerXml = await zip.file('META-INF/container.xml')?.async('string');
  if (!containerXml) throw new Error('Invalid EPUB: missing META-INF/container.xml');

  const $c = load(containerXml, { xmlMode: true });
  const opfPath = $c('rootfile').attr('full-path');
  if (!opfPath) throw new Error('Invalid EPUB: cannot find OPF path');

  const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';

  // 2. Parse OPF
  const opfXml = await zip.file(opfPath)?.async('string');
  if (!opfXml) throw new Error('Invalid EPUB: cannot read OPF file');
  const $opf = load(opfXml, { xmlMode: true });

  const title = $opf('dc\\:title').first().text().trim() || 'Unknown Title';
  const author = $opf('dc\\:creator').first().text().trim() || null;

  // Build manifest: id → href
  const manifest = {};
  $opf('manifest item').each((_, el) => {
    const id = $opf(el).attr('id');
    const href = $opf(el).attr('href');
    if (id && href) manifest[id] = href;
  });

  // Spine: ordered idref list
  const spineIds = [];
  $opf('spine itemref').each((_, el) => {
    const idref = $opf(el).attr('idref');
    if (idref) spineIds.push(idref);
  });

  // 3. Collect chapter titles from NCX or nav
  const chapterTitlesByHref = await extractChapterTitlesByHref(zip, opfDir, manifest, $opf);

  // 4. Extract text per spine item
  let wordOffset = 0;
  const textParts = [];
  const chapters = [];

  for (let i = 0; i < spineIds.length; i++) {
    const href = manifest[spineIds[i]];
    if (!href) continue;

    const file = resolveZipFile(zip, opfDir, href);
    if (!file) continue;

    const html = await file.async('string');
    const $html = load(html);
    $html('script, style, nav, [epub\\:type="toc"]').remove();

    const rawText = $html('body').text().replace(/\s+/g, ' ').trim();
    if (!rawText) continue;

    const words = rawText.split(/\s+/).filter((w) => w.length > 0);
    if (words.length < 5) continue; // skip near-empty nav pages

    const wordStart = wordOffset;
    const wordEnd = wordOffset + words.length;
    wordOffset = wordEnd;

    textParts.push(rawText);

    // Resolve title: try by href (bare filename), then index
    const bareHref = href.split('/').pop()?.split('#')[0] ?? '';
    const chTitle =
      chapterTitlesByHref[bareHref] ||
      chapterTitlesByHref[href] ||
      chapterTitlesByHref[i] ||
      `Chapter ${chapters.length + 1}`;

    chapters.push({
      title: chTitle,
      word_start: wordStart,
      word_end: wordEnd,
      chapter_order: chapters.length
    });
  }

  const fullText = textParts.join(' ').replace(/\s+/g, ' ').trim();
  const totalWords = fullText.split(/\s+/).filter((w) => w.length > 0).length;

  const cover = await extractCover(zip, opfDir, manifest, $opf);

  return { title, author, fullText, totalWords, chapters, cover };
}

/**
 * Returns a map of href (bare filename) → chapter title, scraped from NCX or nav.xhtml.
 */
async function extractChapterTitlesByHref(zip, opfDir, manifest, $opf) {
  const titles = {};

  // Try NCX (EPUB2)
  const ncxId = $opf('spine').attr('toc');
  if (ncxId && manifest[ncxId]) {
    try {
      const ncxFile = resolveZipFile(zip, opfDir, manifest[ncxId]);
      if (ncxFile) {
        const ncxXml = await ncxFile.async('string');
        const $ncx = load(ncxXml, { xmlMode: true });
        let idx = 0;
        $ncx('navPoint').each((_, el) => {
          const label = $ncx(el).find('navLabel text').first().text().trim();
          const src = $ncx(el).find('content').attr('src')?.split('#')[0];
          const bare = src?.split('/').pop() ?? '';
          if (bare) titles[bare] = label;
          if (src) titles[src] = label;
          titles[idx++] = label;
        });
        if (Object.keys(titles).length > 0) return titles;
      }
    } catch {}
  }

  // Try nav.xhtml (EPUB3)
  const navHref = Object.values(manifest).find(
    (h) => h.includes('nav') || h.endsWith('toc.xhtml')
  );
  if (navHref) {
    try {
      const navFile = resolveZipFile(zip, opfDir, navHref);
      if (navFile) {
        const navHtml = await navFile.async('string');
        const $nav = load(navHtml);
        let idx = 0;
        $nav('nav li a, nav[epub\\:type="toc"] a').each((_, el) => {
          const href = $nav(el).attr('href')?.split('#')[0];
          const label = $nav(el).text().trim();
          if (!label) return;
          const bare = href?.split('/').pop() ?? '';
          if (bare) titles[bare] = label;
          if (href) titles[href] = label;
          titles[idx++] = label;
        });
      }
    } catch {}
  }

  return titles;
}

/**
 * Try to extract cover image from EPUB.
 * Tries: OPF meta[name=cover], EPUB3 cover-image property, filename heuristic.
 * @returns {Promise<{buffer: Buffer, mime: string}|null>}
 */
async function extractCover(zip, opfDir, manifest, $opf) {
  // Build reverse manifest: href → media-type
  const manifestMime = {};
  $opf('manifest item').each((_, el) => {
    const href = $opf(el).attr('href');
    const mime = $opf(el).attr('media-type') || '';
    if (href) manifestMime[href] = mime;
  });

  const isImage = (mime) => mime.startsWith('image/') && !mime.includes('svg');
  const mimeFromHref = (href) =>
    manifestMime[href] ||
    (href?.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');

  async function readCover(href) {
    if (!href) return null;
    const file = resolveZipFile(zip, opfDir, href);
    if (!file) return null;
    return { buffer: await file.async('nodebuffer'), mime: mimeFromHref(href) };
  }

  // Method 1: <meta name="cover" content="item-id"/> (EPUB2)
  const coverId = $opf('meta[name="cover"]').attr('content');
  if (coverId && manifest[coverId] && isImage(mimeFromHref(manifest[coverId]))) {
    const result = await readCover(manifest[coverId]);
    if (result) return result;
  }

  // Method 2: <item properties="cover-image"/> (EPUB3)
  let coverHref3 = null;
  $opf('manifest item').each((_, el) => {
    if ($opf(el).attr('properties')?.includes('cover-image')) {
      coverHref3 = $opf(el).attr('href');
    }
  });
  if (coverHref3) {
    const result = await readCover(coverHref3);
    if (result) return result;
  }

  // Method 3: any manifest image whose href contains "cover"
  let coverHrefFallback = null;
  $opf('manifest item').each((_, el) => {
    const href = $opf(el).attr('href') || '';
    const mime = $opf(el).attr('media-type') || '';
    if (isImage(mime) && href.toLowerCase().includes('cover')) {
      coverHrefFallback = href;
    }
  });
  if (coverHrefFallback) {
    const result = await readCover(coverHrefFallback);
    if (result) return result;
  }

  return null;
}

function resolveZipFile(zip, opfDir, href) {
  return (
    zip.file(opfDir + href) ||
    zip.file(href) ||
    zip.file(decodeURIComponent(opfDir + href)) ||
    zip.file(decodeURIComponent(href)) ||
    null
  );
}
