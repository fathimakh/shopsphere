const ALIGN = { left: 'xl:text-left', right: 'xl:text-right', center: 'xl:text-center' }

/**
 * Responsive data table used by the admin lists. One semantic <table> that becomes a stack of
 * cards below the xl breakpoint (1280px; tablets and small laptops get cards): each cell then shows its column header as an inline label, the
 * `primary` column becomes the card title and the actions move to a footer row.
 *
 * columns: [{ id, header, cell: (row) => node, primary?, align?: 'left'|'right'|'center', hideOnMobile?, className? }]
 */
export default function AdminTable({ caption, columns, rows, getRowKey, renderActions, busy = false, isCurrentRow }) {
  return (
    <div
      aria-busy={busy}
      // relative: the scroll container must also clip absolutely positioned descendants (sr-only labels).
      className={`relative transition-opacity xl:overflow-x-auto xl:rounded-2xl xl:border xl:border-stone-200/80 xl:bg-white xl:shadow-[0_1px_2px_rgb(28_25_23/0.04)] ${
        busy ? 'opacity-60' : ''
      }`}
    >
      <table className="block w-full text-sm xl:table">
        <caption className="sr-only">{caption}</caption>
        <thead className="hidden bg-stone-50/80 xl:table-header-group">
          <tr className="border-b border-stone-200 text-xs font-semibold tracking-wide text-stone-500 uppercase">
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                className={`px-4 py-3 whitespace-nowrap ${ALIGN[column.align] ?? ALIGN.left}`}
              >
                {column.header}
              </th>
            ))}
            {renderActions && (
              <th scope="col" className="px-4 py-3 text-right">
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody className="block space-y-3 xl:table-row-group xl:space-y-0 xl:divide-y xl:divide-stone-100">
          {rows.map((row) => (
            <tr
              key={getRowKey(row)}
              className={`card block p-4 xl:table-row xl:rounded-none xl:border-0 xl:p-0 xl:shadow-none ${
                isCurrentRow?.(row) ? 'ring-2 ring-brand-200 xl:bg-brand-50/40 xl:ring-0' : 'xl:bg-transparent'
              }`}
            >
              {columns.map((column) =>
                column.primary ? (
                  <td key={column.id} className={`block pb-2 xl:table-cell xl:px-4 xl:py-3 xl:align-middle ${column.className ?? ''}`}>
                    {column.cell(row)}
                  </td>
                ) : (
                  <td
                    key={column.id}
                    className={`items-center justify-between gap-4 border-t border-stone-100 py-2 xl:table-cell xl:border-0 xl:px-4 xl:py-3 xl:align-middle ${
                      column.hideOnMobile ? 'hidden' : 'flex'
                    } ${ALIGN[column.align] ?? ALIGN.left} ${column.className ?? ''}`}
                  >
                    <span className="shrink-0 text-xs font-semibold text-stone-500 xl:hidden">{column.header}</span>
                    <div className={`min-w-0 text-right ${ALIGN[column.align] ?? ALIGN.left}`}>{column.cell(row)}</div>
                  </td>
                ),
              )}
              {renderActions && (
                <td className="block border-t border-stone-100 pt-3 xl:table-cell xl:border-0 xl:px-4 xl:py-3 xl:align-middle">
                  <div className="flex flex-wrap items-center justify-end gap-2 xl:flex-nowrap">{renderActions(row)}</div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
