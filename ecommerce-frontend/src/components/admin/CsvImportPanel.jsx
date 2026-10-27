import { useId, useState } from 'react'
import toast from 'react-hot-toast'
import { FiCheckCircle, FiUploadCloud } from 'react-icons/fi'
import api from '../../api/axiosInstance'
import ErrorMessage from '../ErrorMessage'
import useAdminMutation from '../../hooks/useAdminMutation'
import { pluralize } from '../../utils/format'

// Matches the server's import limit (express.text limit in analyticsRoutes.js).
const MAX_BYTES = 10 * 1024 * 1024
const PREVIEW_ROWS = 4

/**
 * Accepted headers (contract §4), as on the server: the renamed output of product_similarity.rmp,
 * the generic alias, or Cross Distances' own column names.
 */
const HEADER_FORMATS = [
  ['first_id', 'second_id', 'similarity'],
  ['product_id', 'similar_product_id', 'score'],
  ['request', 'document', 'distance'],
]

const splitCsvLine = (line) => line.split(',').map((cell) => cell.trim().replace(/^"(.*)"$/, '$1'))

/**
 * Client-side sanity check before uploading: the header must name the three similarity columns
 * (any order, case-insensitive, like the server) and there must be at least one data row.
 */
function inspectCsv(text) {
  const lines = text
    .replace(/^\uFEFF/, '') // strip a UTF-8 byte-order mark
    .split(/\r?\n/)
    .filter((line) => line.trim())
  if (!lines.length) return { error: 'The file is empty.' }

  const header = splitCsvLine(lines[0])
  const names = header.map((name) => name.toLowerCase())
  if (!HEADER_FORMATS.some((format) => format.every((column) => names.includes(column)))) {
    return {
      error: `Unexpected header "${lines[0].slice(0, 80)}". The first line must be FIRST_ID,SECOND_ID,SIMILARITY (RapidMiner output) or product_id,similar_product_id,score.`,
    }
  }
  if (lines.length < 2) return { error: 'The file has a header but no similarity rows.' }
  return { header, rows: lines.length - 1, preview: lines.slice(1, PREVIEW_ROWS + 1).map(splitCsvLine) }
}

/**
 * Upload of RapidMiner's scored output (POST /analytics/import as text/csv). The file is read and
 * checked locally first, previewed, and only sent once the admin confirms.
 */
export default function CsvImportPanel({ onImported }) {
  const inputId = useId()
  const hintId = useId()
  const errorId = useId()
  const [file, setFile] = useState(null) // { name, size, text, header, rows, preview }
  const [fileError, setFileError] = useState(null)
  const [result, setResult] = useState(null)
  const [inputKey, setInputKey] = useState(0)
  const { run, isPending, error: uploadError, resetError } = useAdminMutation()

  const handleFileChange = async (event) => {
    const selected = event.target.files?.[0]
    setFile(null)
    setFileError(null)
    setResult(null)
    resetError()
    if (!selected) return

    if (!/\.csv$/i.test(selected.name)) {
      setFileError('Choose a .csv file exported from RapidMiner.')
      return
    }
    if (selected.size > MAX_BYTES) {
      setFileError('The file is larger than 10 MB.')
      return
    }
    const text = await selected.text()
    const inspection = inspectCsv(text)
    if (inspection.error) {
      setFileError(inspection.error)
      return
    }
    setFile({ name: selected.name, size: selected.size, text, ...inspection })
  }

  const upload = async () => {
    const { ok, data } = await run('import', () =>
      api.post('/analytics/import', file.text, { headers: { 'Content-Type': 'text/csv' } }),
    )
    if (!ok) return
    toast.success(`Imported ${pluralize(data.imported, 'similarity pair')} from RapidMiner`)
    setResult(data)
    setFile(null)
    setInputKey((key) => key + 1)
    onImported?.()
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={inputId} className="label">
          Scored similarity CSV
        </label>
        <input
          key={inputKey}
          id={inputId}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          aria-invalid={fileError ? true : undefined}
          aria-describedby={[fileError ? errorId : null, hintId].filter(Boolean).join(' ')}
          className="block w-full cursor-pointer rounded-xl border border-dashed border-stone-300 bg-stone-50 p-2 text-sm text-stone-600 file:mr-3 file:min-h-10 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand-700 file:px-4 file:text-sm file:font-semibold file:text-white hover:border-brand-400 aria-invalid:border-red-500"
        />
        <p id={hintId} className="mt-1.5 text-xs text-stone-500">
          Header <code className="rounded bg-stone-100 px-1">FIRST_ID,SECOND_ID,SIMILARITY</code> or{' '}
          <code className="rounded bg-stone-100 px-1">product_id,similar_product_id,score</code>. Replaces the previous import.
        </p>
        {fileError && (
          <p id={errorId} role="alert" className="mt-2 text-sm font-medium text-red-700">
            {fileError}
          </p>
        )}
      </div>

      {file && (
        <div className="rounded-xl border border-stone-200 p-3">
          <p className="text-sm">
            <span className="font-semibold break-all text-stone-900">{file.name}</span>{' '}
            <span className="text-stone-500">
              · {pluralize(file.rows, 'row')} · {(file.size / 1024).toFixed(1)} KB
            </span>
          </p>
          <div className="scroll-x mt-2">
            <table className="w-full font-mono text-xs">
              <caption className="sr-only">First rows of {file.name}</caption>
              <thead>
                <tr className="text-left text-stone-500">
                  {file.header.map((name) => (
                    <th key={name} scope="col" className="py-1 pr-3 font-semibold">
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-stone-700">
                {file.preview.map((cells, rowIndex) => (
                  <tr key={rowIndex} className="border-t border-stone-100">
                    {cells.map((cell, cellIndex) => (
                      <td key={cellIndex} className="max-w-40 truncate py-1 pr-3">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn btn-primary mt-3 w-full sm:w-auto" onClick={upload} disabled={isPending}>
            <FiUploadCloud aria-hidden="true" /> {isPending ? 'Importing…' : 'Import into the store'}
          </button>
        </div>
      )}

      {uploadError && <ErrorMessage title="Import failed" message={uploadError.message} />}

      {result && (
        <div role="status" className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <FiCheckCircle className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-semibold">RapidMiner model imported</p>
            <p className="mt-0.5">
              {pluralize(result.imported, 'pair')} stored for {pluralize(result.products, 'product')}
              {result.skipped > 0 && <>, {pluralize(result.skipped, 'row')} skipped (unknown ids or zero scores)</>}.
            </p>
            <p className="mt-0.5 truncate font-mono text-xs text-emerald-800">Batch {result.batchId}</p>
          </div>
        </div>
      )}
    </div>
  )
}
