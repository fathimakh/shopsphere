import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CsvParseError, formatCsvCell, parseCsv, toCsv } from '../services/csv.js';

describe('CSV writer', () => {
  it('writes plain values unquoted with CRLF line endings', () => {
    assert.equal(toCsv(['id', 'n'], [['a', 1], ['b', 2.5]]), 'id,n\r\na,1\r\nb,2.5\r\n');
  });

  it('quotes fields containing commas, quotes or line breaks and doubles inner quotes', () => {
    assert.equal(formatCsvCell('Phone, 128 GB'), '"Phone, 128 GB"');
    assert.equal(formatCsvCell('The "Pro" model'), '"The ""Pro"" model"');
    assert.equal(formatCsvCell('line 1\nline 2'), '"line 1\nline 2"');
    assert.equal(formatCsvCell('a\r\nb'), '"a\r\nb"');
  });

  it('guards text cells against spreadsheet formula injection', () => {
    assert.equal(formatCsvCell('=HYPERLINK("http://evil")'), '"\'=HYPERLINK(""http://evil"")"');
    assert.equal(formatCsvCell('+1 555'), "'+1 555");
    assert.equal(formatCsvCell('-sale-'), "'-sale-");
    assert.equal(formatCsvCell('@cmd'), "'@cmd");
    assert.equal(formatCsvCell('\tTabbed'), "'\tTabbed");
  });

  it('writes numbers, dates and empty values safely', () => {
    assert.equal(formatCsvCell(-5), '-5');
    assert.equal(formatCsvCell(0), '0');
    assert.equal(formatCsvCell(Number.NaN), '');
    assert.equal(formatCsvCell(null), '');
    assert.equal(formatCsvCell(undefined), '');
    assert.equal(formatCsvCell(new Date('2026-01-02T03:04:05.000Z')), '2026-01-02T03:04:05.000Z');
    assert.equal(formatCsvCell(true), 'true');
  });
});

describe('CSV parser', () => {
  it('parses quoted fields with separators, escaped quotes and embedded newlines', () => {
    const text = 'name,note\r\n"Phone, 128 GB","He said ""hi"""\r\n"multi\r\nline",x\r\n';
    assert.deepEqual(parseCsv(text), [
      ['name', 'note'],
      ['Phone, 128 GB', 'He said "hi"'],
      ['multi\r\nline', 'x'],
    ]);
  });

  it('handles a UTF-8 BOM, LF / CR line endings, blank lines and a missing final newline', () => {
    const bom = String.fromCharCode(0xfeff);
    assert.deepEqual(parseCsv(`${bom}a,b\n\n1,2\r3,4\n   \n5,6`), [
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
      ['5', '6'],
    ]);
  });

  it('keeps empty fields and trims whitespace around unquoted values only', () => {
    assert.deepEqual(parseCsv('a,,c\n x , " y "\n'), [
      ['a', '', 'c'],
      ['x', ' y '],
    ]);
    assert.deepEqual(parseCsv('a,""\n'), [['a', '']]);
  });

  it('detects semicolon and tab separators (RapidMiner "Write CSV" defaults to ";")', () => {
    assert.deepEqual(parseCsv('"FIRST_ID";"SECOND_ID";"SIMILARITY"\n"p1";"p2";0.5\n'), [
      ['FIRST_ID', 'SECOND_ID', 'SIMILARITY'],
      ['p1', 'p2', '0.5'],
    ]);
    assert.deepEqual(parseCsv('a\tb\n1\t2\n'), [
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('accepts an explicit delimiter', () => {
    assert.deepEqual(parseCsv('a;b,c\n', { delimiter: ',' }), [['a;b', 'c']]);
  });

  it('returns no rows for empty input and rejects unterminated quotes', () => {
    assert.deepEqual(parseCsv(''), []);
    assert.deepEqual(parseCsv('\r\n\r\n'), []);
    assert.throws(() => parseCsv('a,"open\n'), CsvParseError);
  });

  it('round-trips everything the writer produces', () => {
    const rows = [
      ['product_id', 'name', 'price'],
      ['665f2a', 'Phone, "Pro"\nedition', 1499],
      ['665f2b', '', 0],
    ];
    assert.deepEqual(parseCsv(toCsv(rows[0], rows.slice(1))), rows.map((row) => row.map(String)));
  });
});
