import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { mkdtempSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { parseEPUBFile } from '../lib/server/epub-parser.js'

describe('parseEPUBFile page-list extraction', () => {
  it('maps EPUB3 page-list anchors to word offsets', async () => {
    const zip = new JSZip()
    zip.file('META-INF/container.xml', `<?xml version="1.0"?>
      <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
        <rootfiles><rootfile full-path="OPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
      </container>`)
    zip.file('OPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?>
      <package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0">
        <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
          <dc:title>Page Test</dc:title>
          <dc:creator>Tester</dc:creator>
        </metadata>
        <manifest>
          <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
          <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
        </manifest>
        <spine><itemref idref="chapter1"/></spine>
      </package>`)
    zip.file('OPS/nav.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
      <html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
        <body>
          <nav epub:type="page-list"><ol>
            <li><a href="chapter1.xhtml#p1">1</a></li>
            <li><a href="chapter1.xhtml#p2">2</a></li>
          </ol></nav>
        </body>
      </html>`)
    zip.file('OPS/chapter1.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
      <html xmlns="http://www.w3.org/1999/xhtml">
        <body>
          <p id="p1">Alpha bravo charlie delta echo.</p>
          <p id="p2">Foxtrot golf hotel india juliet.</p>
        </body>
      </html>`)

    const epubPath = join(mkdtempSync(join(tmpdir(), 'rsvp-epub-')), 'book.epub')
    writeFileSync(epubPath, await zip.generateAsync({ type: 'nodebuffer' }))

    const parsed = await parseEPUBFile(epubPath)

    expect(parsed.pages).toEqual([
      { label: '1', word_start: 0, page_order: 0 },
      { label: '2', word_start: 5, page_order: 1 }
    ])
  })
})
