// app/(admin)/relatorios/absenteismo/loading.tsx
export default function Loading() {
  return (
    <div className="space-y-5 animate-pulse" aria-busy="true" aria-label="Carregando absenteísmo">
      <div className="h-5 w-40 rounded bg-gray-200" />
      <div className="h-20 rounded-xl bg-gray-100" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="h-24 rounded-xl bg-gray-100" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-72 rounded-xl bg-gray-100 lg:col-span-2" />
        <div className="h-72 rounded-xl bg-gray-100" />
      </div>
    </div>
  )
}
