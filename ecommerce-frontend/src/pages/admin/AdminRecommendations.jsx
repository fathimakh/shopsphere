import { useState } from 'react'
import { FiCheckCircle, FiCloud, FiDatabase, FiExternalLink, FiLayers, FiTrash2, FiXCircle } from 'react-icons/fi'
import api from '../../api/axiosInstance'
import AdminPageHeader from '../../components/admin/AdminPageHeader'
import AdminPanel from '../../components/admin/AdminPanel'
import BarList from '../../components/admin/BarList'
import CsvDownloadButton from '../../components/admin/CsvDownloadButton'
import CsvImportPanel from '../../components/admin/CsvImportPanel'
import DialogError from '../../components/admin/DialogError'
import RecommendationPreview from '../../components/admin/RecommendationPreview'
import RefreshButton from '../../components/admin/RefreshButton'
import SourceBadge from '../../components/admin/SourceBadge'
import ConfirmDialog from '../../components/ConfirmDialog'
import ErrorMessage from '../../components/ErrorMessage'
import useAdminMutation from '../../hooks/useAdminMutation'
import useAdminResource from '../../hooks/useAdminResource'
import useDocumentTitle from '../../hooks/useDocumentTitle'
import { RECOMMENDATION_SOURCES } from '../../utils/constants'
import { formatDateTime, formatCompact } from '../../utils/format'

// The RapidMiner guide lives in the repo; set VITE_REPO_URL (https://github.com/<user>/<repo>) to link it.
const GUIDE_PATH = 'ecommerce-backend/rapidminer/README.md'
const REPO_URL = import.meta.env.VITE_REPO_URL?.replace(/\/+$/, '')
const GUIDE_URL = REPO_URL ? `${REPO_URL}/blob/main/${GUIDE_PATH}` : null

const EXPORTS = [
  {
    path: '/analytics/export/rating-matrix.csv',
    filename: 'rating-matrix.csv',
    description: 'Products × users matrix — the input of the RapidMiner process.',
  },
  {
    path: '/analytics/export/interactions.csv',
    filename: 'interactions.csv',
    description: 'One row per view, cart add, review and purchase.',
  },
  {
    path: '/analytics/export/products.csv',
    filename: 'products.csv',
    description: 'Catalogue lookup: id, name, category, brand, price, rating.',
  },
]

/** Implicit-feedback weights used for the rating matrix (contract §4). */
const EVENTS = [
  { key: 'view', label: 'Views', weight: 1, tone: 'sky' },
  { key: 'cart_add', label: 'Cart adds', weight: 3, tone: 'accent' },
  { key: 'review', label: 'Reviews', weight: 4, tone: 'violet' },
  { key: 'purchase', label: 'Purchases', weight: 5, tone: 'brand' },
]

const STEPS = [
  { title: 'Export', body: 'Download rating-matrix.csv: every product’s implicit-feedback score from every shopper.' },
  {
    title: 'Score in RapidMiner',
    body: 'Run product_similarity.rmp (rapidminer/processes) in Altair AI Studio: cosine item-to-item similarity with Cross Distances, saved as product_similarity.csv.',
  },
  { title: 'Import', body: 'Upload the scored product_similarity.csv below. It replaces the previous model instantly.' },
  {
    title: 'Serve',
    body: 'Product pages and “Recommended for you” now use the RapidMiner model; the built-in model is the automatic fallback.',
  },
]

function EngineTile({ icon: Icon, title, active, children }) {
  return (
    <div className={`rounded-xl border p-4 ${active ? 'border-brand-300 bg-brand-50/50' : 'border-stone-200 bg-white'}`}>
      <p className="flex items-center gap-2 text-sm font-semibold text-stone-900">
        <Icon className="size-4 text-brand-700" aria-hidden="true" />
        {title}
        {active && <span className="badge ml-auto bg-brand-700 text-white">In use</span>}
      </p>
      <div className="mt-2 text-sm text-stone-600">{children}</div>
    </div>
  )
}

function StatusSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-4">
      <div className="skeleton h-48 rounded-2xl" />
      <div className="skeleton h-40 rounded-2xl" />
    </div>
  )
}

/**
 * RapidMiner control panel (GET /analytics/status): which engine serves recommendations, the data
 * export → RapidMiner → import loop, interaction volumes and a live preview of the output.
 */
export default function AdminRecommendations() {
  useDocumentTitle('Recommendations')
  const engine = useAdminResource('/analytics/status')
  const [confirmClear, setConfirmClear] = useState(false)
  const { run, isPending, error, resetError } = useAdminMutation()

  const closeClear = () => {
    setConfirmClear(false)
    resetError()
  }

  const clearModel = async () => {
    const { ok } = await run('clear', () => api.delete('/analytics/import'), {
      successMessage: (data) => data.message ?? 'Imported model removed',
    })
    if (!ok) return
    closeClear()
    engine.reload()
  }

  const status = engine.data
  const activeSource = status?.activeSource
  const lastImport = status?.rapidminer?.lastImport
  const builtin = status?.builtin ?? {}
  const byEvent = status?.interactions?.byEvent ?? {}
  const eventItems = EVENTS.map((event) => ({
    key: event.key,
    label: `${event.label} (weight ${event.weight})`,
    value: byEvent[event.key] ?? 0,
    tone: event.tone,
  }))

  return (
    <>
      <AdminPageHeader
        title="Recommendations"
        description="RapidMiner-powered “You may also like” and personalised picks."
        actions={<RefreshButton onClick={engine.reload} loading={engine.status === 'loading'} />}
      />

      <div className="space-y-4">
        {engine.status === 'failed' && (
          <ErrorMessage title="Couldn't load the engine status" message={engine.error?.message} onRetry={engine.reload} />
        )}

        {!status && engine.status !== 'failed' && <StatusSkeleton />}

        {status && (
          <AdminPanel title="Engine status" description="Sources are tried in this order; the first one available wins.">
            <div className="mb-4 flex flex-col gap-2 rounded-xl bg-stone-50 p-4 sm:flex-row sm:items-center">
              <p className="text-sm font-semibold text-stone-700">Active source</p>
              <SourceBadge source={activeSource} className="w-fit px-3 py-1 text-sm" />
              <p className="text-sm text-stone-600 sm:ml-2">{RECOMMENDATION_SOURCES[activeSource]?.description}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <EngineTile icon={FiCloud} title="1 · AI Hub (live)" active={activeSource === 'rapidminer-live'}>
                {status.rapidminer?.liveConfigured ? (
                  <p className="flex items-center gap-1.5 font-medium text-emerald-700">
                    <FiCheckCircle aria-hidden="true" /> Scoring URL configured
                  </p>
                ) : (
                  <p className="flex items-center gap-1.5">
                    <FiXCircle className="text-stone-400" aria-hidden="true" /> Not configured
                  </p>
                )}
                <p className="mt-1 text-xs text-stone-500">Set RAPIDMINER_SCORING_URL on the API to score live.</p>
              </EngineTile>
              <EngineTile icon={FiLayers} title="2 · Imported model" active={activeSource === 'rapidminer'}>
                {lastImport ? (
                  <>
                    <p>
                      <span className="font-semibold text-stone-900">{formatCompact(lastImport.pairs)}</span> pairs
                      {lastImport.products !== undefined && <> · {formatCompact(lastImport.products)} products</>}
                    </p>
                    <p className="mt-1 text-xs text-stone-500">Imported {formatDateTime(lastImport.importedAt)}</p>
                    <p className="truncate font-mono text-xs text-stone-500" title={lastImport.batchId}>
                      Batch {lastImport.batchId}
                    </p>
                  </>
                ) : (
                  <p>No RapidMiner output imported yet.</p>
                )}
              </EngineTile>
              <EngineTile icon={FiDatabase} title="3 · Built-in CF" active={activeSource === 'builtin-cf'}>
                <p>
                  <span className="font-semibold text-stone-900">{formatCompact(builtin.pairs)}</span> pairs ·{' '}
                  {formatCompact(builtin.products)} products
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  {builtin.computedAt ? `Computed ${formatDateTime(builtin.computedAt)}` : 'Computed on first request'}
                </p>
              </EngineTile>
            </div>
            <p className="mt-3 text-xs text-stone-500">
              When none of these has data, shoppers get trending products (sales, interest and ratings).
            </p>
          </AdminPanel>
        )}

        <AdminPanel title="How the RapidMiner loop works">
          <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-3 rounded-xl border border-stone-200 p-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-700 text-sm font-bold text-white">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-stone-900">{step.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed break-words text-stone-600">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-sm text-stone-600">
            Full walkthrough:{' '}
            {GUIDE_URL ? (
              <a href={GUIDE_URL} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1">
                rapidminer/README.md <FiExternalLink aria-hidden="true" />
              </a>
            ) : (
              <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs break-all">{GUIDE_PATH}</code>
            )}{' '}
            in the GitHub repository.
          </p>
        </AdminPanel>

        <div className="grid gap-4 xl:grid-cols-2">
          <AdminPanel title="Step 1 · Export training data" description="Admin-only CSV exports, generated from live data.">
            <div className="space-y-2">
              {EXPORTS.map((item) => (
                <CsvDownloadButton key={item.path} path={item.path} filename={item.filename} label={item.filename} description={item.description} />
              ))}
            </div>
          </AdminPanel>

          <AdminPanel
            title="Step 3 · Import RapidMiner output"
            description="Upload the similarity table produced by the process."
            action={
              lastImport && (
                <button type="button" className="btn btn-sm min-h-10 text-red-700 hover:bg-red-50" onClick={() => setConfirmClear(true)}>
                  <FiTrash2 aria-hidden="true" /> Clear model
                </button>
              )
            }
          >
            <CsvImportPanel onImported={engine.reload} />
          </AdminPanel>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <AdminPanel
            title="Interaction signals"
            description={status ? `${formatCompact(status.interactions?.total)} events feed the rating matrix.` : undefined}
          >
            {status ? (
              <BarList items={eventItems} label="Interactions by event" emptyMessage="No shopper interactions recorded yet." />
            ) : (
              <div className="skeleton h-40" aria-hidden="true" />
            )}
          </AdminPanel>
          <AdminPanel title="Preview recommendations" description="See exactly what a product page will show.">
            <RecommendationPreview />
          </AdminPanel>
        </div>
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="Clear the imported RapidMiner model?"
        message="Recommendations fall back to the built-in collaborative-filtering model until you import a new file."
        confirmLabel="Clear model"
        busy={isPending}
        onConfirm={clearModel}
        onCancel={closeClear}
      >
        <DialogError message={error?.message} />
      </ConfirmDialog>
    </>
  )
}
