'use client'

import { useState, useTransition } from 'react'
import { editarFerias, type FeriasListaItem } from '@/app/(admin)/ferias/actions'

interface Props {
  item: FeriasListaItem | null
  onClose: () => void
  onSuccess: () => void
}

const STATUS_CONFIG: Record<string, { emoji: string; label: string; desc: string; color: string }> = {
  disponivel: { emoji: '📋', label: 'Disponível',  desc: 'Período registrado, aguardando agendamento de datas', color: 'text-slate-600' },
  agendado:   { emoji: '📅', label: 'Agendado',    desc: 'Datas definidas, aguardando início',                 color: 'text-blue-700'  },
  aprovado:   { emoji: '✅', label: 'Aprovado',    desc: 'Aprovado pela coordenação',                          color: 'text-indigo-700' },
  em_curso:   { emoji: '🏖️', label: 'Em Curso',    desc: 'Funcionário em gozo de férias',                     color: 'text-green-700' },
  concluido:  { emoji: '✔️', label: 'Concluído',   desc: 'Férias encerradas e registradas',                   color: 'text-green-800' },
  cancelado:  { emoji: '❌', label: 'Cancelado',   desc: 'Período cancelado',                                  color: 'text-red-600'   },
}

function formatDateBR(str: string | null): string {
  if (!str) return '—'
  const d = new Date(str + 'T00:00:00')
  return d.toLocaleDateString('pt-BR')
}

function formatDateInput(str: string | null): string {
  if (!str) return ''
  return str.split('T')[0]
}

function diasEntre(inicio: string, fim: string): number | null {
  if (!inicio || !fim) return null
  const diff = Math.ceil((new Date(fim).getTime() - new Date(inicio).getTime()) / 86400000) + 1
  return diff > 0 ? diff : null
}

function addDias(dateStr: string, dias: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + dias - 1)
  return d.toISOString().split('T')[0]
}

function limiteAlert(limiteGozo: string | null): { level: 'vencido' | 'critico' | 'atencao' | null; dias: number } {
  if (!limiteGozo) return { level: null, dias: 0 }
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const limite = new Date(limiteGozo + 'T00:00:00')
  const diff = Math.ceil((limite.getTime() - hoje.getTime()) / 86400000)
  if (diff < 0)   return { level: 'vencido', dias: Math.abs(diff) }
  if (diff <= 30) return { level: 'critico', dias: diff }
  if (diff <= 60) return { level: 'atencao', dias: diff }
  return { level: null, dias: diff }
}

export function ModalEditarFerias({ item, onClose, onSuccess }: Props) {
  const [dataInicio, setDataInicio] = useState(formatDateInput(item?.data_inicio ?? null))
  const [dataFim, setDataFim]       = useState(formatDateInput(item?.data_fim   ?? null))
  const [status, setStatus]         = useState(item?.status ?? 'disponivel')
  const obsInicial = (item?.observacao ?? '').toLowerCase().includes('importa') ? '' : (item?.observacao ?? '')
  const [observacao, setObservacao] = useState(obsInicial)
  const [confirmandoLimpeza, setConfirmandoLimpeza] = useState(false)
  const [showGuia, setShowGuia]     = useState(false)
  const [erro, setErro]             = useState<string | null>(null)
  const [pendingSave, startSave]    = useTransition()
  const [pendingDelete, startDelete] = useTransition()

  if (!item) return null

  const diasDireito = item.dias_direito ?? 30
  const diasCalculados = diasEntre(dataInicio, dataFim)
  const alertaLimite = limiteAlert(item.limite_gozo)

  function handleInicioChange(value: string) {
    setDataInicio(value)
    if (value && diasDireito) setDataFim(addDias(value, diasDireito))
  }

  function handleSalvar() {
    setErro(null)
    const diasUtilizados = dataInicio && dataFim ? diasEntre(dataInicio, dataFim) : null
    startSave(async () => {
      try {
        await editarFerias(item!.id, {
          data_inicio: dataInicio || null,
          data_fim: dataFim || null,
          dias_utilizados: diasUtilizados,
          status,
          observacao: observacao || null,
        })
        onSuccess()
        onClose()
      } catch (e: unknown) {
        setErro(e instanceof Error ? e.message : 'Erro ao salvar')
      }
    })
  }

  function handleLimparDatas() {
    startDelete(async () => {
      try {
        await editarFerias(item!.id, {
          data_inicio: null,
          data_fim: null,
          dias_utilizados: null,
          status: 'disponivel',
          observacao: null,
        })
        onSuccess()
        onClose()
      } catch (e: unknown) {
        setErro(e instanceof Error ? e.message : 'Erro ao limpar datas')
      }
    })
  }

  const statusCfg = STATUS_CONFIG[status]
  const diasExcedidos = diasCalculados !== null && diasCalculados > diasDireito

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[92vh]">

        {/* Cabeçalho */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Editar Férias</h2>
            <p className="text-sm font-medium text-slate-700 mt-0.5">{item.funcionario_nome}</p>
            <p className="text-xs text-slate-400">{item.funcionario_registro} · {item.posto_nome}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none mt-1">×</button>
        </div>

        <div className="overflow-y-auto px-6 py-4 space-y-4 flex-1">

          {/* Painel de contexto */}
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Contexto do período</span>
              <button
                type="button"
                onClick={() => setShowGuia(p => !p)}
                className="text-xs text-indigo-500 hover:text-indigo-700 font-medium"
              >
                {showGuia ? 'Ocultar guia' : 'Ver guia de status'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1">
              <div>
                <span className="text-xs text-slate-400">Período</span>
                <p className="font-semibold text-slate-700">{item.numero_periodo}º aquisitivo</p>
              </div>
              <div>
                <span className="text-xs text-slate-400">Dias de direito</span>
                <p className="font-semibold text-slate-700">{diasDireito} dias</p>
              </div>
              <div>
                <span className="text-xs text-slate-400">Período aquisitivo</span>
                <p className="text-slate-600 text-xs">{formatDateBR(item.periodo_inicio)} – {formatDateBR(item.periodo_fim)}</p>
              </div>
              <div>
                <span className="text-xs text-slate-400">Limite de gozo</span>
                <p className={`text-xs font-semibold ${
                  alertaLimite.level === 'vencido' ? 'text-red-700' :
                  alertaLimite.level === 'critico' ? 'text-orange-700' :
                  alertaLimite.level === 'atencao' ? 'text-amber-700' : 'text-slate-700'
                }`}>
                  {formatDateBR(item.limite_gozo)}
                  {alertaLimite.level === 'vencido' && ` · VENCIDO há ${alertaLimite.dias}d`}
                  {alertaLimite.level === 'critico' && ` · ${alertaLimite.dias}d restantes`}
                  {alertaLimite.level === 'atencao' && ` · ${alertaLimite.dias}d restantes`}
                </p>
              </div>
            </div>

            {/* Alerta de vencimento */}
            {alertaLimite.level === 'vencido' && (
              <div className="mt-2 rounded-md bg-red-100 text-red-700 text-xs font-medium px-3 py-2">
                ⛔ Prazo VENCIDO — risco de férias em dobro. Registre as datas imediatamente.
              </div>
            )}
            {alertaLimite.level === 'critico' && (
              <div className="mt-2 rounded-md bg-orange-100 text-orange-700 text-xs font-medium px-3 py-2">
                ⚠️ Vence em {alertaLimite.dias} dias — agende com urgência.
              </div>
            )}
          </div>

          {/* Guia de status (colapsável) */}
          {showGuia && (
            <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3 space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-2">Guia de status</p>
              {Object.entries(STATUS_CONFIG).map(([k, cfg]) => (
                <div key={k} className="flex items-start gap-2 text-xs">
                  <span className="shrink-0 w-5 text-center">{cfg.emoji}</span>
                  <span className="font-semibold text-slate-700 w-20 shrink-0">{cfg.label}</span>
                  <span className="text-slate-500">{cfg.desc}</span>
                </div>
              ))}
            </div>
          )}

          {/* Datas de gozo */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">
              Datas de Gozo
            </label>
            <p className="text-xs text-blue-500 mb-2">
              💡 Ao definir o <strong>Início</strong>, o <strong>Fim</strong> é calculado automaticamente ({diasDireito} dias).
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Início</label>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={e => handleInicioChange(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Fim</label>
                <input
                  type="date"
                  value={dataFim}
                  onChange={e => setDataFim(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>
            </div>

            {/* Contador de dias */}
            {diasCalculados !== null && (
              <div className={`mt-2 flex items-center gap-1.5 text-xs font-medium rounded-md px-3 py-1.5 ${
                diasExcedidos
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : diasCalculados === diasDireito
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                {diasExcedidos
                  ? `⚠️ ${diasCalculados} dias calculados — excede os ${diasDireito} dias de direito`
                  : diasCalculados === diasDireito
                  ? `✅ ${diasCalculados} dias — exato`
                  : `ℹ️ ${diasCalculados} de ${diasDireito} dias`}
              </div>
            )}
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              {Object.entries(STATUS_CONFIG).map(([k, cfg]) => (
                <option key={k} value={k}>{cfg.emoji} {cfg.label}</option>
              ))}
            </select>
            {statusCfg && (
              <p className={`text-xs mt-1 ${statusCfg.color}`}>{statusCfg.desc}</p>
            )}
          </div>

          {/* Observação */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">Observação</label>
            <textarea
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
              rows={2}
              placeholder="Opcional..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 resize-none"
            />
          </div>

          {erro && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{erro}</p>}
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
          {!confirmandoLimpeza ? (
            <button
              onClick={() => setConfirmandoLimpeza(true)}
              className="text-sm text-amber-600 hover:text-amber-800 font-medium"
            >
              Limpar datas de gozo
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-amber-700 font-medium">Limpar datas e voltar a Disponível?</span>
              <button
                onClick={handleLimparDatas}
                disabled={pendingDelete}
                className="px-3 py-1 text-xs font-semibold bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
              >
                {pendingDelete ? 'Limpando...' : 'Sim'}
              </button>
              <button
                onClick={() => setConfirmandoLimpeza(false)}
                className="px-3 py-1 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                Não
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900">
              Fechar
            </button>
            <button
              onClick={handleSalvar}
              disabled={pendingSave}
              className="px-4 py-2 text-sm font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50"
            >
              {pendingSave ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
