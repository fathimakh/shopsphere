import { useState } from 'react'
import toast from 'react-hot-toast'
import { FiDownload } from 'react-icons/fi'
import api, { getErrorMessage } from '../../api/axiosInstance'

/** `attachment; filename="rating-matrix.csv"` → "rating-matrix.csv" */
function filenameFrom(disposition) {
  return /filename="?([^";]+)"?/i.exec(disposition ?? '')?.[1]
}

/** With responseType 'blob' the JSON error body arrives as a Blob; decode it so the real message shows. */
async function downloadErrorMessage(error) {
  const data = error?.response?.data
  if (data instanceof Blob) {
    try {
      error.response.data = JSON.parse(await data.text())
    } catch {
      // Not JSON: fall back to the status-based message.
    }
  }
  return getErrorMessage(error)
}

/**
 * Downloads an admin-only CSV export. Fetched through the API instance (so the JWT is sent) as a
 * Blob, then saved via a temporary object URL — a plain <a href> could not carry the token.
 */
export default function CsvDownloadButton({ path, filename, label, description }) {
  const [busy, setBusy] = useState(false)

  const download = async () => {
    setBusy(true)
    try {
      const response = await api.get(path, { responseType: 'blob' })
      const name = filenameFrom(response.headers['content-disposition']) ?? filename
      const url = URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.download = name
      document.body.append(link)
      link.click()
      link.remove()
      // Give the browser a moment to start the download before releasing the blob.
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast.success(`Downloaded ${name}`)
    } catch (error) {
      toast.error(await downloadErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={busy}
      className="flex w-full items-center gap-3 rounded-xl border border-stone-200 bg-white p-3 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/40 disabled:cursor-wait disabled:opacity-70"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
        <FiDownload className={`size-5 ${busy ? 'animate-bounce' : ''}`} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-mono text-sm font-semibold text-stone-900">{label}</span>
        {description && <span className="block text-xs text-stone-500">{description}</span>}
      </span>
      <span className="shrink-0 text-xs font-semibold text-brand-700">{busy ? 'Preparing…' : 'Download'}</span>
    </button>
  )
}
