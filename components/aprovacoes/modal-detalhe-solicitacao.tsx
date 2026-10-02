'use client'

import type { ReactNode } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { cn } from '@/lib/utils'
import { PostoImpactPanel } from '@/components/posto-impact-panel'
import { camposDaSolicitacao, fmtData, badgeDaSolicitacao } from './campos-solicitacao'
import { TIPOS_DESLIGAMENTO, MOTIVOS_POR_TIPO, type TipoDesligamento } from '@/components/efetivo/modal-desligar'
import type { SolicitacaoPendente } from './aprovacoes-list'
import type { ImpactoResult } from '@/app/(admin)/efetivo/impacto'

export type FuncaoOpt = { id: string; nome: string }

interface Props {
  sol: SolicitacaoPendente
  impacto?: ImpactoResult
  canApprove: boolean
  open: boolean
  onClose: () => void
  pending: boolean
  erro: string | null
  rejeitando: boolean
  motivo: string
  onMotivoChange: (v: string) => void
  onIniciarRejeicao: () => void
  onCancelarRejeicao: () => void
  onAprovar: () => void
  onRejeitar: () => void
  /** Correções do admin (nome/registro/funcao_id/.../data_desligamento) antes de aprovar. */
  overrides: Record<string, string>
  onOverrideChange: (chave: string, valor: string) => void
  funcoes?: FuncaoOpt[]
}

const labelClass = 'text-gray-500'
const inputClass = 'rounded border border-gray-300 px-2 py-1 text-right text-sm font-medium text-gray-900 focus:outline-none focus:ring-1 focus:ring-slate-600'

/** Campo de texto/data editável (admin) num par label-valor. */
function CampoEditavel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className={labelClass}>{label}</span>
      {children}
    </div>
  )
}

export function ModalDetalheSolicitacao({
  sol, impacto, canApprove, open, onClose, pending, erro,
  rejeitando, motivo, onMotivoChange, onIniciarRejeicao, onCancelarRejeicao,
  onAprovar, onRejeitar, overrides, onOverrideChange, funcoes = [],
}: Props) {
  const badge = badgeDaSolicitacao(sol.tipo, sol.dados_depois)
  const campos = camposDaSolicitacao(sol.tipo, sol.dados_antes, sol.dados_depois)
  const depois = sol.dados_depois ?? {}
  const editando = canApprove

  function val(chave: string, fallback: unknown = ''): string {
    return overrides[chave] ?? (depois[chave] != null ? String(depois[chave]) : String(fallback))
  }

  const isAdmissao    = editando && sol.tipo === 'admissao'
  const isDesligamento = editando && sol.tipo === 'desligamento'

  const tipoDesligAtual = (val('tipo_desligamento') || undefined) as TipoDesligamento | undefined
  const motivosDoTipo = tipoDesligAtual ? MOTIVOS_POR_TIPO[tipoDesligAtual] ?? [] : []

  // Labels dos campos que viram input editável — somem da lista somente-leitura abaixo.
  const LABELS_OCULTOS_ADMISSAO = ['Nome', 'Função', 'Data de Admissão', 'Registro (PIS/NIT)', 'Período de Experiência']
  const LABELS_OCULTOS_DESLIGAMENTO = ['Data de Desligamento', 'Tipo de Desligamento', 'Motivação']
  const labelsOcultos = isAdmissao ? LABELS_OCULTOS_ADMISSAO : isDesligamento ? LABELS_OCULTOS_DESLIGAMENTO : []

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
          <div className="mb-4 flex items-start justify-between gap-2">
            <div>
              <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset', badge.className)}>
                {badge.label}
              </span>
              <Dialog.Title className="mt-2 text-lg font-semibold text-gray-900">
                {sol.funcionarios?.nome ?? '—'}
              </Dialog.Title>
            </div>
            <span className="shrink-0 text-xs text-gray-400">
              {sol.created_at ? fmtData(sol.created_at) : ''}
            </span>
          </div>

          <p className="mb-4 text-xs text-gray-500">
            Solicitado por <span className="font-medium text-slate-700">{sol.perfis?.nome ?? sol.perfis?.email ?? 'supervisor'}</span>
            {sol.motivo ? ` · ${sol.motivo}` : ''}
          </p>

          <div className="mb-4 space-y-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
            {campos.filter(c => !labelsOcultos.includes(c.label)).map(c => (
              <div key={c.label} className="flex justify-between gap-3 text-sm">
                <span className="text-gray-500">{c.label}</span>
                <span className="text-right font-medium text-gray-900">{c.valor}</span>
              </div>
            ))}

            {isAdmissao && (
              <>
                <CampoEditavel label="Nome">
                  <input
                    type="text"
                    value={val('nome')}
                    onChange={e => onOverrideChange('nome', e.target.value)}
                    className={cn(inputClass, 'w-56')}
                  />
                </CampoEditavel>
                <CampoEditavel label="Função">
                  <select
                    value={val('funcao_id')}
                    onChange={e => {
                      onOverrideChange('funcao_id', e.target.value)
                      onOverrideChange('funcao_nome', funcoes.find(f => f.id === e.target.value)?.nome ?? '')
                    }}
                    className={cn(inputClass, 'w-56')}
                  >
                    <option value="">Selecione…</option>
                    {funcoes.map(f => (
                      <option key={f.id} value={f.id}>{f.nome}</option>
                    ))}
                  </select>
                </CampoEditavel>
                <CampoEditavel label="Registro (PIS/NIT)">
                  <input
                    type="text"
                    value={val('registro')}
                    onChange={e => onOverrideChange('registro', e.target.value)}
                    className={cn(inputClass, 'w-56')}
                  />
                </CampoEditavel>
                <CampoEditavel label="Período de Experiência">
                  <select
                    value={val('periodo_experiencia', 'nenhum')}
                    onChange={e => onOverrideChange('periodo_experiencia', e.target.value)}
                    className={cn(inputClass, 'w-56')}
                  >
                    <option value="nenhum">Nenhum (Jovem Aprendiz)</option>
                    <option value="30+30">30 + 30 dias</option>
                    <option value="45+45">45 + 45 dias</option>
                  </select>
                </CampoEditavel>
                <CampoEditavel label="Data de Admissão">
                  <input
                    type="date"
                    value={val('data_admissao').slice(0, 10)}
                    onChange={e => onOverrideChange('data_admissao', e.target.value)}
                    className={inputClass}
                  />
                </CampoEditavel>
              </>
            )}

            {isDesligamento && (
              <>
                <CampoEditavel label="Tipo de Desligamento">
                  <select
                    value={val('tipo_desligamento')}
                    onChange={e => {
                      onOverrideChange('tipo_desligamento', e.target.value)
                      onOverrideChange('motivo', '')
                    }}
                    className={cn(inputClass, 'w-56')}
                  >
                    <option value="">Selecione…</option>
                    {TIPOS_DESLIGAMENTO.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </CampoEditavel>
                <CampoEditavel label="Motivação">
                  <select
                    value={val('motivo')}
                    onChange={e => onOverrideChange('motivo', e.target.value)}
                    className={cn(inputClass, 'w-56')}
                  >
                    <option value="">Selecione…</option>
                    {motivosDoTipo.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </CampoEditavel>
                <CampoEditavel label="Data de Desligamento">
                  <input
                    type="date"
                    value={val('data_desligamento').slice(0, 10)}
                    onChange={e => onOverrideChange('data_desligamento', e.target.value)}
                    className={inputClass}
                  />
                </CampoEditavel>
              </>
            )}
          </div>

          {impacto && (
            <div className="mb-4">
              <PostoImpactPanel impacto={impacto} />
            </div>
          )}

          {erro && (
            <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>
          )}

          {canApprove && (!rejeitando ? (
            <div className="flex gap-2">
              <button
                onClick={onAprovar}
                disabled={pending}
                className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
              >
                {pending ? '...' : 'Aprovar'}
              </button>
              <button
                onClick={onIniciarRejeicao}
                disabled={pending}
                className="flex-1 rounded-lg border border-red-300 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                Rejeitar
              </button>
            </div>
          ) : (
            <div className="space-y-2 border-t border-gray-100 pt-3">
              <textarea
                value={motivo}
                onChange={e => onMotivoChange(e.target.value)}
                rows={2}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-slate-600"
                placeholder="Motivo da rejeição..."
              />
              <div className="flex gap-2">
                <button
                  onClick={onCancelarRejeicao}
                  className="flex-1 rounded-lg border border-gray-200 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={onRejeitar}
                  disabled={!motivo.trim() || pending}
                  className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {pending ? '...' : 'Confirmar'}
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full rounded px-4 py-2 text-center text-sm font-medium text-gray-500 hover:bg-gray-50"
          >
            Fechar
          </button>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
