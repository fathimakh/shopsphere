/** Loading placeholder that mirrors the product page layout (gallery + purchase column). */
export default function ProductDetailSkeleton() {
  return (
    <div role="status" aria-live="polite" className="container-page py-5 sm:py-8">
      <span className="sr-only">Loading product…</span>
      <div aria-hidden="true">
        <div className="skeleton h-4 w-56 max-w-full" />
        <div className="mt-5 grid gap-6 lg:grid-cols-2 lg:gap-12">
          <div className="space-y-3">
            <div className="skeleton aspect-square w-full rounded-2xl" />
            <div className="flex gap-2">
              {[0, 1, 2, 3].map((thumb) => (
                <div key={thumb} className="skeleton size-16 rounded-xl sm:size-20" />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="skeleton h-4 w-24" />
            <div className="skeleton h-8 w-11/12" />
            <div className="skeleton h-8 w-2/3" />
            <div className="skeleton h-4 w-40" />
            <div className="skeleton h-10 w-48" />
            <div className="skeleton h-4 w-28" />
            <div className="skeleton h-11 w-36 rounded-xl" />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="skeleton h-12 rounded-xl" />
              <div className="skeleton h-12 rounded-xl" />
            </div>
            <div className="skeleton h-28 rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  )
}
