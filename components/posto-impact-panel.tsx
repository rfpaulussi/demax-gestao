import type { ImpactoResult, PostoImpact } from '@/app/(admin)/efetivo/impacto'

function statusEfetivo(apos: number, previsto: number) {
  if (apos > previsto)  return { cls: 'bg-red-50 border-red-200 text-red-700',     icone: '🔴', label: 'excesso'  }
  if (apos === previsto) return { cls: 'bg-green-50 border-green-200 text-green-700', icone: '🟢', label: 'ok'      }
  return                       { cls: 'bg-amber-50 border-amber-200 text-amber-700', icone: '🟡', label: 'déficit' }
}

function statusInsalub(apos: number, cota: number) {
  if (apos > cota)  return { cls: 'text-red-600',   icone: '🔴' }
  if (apos === cota) return { cls: 'text-green-700', icone: '🟢' }
  return                    { cls: 'text-slate-500', icone: '⚪' }
}

function sinal(n: number): string {
  if (n > 0) return `+${n}`
  if (n < 0) return String(n)
  return ''
}

function PostoImpactRow({ posto, rotulo }: { posto: PostoImpact; rotulo: string }) {
  const ef = statusEfetivo(posto.efetivo_apos, posto.efetivo_previsto)
  const ins = statusInsalub(posto.insalubridade_apos, posto.cota_insalubridade)
  const efDelta = posto.efetivo_apos - posto.efetivo_atual
  const inDelta = posto.insalubridade_apos - posto.insalubridade_atual

  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs">
      <div className="mb-1.5 flex items-center gap-1.5 flex-wrap">
        <span className="font-semibold uppercase tracking-widest text-gray-400">{rotulo}</span>
        <span className="font-medium text-gray-800 truncate">{posto.nome}</span>
        {posto.secretaria && (
          <span className="text-gray-400">· {posto.secretaria}</span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {/* Efetivo */}
        <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-semibold ${ef.cls}`}>
          {ef.icone} Efetivo:&nbsp;
          <span className="font-normal text-gray-600">{posto.efetivo_atual}</span>
          {efDelta !== 0 && (
            <span className={efDelta > 0 ? 'text-green-600' : 'text-red-600'}>
              {sinal(efDelta)}
            </span>
          )}
          &nbsp;→&nbsp;<strong>{posto.efetivo_apos}</strong>/{posto.efetivo_previsto}
        </span>

        {/* Insalubridade — só exibe se o posto tem cota */}
        {posto.cota_insalubridade > 0 && (
          <span className={`inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-0.5 ${ins.cls}`}>
            {ins.icone} Insalub:&nbsp;
            <span className="font-normal text-gray-600">{posto.insalubridade_atual}</span>
            {inDelta !== 0 && (
              <span className={inDelta > 0 ? 'text-green-600' : 'text-slate-500'}>
                {sinal(inDelta)}
              </span>
            )}
            &nbsp;→&nbsp;<strong>{posto.insalubridade_apos}</strong>/{posto.cota_insalubridade}
          </span>
        )}
      </div>
    </div>
  )
}

export function PostoImpactPanel({
  impacto,
  loading = false,
}: {
  impacto: ImpactoResult | null
  loading?: boolean
}) {
  if (loading) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 px-3 py-2 text-xs text-gray-400 animate-pulse">
        Calculando impacto nos postos...
      </div>
    )
  }
  if (!impacto) return null

  const temDestino = !!impacto.destino

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
        Impacto nos postos
      </p>
      <PostoImpactRow
        posto={impacto.origem}
        rotulo={temDestino ? 'Saída' : 'Posto'}
      />
      {impacto.destino && (
        <PostoImpactRow posto={impacto.destino} rotulo="Entrada" />
      )}
    </div>
  )
}
