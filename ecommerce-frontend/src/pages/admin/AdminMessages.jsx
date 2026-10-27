import { useState } from 'react'
import toast from 'react-hot-toast'
import { FiCheckCircle, FiChevronDown, FiCornerUpLeft, FiEye, FiInbox, FiMail, FiTrash2 } from 'react-icons/fi'
import api from '../../api/axiosInstance'
import AdminPageHeader from '../../components/admin/AdminPageHeader'
import DialogError from '../../components/admin/DialogError'
import RefreshButton from '../../components/admin/RefreshButton'
import ConfirmDialog from '../../components/ConfirmDialog'
import EmptyState from '../../components/EmptyState'
import ErrorMessage from '../../components/ErrorMessage'
import Loader from '../../components/Loader'
import StatusBadge from '../../components/StatusBadge'
import useAdminMutation from '../../hooks/useAdminMutation'
import useAdminResource from '../../hooks/useAdminResource'
import useDocumentTitle from '../../hooks/useDocumentTitle'
import { CONTACT_STATUSES } from '../../utils/constants'
import { formatDateTime, pluralize } from '../../utils/format'

const STATUS_FILTERS = ['', ...CONTACT_STATUSES]

const STATUS_ACTIONS = {
  new: { label: 'Mark as new', icon: FiMail },
  read: { label: 'Mark as read', icon: FiEye },
  resolved: { label: 'Mark resolved', icon: FiCheckCircle },
}

function MessageItem({ message, expanded, onToggle, onSetStatus, onDelete, busyStatus }) {
  const panelId = `message-${message._id}`
  const isNew = message.status === 'new'
  const replySubject = encodeURIComponent(`Re: ${message.subject}`)

  return (
    <li className={`card overflow-hidden ${isNew ? 'border-l-4 border-l-accent-500' : ''}`}>
      <h3>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-stone-50 sm:items-center sm:px-5"
        >
          <span className="block min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className={`truncate text-sm text-stone-900 ${isNew ? 'font-bold' : 'font-semibold'}`}>
                {message.subject}
              </span>
              <StatusBadge status={message.status} />
            </span>
            <span className="mt-1 block truncate text-xs text-stone-500">
              {message.name} · {message.email} · {formatDateTime(message.createdAt)}
            </span>
          </span>
          <FiChevronDown
            className={`mt-0.5 size-5 shrink-0 text-stone-400 transition-transform sm:mt-0 ${expanded ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      </h3>

      {expanded && (
        <div id={panelId} className="border-t border-stone-100 px-4 pt-4 pb-4 sm:px-5">
          <p className="text-sm leading-relaxed break-words whitespace-pre-wrap text-stone-700">{message.message}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={`mailto:${message.email}?subject=${replySubject}`}
              className="btn btn-primary btn-sm min-h-10"
            >
              <FiCornerUpLeft aria-hidden="true" /> Reply by email
            </a>
            {CONTACT_STATUSES.filter((status) => status !== message.status).map((status) => {
              const { label, icon: Icon } = STATUS_ACTIONS[status]
              return (
                <button
                  key={status}
                  type="button"
                  className="btn btn-secondary btn-sm min-h-10"
                  onClick={() => onSetStatus(message, status)}
                  disabled={Boolean(busyStatus)}
                >
                  <Icon aria-hidden="true" /> {busyStatus === status ? 'Saving…' : label}
                </button>
              )
            })}
            <button
              type="button"
              className="btn btn-sm min-h-10 text-red-700 hover:bg-red-50 sm:ml-auto"
              onClick={() => onDelete(message)}
            >
              <FiTrash2 aria-hidden="true" /> Delete
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

/** Contact-form inbox: filter GET /contact by status, read messages, mark them read/resolved, delete. */
export default function AdminMessages() {
  useDocumentTitle('Customer messages')
  const [statusFilter, setStatusFilter] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const inbox = useAdminResource('/contact', { params: { status: statusFilter } })
  const { run, pendingKey, isPending, error, resetError } = useAdminMutation()
  const messages = inbox.data?.messages ?? []

  const setStatus = async (message, status) => {
    const { ok, data, error: statusError } = await run(`${message._id}:${status}`, () =>
      api.patch(`/contact/${message._id}`, { status }),
    )
    if (!ok) {
      toast.error(statusError.message)
      return
    }
    toast.success(`Marked "${message.subject}" as ${status}`)
    inbox.setData((current) => ({
      ...current,
      messages: current.messages.map((item) => (item._id === message._id ? { ...item, ...data.contactMessage } : item)),
    }))
  }

  const closeDelete = () => {
    setDeleteTarget(null)
    resetError()
  }

  const confirmDelete = async () => {
    const target = deleteTarget
    const { ok } = await run('delete', () => api.delete(`/contact/${target._id}`), {
      successMessage: 'Message deleted',
    })
    if (!ok) return
    inbox.setData((current) => ({ ...current, messages: current.messages.filter((item) => item._id !== target._id) }))
    closeDelete()
  }

  return (
    <>
      <AdminPageHeader
        title="Messages"
        description="Questions and feedback sent through the contact form."
        actions={<RefreshButton onClick={inbox.reload} loading={inbox.status === 'loading'} />}
      />

      <div className="scroll-x -mx-4 mb-4 px-4 sm:mx-0 sm:px-0">
        <div role="group" aria-label="Filter by status" className="flex gap-2 pb-1">
          {STATUS_FILTERS.map((value) => (
            <button
              key={value || 'all'}
              type="button"
              aria-pressed={statusFilter === value}
              onClick={() => setStatusFilter(value)}
              className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold capitalize transition-colors ${
                statusFilter === value
                  ? 'border-brand-700 bg-brand-700 text-white'
                  : 'border-stone-300 bg-white text-stone-700 hover:border-stone-400'
              }`}
            >
              {value || 'All'}
            </button>
          ))}
        </div>
      </div>

      {inbox.status === 'failed' ? (
        <ErrorMessage title="Couldn't load messages" message={inbox.error?.message} onRetry={inbox.reload} />
      ) : !inbox.data ? (
        <Loader label="Loading messages…" />
      ) : messages.length === 0 ? (
        <EmptyState
          icon={FiInbox}
          title={statusFilter ? `No ${statusFilter} messages` : 'Inbox zero'}
          message={statusFilter ? 'Try another status filter.' : 'Messages from the contact page will appear here.'}
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-stone-600" aria-live="polite">
            {pluralize(messages.length, 'message')}
          </p>
          <ul className={`space-y-3 transition-opacity ${inbox.status === 'loading' ? 'opacity-60' : ''}`} aria-busy={inbox.status === 'loading'}>
            {messages.map((message) => (
              <MessageItem
                key={message._id}
                message={message}
                expanded={expandedId === message._id}
                onToggle={() => setExpandedId((current) => (current === message._id ? null : message._id))}
                onSetStatus={setStatus}
                onDelete={setDeleteTarget}
                busyStatus={pendingKey?.startsWith(`${message._id}:`) ? pendingKey.split(':')[1] : null}
              />
            ))}
          </ul>
        </>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete this message?"
        message={deleteTarget && `"${deleteTarget.subject}" from ${deleteTarget.name} will be removed permanently.`}
        confirmLabel="Delete message"
        busy={isPending}
        onConfirm={confirmDelete}
        onCancel={closeDelete}
      >
        <DialogError message={error?.key === 'delete' ? error.message : null} />
      </ConfirmDialog>
    </>
  )
}
