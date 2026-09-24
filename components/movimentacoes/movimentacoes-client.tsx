'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { COR_TIPO } from '@/lib/termos/montar-termo'
import type { TermoResumo } from '@/lib/termos/listar-termos'
import { downloadTermoPDF } from '@/components/efetivo/movimentacao-pdf'
import { desfazerProtocolo, obterTermo, protocolarTermo, protocolarTermos } from '@/app/(admin)/movimentacoes/actions'

// Constantes duplicadas de lib/termos/listar-termos (arquivo server-only por importar supabase/server)
const DIAS_ATRASO = 3

const TIPO_LABEL: Record<string, string> = {
  transferencia: 'Transferência',
  mudanca_funcao: 'Mudança de função',
  promocao: 'Promoção',
  mudanca_horario: 'Mudança de horário',
  desligamento: 'Desligamento',
  afastamento: 'Afastamento',
  retorno_afastamento: 'Retorno de afastamento',
  alteracao_salario: 'Alteração salarial',
  outro: 'Outro',
}

const fmtData = (iso: string) => new Date(iso).toLocaleDateString('pt-BR')
const dias = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)

type Status = 'todos' | 'pendente' | 'atrasado' | 'protocolado'

function Card({ label, valor, cor }: { label: string; valor: number; cor: string }) {
  return (
    <div className={`rounded-xl border border-gray-100 border-t-4 bg-white p-3 shadow-sm ${cor}`}>
      <p className="text-2xl font-black tracking-tight text-gray-900">{valor}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</p>
    </div>
  )
}

export function MovimentacoesClient({
  termos, podeProtocolar, podeDesfazer, mostrarSupervisor,
}: {
  termos: TermoResumo[]
  podeProtocolar: boolean
  podeDesfazer: boolean
  mostrarSupervisor: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [status, setStatus] = useState<Status>('pendente')
  const [periodo, setPeriodo] = useState('90')
  const [tipo, setTipo] = useState('')
  const [supervisor, setSupervisor] = useState('')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [msg, setMsg] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)

  const supervisores = useMemo(
    () => Array.from(new Set(termos.map(t => t.supervisorNome).filter((x): x is string => !!x))).sort(),
    [termos],
  )

  const resumo = useMemo(() => {
    const pend = termos.filter(t => !t.protocoladoEm)
    const mes = new Date().toISOString().slice(0, 7)
    return {
      pendentes: pend.length,
      atrasados: pend.filter(t => dias(t.dataMov) > DIAS_ATRASO).length,
      protocMes: termos.filter(t => t.protocoladoEm?.slice(0, 7) === mes).length,
    }
  }, [termos])

  const filtrados = useMemo(() => {
    return termos.filter(t => {
      if (dias(t.dataMov) > Number(periodo)) return false
      if (tipo && t.tipo !== tipo) return false
      if (supervisor && t.supervisorNome !== supervisor) return false
      const atrasado = !t.protocoladoEm && dias(t.dataMov) > DIAS_ATRASO
      if (status === 'pendente' && t.protocoladoEm) return false
      if (status === 'atrasado' && !atrasado) return false
      if (status === 'protocolado' && !t.protocoladoEm) return false
      return true
    })
  }, [termos, periodo, tipo, supervisor, status])

  const toggle = (c: string) =>
    setSel(prev => {
      const n = new Set(prev)
      if (n.has(c)) n.delete(c)
      else n.add(c)
      return n
    })
  const todosMarcados = filtrados.length > 0 && filtrados.every(t => sel.has(t.chave))
  const toggleTodos = () => setSel(todosMarcados ? new Set() : new Set(filtrados.map(t => t.chave)))

  async function baixar(chave: string) {
    const termo = await obterTermo(chave)
    if (!termo) throw new Error('Termo não encontrado.')
    await downloadTermoPDF(termo)
  }

  async function baixarUm(chave: string) {
    setOcupado(chave); setMsg(null)
    try { await baixar(chave) } catch (e) { setMsg(e instanceof Error ? e.message : 'Erro ao gerar PDF.') }
    setOcupado(null)
  }

  async function baixarSelecionados() {
    setOcupado('lote'); setMsg(null)
    let falhas = 0
    for (const c of Array.from(sel)) {
      try { await baixar(c) } catch { falhas++ }
    }
    if (falhas) setMsg(`${falhas} PDF(s) não puderam ser gerados.`)
    setOcupado(null)
  }

  const protocolar = (chave: string) =>
    start(async () => {
      const r = await protocolarTermo(chave)
      setMsg(r.success ? null : r.error ?? 'Erro ao protocolar.')
      router.refresh()
    })

  const desfazer = (chave: string) =>
    start(async () => {
      const r = await desfazerProtocolo(chave)
      setMsg(r.success ? null : r.error ?? 'Erro ao desfazer.')
      router.refresh()
    })

  const protocolarLote = () =>
    start(async () => {
      const r = await protocolarTermos(Array.from(sel))
      setMsg(r.error ?? null)
      setSel(new Set())
      router.refresh()
    })

  const selectCls = 'rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-slate-700'
  const labelCls = 'block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card label="Pendentes" valor={resumo.pendentes} cor="border-t-amber-500" />
        <Card label="Atrasados (> 3 dias)" valor={resumo.atrasados} cor="border-t-red-500" />
        <Card label="Protocolados no mês" valor={resumo.protocMes} cor="border-t-green-500" />
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
        <div>
          <label className={labelCls}>Status</label>
          <select className={selectCls} value={status} onChange={e => setStatus(e.target.value as Status)}>
            <option value="pendente">Pendentes</option>
            <option value="atrasado">Atrasados</option>
            <option value="protocolado">Protocolados</option>
            <option value="todos">Todos</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Período</label>
          <select className={selectCls} value={periodo} onChange={e => setPeriodo(e.target.value)}>
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Tipo</label>
          <select className={selectCls} value={tipo} onChange={e => setTipo(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        {mostrarSupervisor && (
          <div>
            <label className={labelCls}>Supervisor</label>
            <select className={selectCls} value={supervisor} onChange={e => setSupervisor(e.target.value)}>
              <option value="">Todos</option>
              {supervisores.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
        {sel.size > 0 && (
          <div className="ml-auto flex flex-wrap gap-2">
            <button
              onClick={baixarSelecionados}
              disabled={ocupado !== null}
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-50"
            >
              {ocupado === 'lote' ? 'Gerando…' : `Baixar PDFs selecionados (${sel.size})`}
            </button>
            {podeProtocolar && (
              <button
                onClick={protocolarLote}
                disabled={pending}
                className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50"
              >
                Marcar selecionados como protocolados
              </button>
            )}
          </div>
        )}
      </div>

      {msg && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{msg}</p>}

      <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-widest text-slate-500">
              <th className="w-8 px-3 py-2">
                <input type="checkbox" checked={todosMarcados} onChange={toggleTodos} aria-label="Selecionar todos" />
              </th>
              <th className="px-3 py-2">Colaborador</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Data</th>
              {mostrarSupervisor && <th className="px-3 py-2">Supervisor</th>}
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-400">Nenhum termo encontrado.</td>
              </tr>
            )}
            {filtrados.map(t => {
              const atrasado = !t.protocoladoEm && dias(t.dataMov) > DIAS_ATRASO
              const cor = COR_TIPO[t.tipo]
              return (
                <tr
                  key={t.chave}
                  className={`border-b border-gray-50 last:border-0 ${atrasado ? 'border-l-4 border-l-red-500' : ''}`}
                >
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={sel.has(t.chave)} onChange={() => toggle(t.chave)} aria-label="Selecionar termo" />
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-semibold text-slate-900">{t.funcionarioNome}</p>
                    {t.postoNome && <p className="text-xs text-slate-500">{t.postoNome}</p>}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className="inline-block rounded-full px-2 py-0.5 text-xs font-semibold"
                      style={{ color: cor.hex, background: cor.fundo }}
                    >
                      {TIPO_LABEL[t.tipo]}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-600">{fmtData(t.dataMov)}</td>
                  {mostrarSupervisor && <td className="px-3 py-2 text-slate-600">{t.supervisorNome ?? '—'}</td>}
                  <td className="px-3 py-2">
                    {t.protocoladoEm ? (
                      <span className="inline-block rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700 ring-1 ring-green-200">
                        Protocolado {fmtData(t.protocoladoEm)}{t.protocoladoPorNome ? ` por ${t.protocoladoPorNome}` : ''}
                      </span>
                    ) : atrasado ? (
                      <span className="inline-block rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-red-200">
                        Atrasado · {dias(t.dataMov)} dias
                      </span>
                    ) : (
                      <span className="inline-block rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                        Pendente
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button
                      onClick={() => baixarUm(t.chave)}
                      disabled={ocupado !== null}
                      className="rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-50"
                    >
                      {ocupado === t.chave ? 'Gerando…' : 'PDF'}
                    </button>
                    {podeProtocolar && !t.protocoladoEm && (
                      <button
                        onClick={() => protocolar(t.chave)}
                        disabled={pending}
                        className="ml-1.5 rounded-lg bg-green-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-500 disabled:opacity-50"
                      >
                        Marcar protocolado
                      </button>
                    )}
                    {podeDesfazer && t.protocoladoEm && (
                      <button
                        onClick={() => desfazer(t.chave)}
                        disabled={pending}
                        className="ml-1.5 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Desfazer
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
