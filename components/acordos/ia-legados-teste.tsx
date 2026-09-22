'use client'

import { useState } from 'react'
import { classificarAcordoAntigo } from '@/app/(admin)/acordos/ia-actions'
import { CASOS_LEGADO, conferirLegado, type CasoLegado, type ConferenciaLegado } from '@/lib/acordos/ia/casos-legado'

interface LinhaTeste {
  caso: CasoLegado
  estado: 'pendente' | 'rodando' | 'feito' | 'erro'
  ok?: boolean
  campos?: ConferenciaLegado[]
  erro?: string
  custo?: number
}

const usd = (v: number) => `US$ ${v.toFixed(4)}`

/**
 * Roda os 19 casos reais fixos (`CASOS_LEGADO`) contra o classificador ao vivo e compara com o
 * resultado esperado. Serve para travar o prompt: sempre que ele mudar, rodar de novo aqui antes
 * de reclassificar os 56 acordos de verdade.
 */
export function IaLegadosTeste() {
  const [linhas, setLinhas] = useState<LinhaTeste[]>([])
  const [rodando, setRodando] = useState(false)

  async function rodar() {
    setRodando(true)
    const inicial: LinhaTeste[] = CASOS_LEGADO.map(caso => ({ caso, estado: 'pendente' }))
    setLinhas(inicial)
    for (let i = 0; i < CASOS_LEGADO.length; i++) {
      setLinhas(prev => prev.map((l, j) => (j === i ? { ...l, estado: 'rodando' } : l)))
      const r = await classificarAcordoAntigo(CASOS_LEGADO[i].id)
      setLinhas(prev => prev.map((l, j) => {
        if (j !== i) return l
        if (!r.ok) return { ...l, estado: 'erro', erro: r.erro }
        const c = conferirLegado(CASOS_LEGADO[i], r.dados.classificacao)
        return { ...l, estado: 'feito', ok: c.ok, campos: c.campos, custo: r.dados.uso.custoUsd }
      }))
      if (!r.ok && /Muitos pedidos|configurada/.test(r.erro)) break
    }
    setRodando(false)
  }

  const feitos = linhas.filter(l => l.estado === 'feito')
  const acertos = feitos.filter(l => l.ok).length
  const custoTotal = feitos.reduce((s, l) => s + (l.custo ?? 0), 0)

  return (
    <section className="space-y-3 rounded-2xl border border-gray-200 bg-slate-50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-slate-900">4. Teste de regressão ({CASOS_LEGADO.length} acordos reais)</h2>
        <button
          type="button"
          onClick={rodar}
          disabled={rodando}
          className="flex h-9 items-center rounded-lg bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-40"
        >
          {rodando ? 'Rodando…' : 'Rodar teste de regressão'}
        </button>
      </div>
      <p className="text-xs text-gray-500">
        19 acordos reais com o resultado esperado definido por leitura humana do texto (não pela IA). Cobre T1–T5, textos com campos em branco,
        textos ambíguos e o caso já visto classificado errado em produção. Rode de novo sempre que eu mudar o prompt de classificação, antes de
        reclassificar os 56 acordos de verdade.
      </p>

      {feitos.length > 0 && (
        <p className="text-sm font-semibold text-slate-800">
          {acertos} de {feitos.length} certos ({Math.round((acertos / feitos.length) * 100)}%) · custo {usd(custoTotal)}
        </p>
      )}

      {linhas.length > 0 && (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
          {linhas.map(l => (
            <li key={l.caso.id} className="p-3">
              <div className="flex items-start gap-2">
                <span className={`mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
                  l.estado === 'feito' ? (l.ok ? 'bg-green-500' : 'bg-red-500')
                  : l.estado === 'erro' ? 'bg-amber-500'
                  : l.estado === 'rodando' ? 'animate-pulse bg-blue-500' : 'bg-gray-300'
                }`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">{l.caso.titulo}</p>
                  {l.caso.nota && <p className="text-[11px] text-gray-400">{l.caso.nota}</p>}
                  {l.estado === 'erro' && <p className="mt-1 text-xs text-amber-700">{l.erro}</p>}
                  {l.estado === 'feito' && !l.ok && (
                    <ul className="mt-1 space-y-0.5 text-xs">
                      {l.campos!.filter(c => !c.ok).map(c => (
                        <li key={c.campo} className="text-red-700">{c.campo}: esperado <b>{c.esperado}</b>, veio <b>{c.obtido}</b></li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
