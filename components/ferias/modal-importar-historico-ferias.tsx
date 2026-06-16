/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect } from 'react'
import { importarFeriasHistoricas } from '@/app/(admin)/ferias/actions'

interface Funcionario {
  id: string
  nome: string
  registro: string
  posto_nome: string
  secretaria: string
  data_admissao: string | null
  status: string
}

interface Props {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function ModalImportarHistoricoFerias({ open, onClose, onSuccess }: Props) {
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<Funcionario[]>([])
  const [selecionado, setSelecionado] = useState<Funcionario | null>(null)

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

  useEffect(() => {
    if (busca.length < 2) { setResultados([]); return }
    const t = setTimeout(async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const sb = createClient()
      const { data } = await sb
        .from('funcionarios')
        .select('id, nome, registro, posto_id, data_admissao, status')
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

  function handleSelecionarFuncionario(f: Funcionario) {
    setSelecionado(f)
    setBusca(f.nome)
    setResultados([])
  }

  const diasCalculados = dataInicio && dataFim
    ? Math.round((new Date(dataFim + 'T00:00:00').getTime() - new Date(dataInicio + 'T00:00:00').getTime()) / 86400000) + 1
    : null

  async function handleSubmit() {
    if (!selecionado) { setErro('Selecione um funcionário'); return }
    if (!periodoInicio || !periodoFim) { setErro('Informe o período aquisitivo'); return }
    if (!dataInicio || !dataFim) { setErro('Informe as datas de gozo (histórico requer datas já realizadas)'); return }
    setSalvando(true); setErro('')
    try {
      await importarFeriasHistoricas({
        funcionario_id: selecionado.id,
        numero_periodo: Number(numeroPeriodo) || 1,
        periodo_inicio: periodoInicio,
        periodo_fim: periodoFim,
        limite_gozo: limiteGozo || null,
        dias_direito: Number(diasDireito) || 30,
        data_inicio: dataInicio,
        data_fim: dataFim,
        dias_utilizados: diasCalculados ?? undefined,
        observacao: observacao || undefined,
      })
      onSuccess?.()
      handleClose()
    } catch (e: any) {
      setErro(e.message ?? 'Erro ao importar')
    } finally {
      setSalvando(false)
    }
  }

  function handleClose() {
    setBusca(''); setResultados([]); setSelecionado(null)
    setNumeroPeriodo(''); setPeriodoInicio(''); setPeriodoFim(''); setLimiteGozo('')
    setDiasDireito('30'); setDataInicio(''); setDataFim(''); setObservacao(''); setErro('')
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Importar Histórico de Férias</h2>
            <p className="text-xs text-slate-400 mt-0.5">Registra férias já realizadas — status: Concluído</p>
          </div>
          <button type="button" onClick={handleClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
        </div>

        <div className="overflow-y-auto px-6 py-4 space-y-4 flex-1">
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
            ↩ Este modal registra <strong>férias já gozadas</strong>. O status será salvo automaticamente como <strong>Concluído</strong>. Use para migrar dados históricos do sistema anterior.
          </div>

          {/* Busca funcionário — inclui desligados */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">Funcionário</label>
            <input
              value={busca}
              onChange={e => { setBusca(e.target.value); setSelecionado(null) }}
              placeholder="Digite o nome (inclui desligados)..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
            {resultados.length > 0 && (
              <div className="border border-slate-200 rounded-lg mt-1 shadow-md bg-white max-h-48 overflow-y-auto">
                {resultados.map(f => (
                  <button key={f.id} type="button" onClick={() => handleSelecionarFuncionario(f)}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0">
                    <div className="text-sm font-medium text-slate-800">{f.nome}</div>
                    <div className="text-xs text-slate-400">{f.registro} · {f.status}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

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

          {/* Dias de direito */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">Dias de Direito</label>
            <input type="number" value={diasDireito} onChange={e => setDiasDireito(e.target.value)} min={1} max={30}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
          </div>

          {/* Datas de gozo — obrigatórias no histórico */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">
              Datas de Gozo <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-400">Início</label>
                <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-slate-300" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Fim</label>
                <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-slate-300" />
              </div>
            </div>
            {diasCalculados !== null && diasCalculados > 0 && (
              <p className="text-xs text-slate-500 mt-1">{diasCalculados} dias de gozo registrados</p>
            )}
          </div>

          {/* Observação */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">Observação</label>
            <textarea value={observacao} onChange={e => setObservacao(e.target.value)} rows={2}
              placeholder="Ex: Migrado do sistema legado — período 2024/2025"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-300" />
          </div>

          {erro && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{erro}</div>}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button type="button" onClick={handleClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition">Cancelar</button>
          <button type="button" onClick={handleSubmit} disabled={salvando}
            className="px-5 py-2 text-sm font-semibold bg-blue-700 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50 transition">
            {salvando ? 'Importando...' : '↩ Importar Histórico'}
          </button>
        </div>
      </div>
    </div>
  )
}
