/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect } from 'react'
import { agendarFerias, buscarPeriodosAquisitivos } from '@/app/(admin)/ferias/actions'

interface Funcionario {
  id: string
  nome: string
  registro: string
  posto_nome: string
  secretaria: string
  data_admissao: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setMonth(d.getMonth() + months)
  return d.toISOString().split('T')[0]
}

function formatDateBR(str: string | null): string {
  if (!str) return '—'
  const d = new Date(str + 'T00:00:00')
  return d.toLocaleDateString('pt-BR')
}

export function ModalNovaFerias({ open, onClose, onSuccess }: Props) {
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<Funcionario[]>([])
  const [selecionado, setSelecionado] = useState<Funcionario | null>(null)
  const [periodosExistentes, setPeriodosExistentes] = useState<any[]>([])

  const [numeroPeriodo, setNumeroPeriodo] = useState('')
  const [periodoInicio, setPeriodoInicio] = useState('')
  const [periodoFim, setPeriodoFim] = useState('')
  const [limiteGozo, setLimiteGozo] = useState('')
  const [diasDireito, setDiasDireito] = useState('30')

  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [observacao, setObservacao] = useState('')

  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [cienteDisponiveis, setCienteDisponiveis] = useState(false)

  useEffect(() => {
    if (busca.length < 2) { setResultados([]); return }
    const t = setTimeout(async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const sb = createClient()
      const { data } = await sb
        .from('funcionarios')
        .select('id, nome, registro, posto_id, data_admissao')
        .eq('status', 'ativo')
        .ilike('nome', `%${busca}%`)
        .limit(10)
      const com_posto = await Promise.all((data ?? []).map(async (f: any) => {
        if (!f.posto_id) return { ...f, posto_nome: '—', secretaria: '—' }
        const { data: p } = await sb.from('postos').select('nome, secretaria').eq('id', f.posto_id).single()
        return { ...f, posto_nome: p?.nome ?? '—', secretaria: p?.secretaria ?? '—' }
      }))
      setResultados(com_posto)
    }, 300)
    return () => clearTimeout(t)
  }, [busca])

  async function handleSelecionarFuncionario(f: Funcionario) {
    setSelecionado(f)
    setBusca(f.nome)
    setResultados([])
    const periodos = await buscarPeriodosAquisitivos(f.id)
    setPeriodosExistentes(periodos ?? [])
    setCienteDisponiveis(false)

    const maxPeriodo = (periodos ?? []).reduce((max: number, p: any) => Math.max(max, p.numero_periodo ?? 0), 0)
    setNumeroPeriodo(String(maxPeriodo + 1))

    if ((periodos ?? []).length === 0 && f.data_admissao) {
      setPeriodoInicio(f.data_admissao)
      const fim = addMonths(f.data_admissao, 12)
      const d = new Date(fim + 'T00:00:00')
      d.setDate(d.getDate() - 1)
      const fimStr = d.toISOString().split('T')[0]
      setPeriodoFim(fimStr)
      setLimiteGozo(addMonths(fimStr, 10))
    } else if ((periodos ?? []).length > 0) {
      const ultimo = [...(periodos ?? [])].sort((a: any, b: any) => (b.numero_periodo ?? 0) - (a.numero_periodo ?? 0))[0]
      if (ultimo.periodo_fim) {
        const d = new Date(ultimo.periodo_fim + 'T00:00:00')
        d.setDate(d.getDate() + 1)
        const inicioStr = d.toISOString().split('T')[0]
        setPeriodoInicio(inicioStr)
        const fimD = new Date(inicioStr + 'T00:00:00')
        fimD.setFullYear(fimD.getFullYear() + 1)
        fimD.setDate(fimD.getDate() - 1)
        const fimStr = fimD.toISOString().split('T')[0]
        setPeriodoFim(fimStr)
        setLimiteGozo(addMonths(fimStr, 10))
      }
    }
  }

  useEffect(() => {
    if (periodoFim) setLimiteGozo(addMonths(periodoFim, 10))
  }, [periodoFim])

  const diasCalculados = dataInicio && dataFim
    ? Math.round((new Date(dataFim + 'T00:00:00').getTime() - new Date(dataInicio + 'T00:00:00').getTime()) / 86400000) + 1
    : null

  const limiteWarning = (() => {
    if (!limiteGozo) return null
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
    const limite = new Date(limiteGozo + 'T00:00:00')
    const diff = Math.ceil((limite.getTime() - hoje.getTime()) / 86400000)
    if (diff < 0) return { level: 'vencido', dias: Math.abs(diff) }
    if (diff <= 30) return { level: 'critico', dias: diff }
    if (diff <= 60) return { level: 'atencao', dias: diff }
    return null
  })()

  async function handleSubmit() {
    if (!selecionado) { setErro('Selecione um funcionário'); return }
    if (qtdDisponiveis > 0 && !cienteDisponiveis) {
      setErro('Marque o checkbox confirmando que está ciente dos períodos disponíveis existentes.')
      return
    }
    if (!periodoInicio || !periodoFim) { setErro('Informe o período aquisitivo'); return }
    if (!limiteGozo) { setErro('Informe o limite de gozo'); return }
    setSalvando(true); setErro('')
    try {
      await agendarFerias({
        funcionario_id: selecionado.id,
        numero_periodo: Number(numeroPeriodo) || 1,
        periodo_inicio: periodoInicio,
        periodo_fim: periodoFim,
        limite_gozo: limiteGozo,
        dias_direito: Number(diasDireito) || 30,
        data_inicio: dataInicio || null,
        data_fim: dataFim || null,
        observacao: observacao || undefined,
      })
      onSuccess?.()
      handleClose()
    } catch (e: any) {
      setErro(e.message ?? 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  function handleClose() {
    setBusca(''); setResultados([]); setSelecionado(null); setPeriodosExistentes([])
    setNumeroPeriodo(''); setPeriodoInicio(''); setPeriodoFim(''); setLimiteGozo('')
    setDiasDireito('30'); setDataInicio(''); setDataFim(''); setObservacao(''); setErro('')
    setCienteDisponiveis(false)
    onClose()
  }

  const qtdDisponiveis = periodosExistentes.filter((p: any) => p.status === 'disponivel').length

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Agendar Férias</h2>
            <p className="text-xs text-slate-400 mt-0.5">Registra férias futuras ou em andamento</p>
          </div>
          <button type="button" onClick={handleClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
        </div>

        <div className="overflow-y-auto px-6 py-4 space-y-4 flex-1">
          {/* Busca funcionário */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">Funcionário</label>
            <input
              value={busca}
              onChange={e => { setBusca(e.target.value); setSelecionado(null) }}
              placeholder="Digite o nome..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
            {resultados.length > 0 && (
              <div className="border border-slate-200 rounded-lg mt-1 shadow-md bg-white max-h-48 overflow-y-auto">
                {resultados.map(f => (
                  <button key={f.id} type="button" onClick={() => handleSelecionarFuncionario(f)}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0">
                    <div className="text-sm font-medium text-slate-800">{f.nome}</div>
                    <div className="text-xs text-slate-400">{f.registro} · {f.posto_nome}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Aviso: períodos disponíveis existentes */}
          {selecionado && qtdDisponiveis > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2">
              <p className="text-sm font-semibold text-amber-800">
                ⚠️ {qtdDisponiveis} período{qtdDisponiveis > 1 ? 's' : ''} com status &quot;Disponível&quot;
              </p>
              <p className="text-xs text-amber-700">
                Este funcionário já tem períodos aguardando agendamento de datas. <strong>Use &quot;Ver / Editar&quot;</strong> nesses períodos em vez de criar um novo — assim você evita duplicatas no histórico.
              </p>
              <label className="flex items-center gap-2 text-xs text-amber-800 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={cienteDisponiveis}
                  onChange={e => setCienteDisponiveis(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-amber-400 accent-amber-600"
                />
                Estou ciente e quero criar um novo período mesmo assim
              </label>
            </div>
          )}

          {/* Períodos existentes */}
          {selecionado && periodosExistentes.length > 0 && (
            <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600">
              <div className="font-semibold mb-1 text-slate-700">Períodos já registrados:</div>
              {periodosExistentes.map((p: any) => (
                <div key={p.id} className="flex justify-between py-0.5">
                  <span>{p.numero_periodo}º período ({formatDateBR(p.periodo_inicio)} – {formatDateBR(p.periodo_fim)})</span>
                  <span className={`font-medium ${p.status === 'disponivel' ? 'text-amber-600' : 'text-slate-600'}`}>
                    {p.status === 'disponivel' ? '⚠️ Disponível' : p.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Período aquisitivo */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">Período Aquisitivo</label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-slate-400">Nº do Período</label>
                <input type="number" value={numeroPeriodo} onChange={e => setNumeroPeriodo(e.target.value)} min={1}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-slate-300" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Início Aquisitivo</label>
                <input type="date" value={periodoInicio} onChange={e => setPeriodoInicio(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-slate-300" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Fim Aquisitivo</label>
                <input type="date" value={periodoFim} onChange={e => setPeriodoFim(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-slate-300" />
              </div>
            </div>
          </div>

          {/* Limite de gozo */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">Limite de Gozo</label>
            <input type="date" value={limiteGozo} onChange={e => setLimiteGozo(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
            <p className="text-xs text-slate-400 mt-1">
              Calculado automaticamente: fim do período aquisitivo + 10 meses (margem RH). O prazo legal é 12 meses após o fim do período.
            </p>
            {limiteWarning && (
              <div className={`mt-2 rounded-lg px-3 py-2 text-xs font-medium ${
                limiteWarning.level === 'vencido' ? 'bg-red-100 text-red-700' :
                limiteWarning.level === 'critico' ? 'bg-orange-100 text-orange-700' :
                'bg-amber-100 text-amber-700'
              }`}>
                {limiteWarning.level === 'vencido'
                  ? `⛔ Prazo VENCIDO há ${limiteWarning.dias} dias — férias em dobro!`
                  : limiteWarning.level === 'critico'
                  ? `⚠️ Vence em ${limiteWarning.dias} dias — ação urgente`
                  : `⏰ Vence em ${limiteWarning.dias} dias`}
              </div>
            )}
          </div>

          {/* Dias de direito */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">Dias de Direito</label>
            <input type="number" value={diasDireito} onChange={e => setDiasDireito(e.target.value)} min={1} max={30}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
          </div>

          {/* Datas de gozo (opcionais) */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">
              Datas de Gozo <span className="text-slate-300 font-normal normal-case">(opcional — pode agendar depois)</span>
            </label>
            <p className="text-xs text-blue-500 mb-2">
              💡 Escolha primeiro o <strong>Início</strong> — o sistema calcula o <strong>Fim</strong> automaticamente com base nos dias de direito.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-400">Início</label>
                <input type="date" value={dataInicio} onChange={e => {
                  const inicio = e.target.value
                  setDataInicio(inicio)
                  if (inicio && diasDireito) {
                    const d = new Date(inicio + 'T00:00:00')
                    d.setDate(d.getDate() + Number(diasDireito) - 1)
                    setDataFim(d.toISOString().split('T')[0])
                  }
                }}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-slate-300" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Fim</label>
                <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-slate-300" />
              </div>
            </div>
            {diasCalculados !== null && diasCalculados > 0 && (
              <p className="text-xs text-slate-500 mt-1">{diasCalculados} dias de gozo</p>
            )}
          </div>

          {/* Observação */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">Observação</label>
            <textarea value={observacao} onChange={e => setObservacao(e.target.value)} rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-300" />
          </div>

          {erro && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{erro}</div>}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button type="button" onClick={handleClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition">Cancelar</button>
          <button type="button" onClick={handleSubmit} disabled={salvando}
            className="px-5 py-2 text-sm font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 transition">
            {salvando ? 'Salvando...' : 'Salvar Férias'}
          </button>
        </div>
      </div>
    </div>
  )
}
