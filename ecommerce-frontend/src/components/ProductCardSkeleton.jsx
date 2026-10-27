/** Placeholder with the same footprint as ProductCard, shown while products load. */
export default function ProductCardSkeleton({ className = '' }) {
  return (
    <div className={`card flex h-full flex-col overflow-hidden ${className}`} aria-hidden="true">
      <div className="aspect-square bg-white p-4">
        <div className="skeleton size-full rounded-xl" />
      </div>
      <div className="flex flex-1 flex-col gap-2.5 border-t border-stone-100 p-3 sm:p-4">
        <div className="skeleton h-3 w-1/3" />
        <div className="skeleton h-4 w-11/12" />
        <div className="skeleton h-4 w-2/3" />
        <div className="skeleton h-3 w-1/2" />
        <div className="skeleton h-5 w-2/5" />
        <div className="skeleton mt-auto h-10 w-full rounded-xl" />
      </div>
    </div>
  )
}
