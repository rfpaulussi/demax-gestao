'use client'

import { useState } from 'react'
import {
  classificarAcordoAntigo,
  listarAcordosLegados,
  type AcordoLegadoItem,
  type ResultadoLegado,
} from '@/app/(admin)/acordos/ia-actions'
import { SITUACOES } from '@/lib/acordos/situacoes'

interface Linha {
  item: AcordoLegadoItem
  estado: 'pendente' | 'rodando' | 'feito' | 'erro'
  dados?: ResultadoLegado
  erro?: string
}

const LOTE = 20
const usd = (v: number) => `US$ ${v.toFixed(4)}`
const dataBR = (iso: string) => iso.split('-').reverse().join('/')
const ROTULO_DIRECAO = { descanso: 'quem trabalhou descansa', reposicao: 'repõe com acréscimo', indefinida: 'direção indefinida' } as const

/** Seção "Acordos antigos": a IA lê o texto de cada um e classifica. Só leitura, nada é gravado. */
export function IaLegados() {
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [total, setTotal] = useState<number | null>(null)
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [rodando, setRodando] = useState(false)

  async function carregar() {
    setCarregando(true)
    setErro('')
    const r = await listarAcordosLegados()
    setCarregando(false)
    if (!r.ok) { setErro(r.erro); return }
    setTotal(r.total)
    setLinhas(r.itens.map(item => ({ item, estado: 'pendente' })))
  }

  async function classificar() {
    setRodando(true)
    const alvo = linhas.map((l, i) => ({ l, i })).filter(x => x.l.estado !== 'feito').slice(0, LOTE)
    for (const { l, i } of alvo) {
      setLinhas(prev => prev.map((x, j) => (j === i ? { ...x, estado: 'rodando' } : x)))
      const r = await classificarAcordoAntigo(l.item.id)
      setLinhas(prev => prev.map((x, j) => (j !== i ? x : r.ok ? { ...x, estado: 'feito', dados: r.dados } : { ...x, estado: 'erro', erro: r.erro })))
      if (!r.ok && /Muitos pedidos|configurada/.test(r.erro)) break
    }
    setRodando(false)
  }

  const feitos = linhas.filter(l => l.estado === 'feito' && l.dados)
  const invertidos = feitos.filter(l => l.dados!.invertido)
  const custo = feitos.reduce((s, l) => s + (l.dados?.uso.custoUsd ?? 0), 0)
  const pendentes = linhas.filter(l => l.estado !== 'feito').length

  return (
    <section className="space-y-3 rounded-2xl border border-gray-200 bg-slate-50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-slate-900">3. Acordos antigos (só leitura)</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={carregar}
            disabled={carregando || rodando}
            className="flex h-9 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            {carregando ? 'Carregando…' : 'Carregar acordos sem classificação'}
          </button>
          {linhas.length > 0 && (
            <button
              type="button"
              onClick={classificar}
              disabled={rodando || pendentes === 0}
              className="flex h-9 items-center rounded-lg bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-40"
            >
              {rodando ? 'Classificando…' : `Classificar ${Math.min(LOTE, pendentes)} acordos`}
            </button>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-500">
        A IA lê o texto de cada acordo emitido antes do novo fluxo e diz qual situação ele é e se manda repor ou descansar. Serve para achar acordos
        que podem ter saído com a direção trocada (o T1 antigo). <b>Nada é gravado</b>: a gravação da classificação fica para a fase da aba Controle, depois da revisão do RH.
      </p>
      {erro && <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      {total !== null && linhas.length === 0 && !erro && <p className="text-sm text-slate-600">Nenhum acordo sem classificação.</p>}
      {total !== null && linhas.length > 0 && (
        <p className="text-xs text-gray-500">Mostrando os {linhas.length} mais recentes de {total} acordos sem classificação.</p>
      )}
      {feitos.length > 0 && (
        <p className="text-sm font-semibold text-slate-800">
          {feitos.length} classificados · <span className={invertidos.length ? 'text-red-700' : 'text-green-700'}>{invertidos.length} possivelmente invertidos</span> · custo {usd(custo)}
        </p>
      )}

      {linhas.length > 0 && (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
          {linhas.map(l => {
            const c = l.dados?.classificacao
            return (
              <li key={l.item.id} className="p-3">
                <div className="flex items-start gap-2">
                  <span className={`mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
                    l.estado === 'feito' ? (l.dados?.invertido ? 'bg-red-500' : 'bg-green-500')
                    : l.estado === 'erro' ? 'bg-amber-500'
                    : l.estado === 'rodando' ? 'animate-pulse bg-blue-500' : 'bg-gray-300'
                  }`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800">
                      {l.item.titulo} <span className="font-normal text-gray-400">· {dataBR(l.item.data_documento)} · {l.item.funcionarios} func.</span>
                    </p>
                    {l.estado === 'erro' && <p className="mt-0.5 text-xs text-amber-700">{l.erro}</p>}
                    {c && (
                      <div className="mt-0.5 space-y-0.5 text-xs text-slate-600">
                        <p>
                          <b>{c.situacao ? `${c.situacao} — ${SITUACOES[c.situacao].titulo}` : 'situação não identificada'}</b> · {ROTULO_DIRECAO[c.direcao_texto]}
                          {c.trabalhou_a_mais && ' · trabalharam a mais'}
                        </p>
                        {c.resumo && <p className="text-gray-500">{c.resumo}</p>}
                        {l.dados?.invertido && (
                          <p className="font-semibold text-red-700">
                            ⚠ Possivelmente invertido: o texto diz que trabalharam a mais, mas manda repor com acréscimo. Revisar.
                          </p>
                        )}
                        {c.tem_campos_em_branco && <p className="font-semibold text-amber-700">⚠ O texto ainda tem campos em branco entre colchetes.</p>}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
