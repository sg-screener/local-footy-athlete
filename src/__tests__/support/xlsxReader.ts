/**
 * Minimal, dependency-free .xlsx reader — TEST SUPPORT ONLY.
 *
 * Sam's authored source-of-truth sheets are .xlsx. The doc<->code equality
 * suites must read those files DIRECTLY: if a suite read a derived .json/.md
 * extract instead, Sam editing the sheet would not fail the build, and the
 * whole guarantee ("the sheet is the source of truth") would be theatre.
 *
 * Reads both the original inline-string exports and the shared-string,
 * namespaced SpreadsheetML written by the current spreadsheet authoring tool.
 * Worksheets are ordered as in `xl/workbook.xml`.
 *
 * So the reader needs exactly two things: ZIP/deflate extraction (via node's
 * zlib) and enough XML scanning to pull cell text. It is NOT a general xlsx
 * implementation — it asserts loudly when it meets anything it does not model
 * (including invalid shared-string references), so a future re-export cannot silently degrade a
 * gate into passing on empty data.
 */

import fs from 'fs';
import zlib from 'zlib';

/** One worksheet: a tab name plus its rows, each row an array of cell strings. */
export interface XlsxSheet {
  readonly name: string;
  readonly rows: readonly (readonly string[])[];
}

interface ZipEntry {
  readonly name: string;
  readonly data: Buffer;
}

/* ── ZIP container ── */

/**
 * Extract every file in a ZIP archive.
 *
 * Walks the central directory (located from the End Of Central Directory
 * record) rather than scanning local headers, so entries whose local header
 * omits sizes — streamed writers do this — still resolve correctly.
 */
function unzip(buffer: Buffer): ZipEntry[] {
  const EOCD_SIGNATURE = 0x06054b50;
  const CENTRAL_SIGNATURE = 0x02014b50;

  // The EOCD sits at the end, before an optional comment of up to 65535 bytes.
  let eocd = -1;
  for (let i = buffer.length - 22; i >= 0 && i >= buffer.length - 22 - 65535; i -= 1) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('xlsx: not a ZIP archive (no end-of-central-directory record)');

  const entryCount = buffer.readUInt16LE(eocd + 10);
  let cursor = buffer.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];

  for (let i = 0; i < entryCount; i += 1) {
    if (buffer.readUInt32LE(cursor) !== CENTRAL_SIGNATURE) {
      throw new Error(`xlsx: corrupt central directory at entry ${i}`);
    }
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.toString('utf8', cursor + 46, cursor + 46 + nameLength);

    // Re-read the name/extra lengths from the LOCAL header: they may differ
    // from the central copy, and the payload starts after the local ones.
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const raw = buffer.subarray(start, start + compressedSize);

    let data: Buffer;
    if (method === 0) {
      data = Buffer.from(raw);
    } else if (method === 8) {
      data = zlib.inflateRawSync(raw);
    } else {
      throw new Error(`xlsx: unsupported ZIP compression method ${method} for "${name}"`);
    }
    entries.push({ name, data });

    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/* ── XML helpers ── */

const XML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

function decodeXmlText(raw: string): string {
  return raw.replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (whole, code: string) => {
    if (code.startsWith('#x') || code.startsWith('#X')) {
      return String.fromCodePoint(parseInt(code.slice(2), 16));
    }
    if (code.startsWith('#')) return String.fromCodePoint(parseInt(code.slice(1), 10));
    const named = XML_ENTITIES[code];
    return named === undefined ? whole : named;
  });
}

/** Convert a cell reference's column letters ("A", "AB") to a 0-based index. */
function columnIndex(reference: string): number {
  const letters = /^([A-Z]+)/.exec(reference);
  if (!letters) throw new Error(`xlsx: unreadable cell reference "${reference}"`);
  let index = 0;
  for (const character of letters[1]) {
    index = index * 26 + (character.charCodeAt(0) - 64);
  }
  return index - 1;
}

/**
 * Pull the text out of one `<c>` element.
 *
 * Inline strings carry `<is><t>…</t></is>`; numbers and dates carry a bare
 * `<v>`. Multi-run inline strings hold several `<t>` fragments that must be
 * concatenated, which is why every `<t>` is collected rather than the first.
 */
function cellText(cellXml: string): string {
  const fragments = [...cellXml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => m[1]);
  if (fragments.length > 0) return decodeXmlText(fragments.join(''));
  const value = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(cellXml);
  return value ? decodeXmlText(value[1]) : '';
}

/** Excel serializers may choose a prefix for the same SpreadsheetML namespace. */
export function spreadsheetXml(xml: string): string {
  for (const match of xml.matchAll(/xmlns:([A-Za-z_][\w.-]*)="http:\/\/schemas.openxmlformats.org\/spreadsheetml\/2006\/main"/g)) {
    const prefix = match[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    xml = xml.replace(new RegExp(`<(\\/?)${prefix}:`, 'g'), '<$1');
  }
  return xml;
}

export function parseXlsxWorksheet(xml: string, sharedStrings: readonly string[] = []): string[][] {
  xml = spreadsheetXml(xml);
  const rows: string[][] = [];
  const sheetData = /<sheetData>([\s\S]*?)<\/sheetData>/.exec(xml);
  if (!sheetData) return rows;

  for (const rowMatch of sheetData[1].matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attributes = cellMatch[1];
      const body = cellMatch[2] ?? '';
      const reference = /r="([A-Z]+\d+)"/.exec(attributes);
      let text = cellText(body);
      if (/\bt="s"/.test(attributes)) {
        const index = Number(text);
        if (!/^\d+$/.test(text) || !Number.isSafeInteger(index) || index >= sharedStrings.length) {
          throw new Error(`xlsx: invalid shared string index '${text}' at ${reference?.[1] ?? 'unknown cell'}`);
        }
        text = sharedStrings[index];
      }
      if (reference) {
        const index = columnIndex(reference[1]);
        while (cells.length < index) cells.push('');
        cells[index] = text;
      } else {
        cells.push(text);
      }
    }
    rows.push(cells);
  }
  // Self-closing <row/> elements carry no cells and are dropped by the regex
  // above; they only ever represent blank rows, which callers filter anyway.
  return rows;
}

/* ── Public API ── */

/**
 * Read an .xlsx workbook into ordered sheets of raw cell strings.
 *
 * Throws rather than degrading if the workbook uses a feature this reader does
 * not model, so a gate can never quietly pass on data it failed to read.
 */
export function readXlsx(filePath: string): XlsxSheet[] {
  const entries = unzip(fs.readFileSync(filePath));
  const byName = new Map(entries.map((entry) => [entry.name, entry.data]));

  const sharedXml = spreadsheetXml(byName.get('xl/sharedStrings.xml')?.toString('utf8') ?? '');
  const sharedStrings = [...sharedXml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(match => cellText(match[1]));

  const workbook = byName.get('xl/workbook.xml');
  if (!workbook) throw new Error('xlsx: missing xl/workbook.xml');
  const workbookXml = spreadsheetXml(workbook.toString('utf8'));

  const relationships = byName.get('xl/_rels/workbook.xml.rels');
  const targetById = new Map<string, string>();
  if (relationships) {
    for (const match of relationships.toString('utf8').matchAll(/<Relationship\b([^>]*)\/>/g)) {
      const id = /Id="([^"]+)"/.exec(match[1]);
      const target = /Target="([^"]+)"/.exec(match[1]);
      if (id && target) targetById.set(id[1], target[1].replace(/^\/?xl\//, '').replace(/^\//, ''));
    }
  }

  const sheets: XlsxSheet[] = [];
  let positional = 0;
  for (const match of workbookXml.matchAll(/<sheet\b([^>]*)\/>/g)) {
    const attributes = match[1];
    const name = /name="([^"]*)"/.exec(attributes);
    const relationshipId = /r:id="([^"]+)"/.exec(attributes);
    positional += 1;

    const target = relationshipId ? targetById.get(relationshipId[1]) : undefined;
    const path = target ? `xl/${target}` : `xl/worksheets/sheet${positional}.xml`;
    const sheetData = byName.get(path);
    if (!sheetData) throw new Error(`xlsx: missing worksheet part "${path}"`);

    sheets.push({
      name: name ? decodeXmlText(name[1]) : `sheet${positional}`,
      rows: parseXlsxWorksheet(sheetData.toString('utf8'), sharedStrings),
    });
  }
  if (sheets.length === 0) throw new Error('xlsx: workbook declares no sheets');
  return sheets;
}

/**
 * Read one named sheet as header-keyed records, dropping fully blank rows.
 *
 * `headerRow` is 1-based and defaults to the first row. Sam's sheets sometimes
 * carry authored preamble above the header (sign-off line, vocabulary legend),
 * so the header is not always row 1.
 */
export function readSheetRecords(
  filePath: string,
  sheetName: string,
  headerRow = 1,
): Array<Record<string, string>> {
  const sheet = readXlsx(filePath).find((candidate) => candidate.name === sheetName);
  if (!sheet) throw new Error(`xlsx: no sheet named "${sheetName}" in ${filePath}`);
  if (headerRow < 1) throw new Error(`xlsx: headerRow must be 1-based, got ${headerRow}`);
  const header = sheet.rows[headerRow - 1];
  const body = sheet.rows.slice(headerRow);
  if (!header) throw new Error(`xlsx: sheet "${sheetName}" has no row ${headerRow}`);

  const columns = header.map((cell) => cell.trim());
  return body
    .filter((row) => row.some((cell) => cell.trim() !== ''))
    .map((row) => {
      const record: Record<string, string> = {};
      columns.forEach((column, index) => {
        if (column !== '') record[column] = (row[index] ?? '').trim();
      });
      return record;
    });
}
