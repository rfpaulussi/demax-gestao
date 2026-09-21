'use client'

import { useState } from 'react'
import { interpretarPedidoLab, type RespostaInterpretacao } from '@/app/(admin)/acordos/ia-actions'
import { CASOS, conferirCaso, type CasoTeste, type ConferenciaCampo } from '@/lib/acordos/ia/casos'
import { SITUACOES } from '@/lib/acordos/situacoes'
import { fmtHM } from '@/lib/acordos/resumo'
import { LABEL_CLS } from './passo'

interface Props {
  configurada: boolean
  postos: { id: string; nome: string }[]
}

interface LinhaCaso {
  caso: CasoTeste
  estado: 'pendente' | 'rodando' | 'feito' | 'erro'
  ok?: boolean
  campos?: ConferenciaCampo[]
  perguntas?: string[]
  erro?: string
  custo?: number
}

const usd = (v: number) => `US$ ${v.toFixed(4)}`

function Caixa({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className={`${LABEL_CLS} mb-2`}>{titulo}</p>
      {children}
    </div>
  )
}

export function IaLab({ configurada, postos }: Props) {
  const [texto, setTexto] = useState('')
  const [rodando, setRodando] = useState(false)
  const [erro, setErro] = useState('')
  const [dados, setDados] = useState<RespostaInterpretacao | null>(null)

  const [linhas, setLinhas] = useState<LinhaCaso[]>([])
  const [rodandoTodos, setRodandoTodos] = useState(false)

  const nomePosto = (id: string | null) => postos.find(p => p.id === id)?.nome ?? null

  async function interpretar() {
    setRodando(true)
    setErro('')
    setDados(null)
    const r = await interpretarPedidoLab(texto)
    if (r.ok) setDados(r.dados)
    else setErro(r.erro)
    setRodando(false)
  }

  async function rodarTodos() {
    setRodandoTodos(true)
    const inicial: LinhaCaso[] = CASOS.map(caso => ({ caso, estado: 'pendente' }))
    setLinhas(inicial)
    for (let i = 0; i < CASOS.length; i++) {
      setLinhas(prev => prev.map((l, j) => (j === i ? { ...l, estado: 'rodando' } : l)))
      const r = await interpretarPedidoLab(CASOS[i].pedido)
      setLinhas(prev => prev.map((l, j) => {
        if (j !== i) return l
        if (!r.ok) return { ...l, estado: 'erro', erro: r.erro }
        const c = conferirCaso(CASOS[i], r.dados.extracao)
        return { ...l, estado: 'feito', ok: c.ok, campos: c.campos, perguntas: r.dados.extracao.perguntas, custo: r.dados.uso.custoUsd }
      }))
    }
    setRodandoTodos(false)
  }

  const feitos = linhas.filter(l => l.estado === 'feito')
  const acertos = feitos.filter(l => l.ok).length
  const custoTotal = feitos.reduce((s, l) => s + (l.custo ?? 0), 0)

  return (
    <div className="space-y-6">
      {!configurada && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-bold">A IA ainda não está configurada neste ambiente.</p>
          <p className="mt-1">
            Falta a variável <code className="rounded bg-amber-100 px-1">ANTHROPIC_API_KEY</code> (no <code className="rounded bg-amber-100 px-1">.env.local</code> e no
            Vercel, ambiente Preview). Sem ela, os testes abaixo devolvem erro.
          </p>
        </div>
      )}

      <section className="space-y-3 rounded-2xl border border-gray-200 bg-slate-50 p-5">
        <h2 className="text-sm font-bold text-slate-900">1. Testar um pedido</h2>
        <label htmlFor="ia-pedido" className={LABEL_CLS}>Pedido em texto livre</label>
        <textarea
          id="ia-pedido"
          value={texto}
          onChange={e => setTexto(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="ex: Liberamos o pessoal do Casarão às 12h no dia 14/09 por causa da chuva. Repõem em 6 dias."
          className="w-full rounded-lg border border-gray-200 bg-white p-3 text-sm text-slate-800 outline-none focus:border-slate-400"
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={interpretar}
            disabled={rodando || texto.trim().length < 8}
            className="flex h-9 items-center rounded-lg bg-slate-900 px-5 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-40"
          >
            {rodando ? 'Interpretando…' : 'Interpretar (dry-run)'}
          </button>
          <span className="text-xs text-gray-400">Nomes de funcionários, CPF e contatos são trocados por códigos antes de ir à IA.</span>
        </div>
        {erro && <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

        {dados && (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Caixa titulo="Texto enviado à IA">
              <p className="whitespace-pre-wrap text-sm text-slate-700">{dados.textoEnviado}</p>
            </Caixa>

            <Caixa titulo="Como ficaria no formulário">
              <dl className="space-y-1 text-sm">
                <div className="flex gap-2">
                  <dt className="w-28 shrink-0 text-slate-500">Situação</dt>
                  <dd className="font-semibold text-slate-900">
                    {dados.resultado.template ? `${dados.resultado.template} — ${SITUACOES[dados.resultado.template].titulo}` : 'não identificada'}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-28 shrink-0 text-slate-500">Posto</dt>
                  <dd className="text-slate-900">{nomePosto(dados.resultado.postoId) ?? '—'}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-28 shrink-0 text-slate-500">Funcionários</dt>
                  <dd className="text-slate-900">
                    {dados.resultado.funcionarioIds.length ? `${dados.resultado.funcionarioIds.length} citado(s)` : 'o posto todo'}
                  </dd>
                </div>
                {dados.resultado.quantidadeDias !== null && (
                  <div className="flex gap-2">
                    <dt className="w-28 shrink-0 text-slate-500">Nº de dias</dt>
                    <dd className="text-slate-900">{dados.resultado.quantidadeDias}</dd>
                  </div>
                )}
                {Object.entries(dados.resultado.form).map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <dt className="w-28 shrink-0 text-slate-500">{k}</dt>
                    <dd className="break-all text-slate-900">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd>
                  </div>
                ))}
              </dl>
            </Caixa>

            <Caixa titulo="O que a IA perguntaria">
              {dados.resultado.perguntas.length ? (
                <ul className="list-disc space-y-1 pl-5 text-sm text-slate-800">
                  {dados.resultado.perguntas.map(p => <li key={p}>{p}</li>)}
                </ul>
              ) : (
                <p className="text-sm text-green-700">Nada. O pedido tem tudo que o formulário exige.</p>
              )}
              {dados.resultado.avisos.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs font-medium text-amber-700">
                  {dados.resultado.avisos.map(a => <li key={a}>{a}</li>)}
                </ul>
              )}
            </Caixa>

            <div className="lg:col-span-2">
              <Caixa titulo="Validação com os turnos reais do posto">
                {dados.simulacao ? (
                  <div className="space-y-2 text-sm">
                    <p className="text-slate-700">
                      {dados.simulacao.funcionarios} funcionário(s) · {dados.simulacao.grupos} grupo(s) de compensação ·{' '}
                      <b>{fmtHM(dados.simulacao.horasTotalMin)}</b> a compensar
                      {dados.simulacao.minutosPorDia > 0 && <> · {dados.simulacao.minutosPorDia} min por dia</>}
                      {dados.simulacao.datasAjuste.length > 0 && <> em {dados.simulacao.datasAjuste.length} dia(s)</>}
                    </p>
                    {dados.simulacao.achados.filter(a => a.nivel === 'erro').map((a, i) => (
                      <p key={`e${i}`} className="rounded-lg border border-red-100 bg-red-50 px-3 py-1.5 text-red-700">✕ {a.mensagem}</p>
                    ))}
                    {dados.simulacao.achados.filter(a => a.nivel === 'aviso').map((a, i) => (
                      <p key={`a${i}`} className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-1.5 text-amber-800">⚠ {a.mensagem}</p>
                    ))}
                    {dados.simulacao.achados.length === 0 && (
                      <p className="rounded-lg border border-green-100 bg-green-50 px-3 py-1.5 text-green-700">✓ Sem erros nem avisos: o acordo passaria na validação.</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Sem simulação: falta identificar a situação e o posto.</p>
                )}
              </Caixa>
            </div>

            <Caixa titulo="Uso">
              <p className="text-sm text-slate-700">
                {dados.uso.modelo} · {dados.uso.tokensEntrada} tokens de entrada · {dados.uso.tokensSaida} de saída · <b>{usd(dados.uso.custoUsd)}</b>
              </p>
            </Caixa>

            <div className="lg:col-span-2">
              <Caixa titulo="Resposta crua da IA (JSON)">
                <pre className="max-h-72 overflow-auto rounded-lg bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-200">
                  {JSON.stringify(dados.extracao, null, 2)}
                </pre>
              </Caixa>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-gray-200 bg-slate-50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-900">2. Conjunto de casos ({CASOS.length})</h2>
          <button
            type="button"
            onClick={rodarTodos}
            disabled={rodandoTodos}
            className="flex h-9 items-center rounded-lg bg-slate-900 px-5 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-40"
          >
            {rodandoTodos ? 'Rodando…' : 'Rodar todos os casos'}
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Hoje são casos escritos por nós (sintéticos). A taxa de acerto só vale de verdade com pedidos reais de supervisores: envie 15 a 20 e eles entram aqui.
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
                    <p className="text-sm text-slate-800">{l.caso.pedido}</p>
                    <p className="text-[11px] text-gray-400">{l.caso.id} · {l.caso.origem}</p>
                    {l.estado === 'erro' && <p className="mt-1 text-xs text-amber-700">{l.erro}</p>}
                    {l.estado === 'feito' && !l.ok && (
                      <ul className="mt-1 space-y-0.5 text-xs">
                        {l.campos!.filter(c => !c.ok).map(c => (
                          <li key={c.campo} className="text-red-700">{c.campo}: esperado <b>{c.esperado}</b>, veio <b>{c.obtido}</b></li>
                        ))}
                      </ul>
                    )}
                    {l.estado === 'feito' && l.perguntas && l.perguntas.length > 0 && (
                      <p className="mt-1 text-xs text-slate-500">Perguntou: {l.perguntas.join(' · ')}</p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
