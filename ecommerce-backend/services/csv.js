/**
 * Small RFC 4180 CSV writer and parser (no dependency), used for the RapidMiner exports
 * and for importing RapidMiner's scored output.
 */

// Spreadsheet apps evaluate text cells starting with these characters as formulas
// ("CSV injection"), so such cells are prefixed with an apostrophe when written.
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[",\r\n]/;
const DELIMITERS = [',', ';', '\t'];

export class CsvParseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CsvParseError';
  }
}

/** Formats one cell: numbers as-is, dates as ISO strings, text guarded and quoted when needed. */
export const formatCsvCell = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (value instanceof Date) return value.toISOString();

  let text = String(value);
  if (FORMULA_TRIGGER.test(text)) text = `'${text}`;
  return NEEDS_QUOTES.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

/** Serialises a header and rows (arrays of cells) into CRLF-terminated CSV text. */
export const toCsv = (header, rows) =>
  [header, ...rows].map((row) => `${row.map(formatCsvCell).join(',')}\r\n`).join('');

/**
 * Picks the separator used by the header line. RapidMiner's "Write CSV" operator defaults to
 * ";" so semicolon (and tab) separated files are accepted as well as commas.
 */
const detectDelimiter = (text) => {
  const firstLine = text.slice(0, text.search(/\r|\n|$/));
  const counts = DELIMITERS.map((delimiter) => firstLine.split(delimiter).length - 1);
  const best = Math.max(...counts);
  return best > 0 ? DELIMITERS[counts.indexOf(best)] : ',';
};

/**
 * Parses CSV text into an array of rows (arrays of strings). Handles quoted fields with
 * embedded separators, quotes ("") and line breaks, CRLF / LF / CR line endings, a UTF-8
 * BOM and blank lines (skipped). Whitespace around unquoted values is trimmed.
 * Throws CsvParseError for an unterminated quoted field.
 */
export const parseCsv = (input, { delimiter } = {}) => {
  const text = String(input ?? '').replace(/^\uFEFF/, '');
  const separator = delimiter ?? detectDelimiter(text);
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let quoted = false;

  const endField = () => {
    row.push(quoted ? field : field.trim());
    field = '';
    quoted = false;
  };
  const endRow = () => {
    endField();
    if (row.some((cell) => cell !== '')) rows.push(row);
    row = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inQuotes) {
      if (char !== '"') field += char;
      else if (text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else inQuotes = false;
    } else if (char === '"' && field.trim() === '' && !quoted) {
      field = '';
      inQuotes = true;
      quoted = true;
    } else if (char === separator) {
      endField();
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      endRow();
    } else {
      field += char;
    }
  }

  if (inQuotes) throw new CsvParseError('Unterminated quoted field');
  if (field !== '' || quoted || row.length) endRow();
  return rows;
};
