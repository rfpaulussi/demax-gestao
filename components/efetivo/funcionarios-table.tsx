'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FileMinus, UserMinus, ArrowUpRight, ClipboardList, Clock, Pencil, UserCheck } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { calcularStatusExperiencia } from '@/lib/experiencia'
import { marcarRetornoFaltante } from '@/app/(admin)/efetivo/actions'
import { ModalAtestado } from './modal-atestado'
import { ModalAfastar } from './modal-afastar'
import { ModalNovaSolicitacao } from './modal-nova-solicitacao'
import { ModalEditarFuncionario } from './modal-editar-funcionario'

export type FuncionarioRow = {
  id: string
  nome: string
  registro: string | null
  cpf: string | null
  status: 'ativo' | 'atestado' | 'afastado' | 'ferias' | 'desligado' | 'faltante' | null
  motivo_afastamento: 'ausencia_temporaria' | 'inss' | null
  origem_ocupacional_cat: string | null
  data_admissao: string | null
  data_desligamento: string | null
  motivo_desligamento: string | null
  tipo_desligamento: string | null
  posto_id: string | null
  periodo_experiencia: '30+30' | '45+45' | null
  fase_experiencia: '1' | '2' | 'concluido' | null
  data_fim_fase1: string | null
  data_fim_fase2: string | null
  funcoes: { id: string; nome: string } | null
  postos: { id: string; nome: string; secretaria: string | null } | null
  supervisor_nome?: string | null
  supervisor_id?: string | null
}

const ORIGEM_SUBTEXT: Record<string, string> = {
  acidente_trabalho:  'Acidente de Trabalho',
  doenca_ocupacional: 'Doença Ocupacional',
}

function fmtSupervisor(nome: string | null | undefined): string | null {
  if (!nome) return null
  const parts = nome.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`
}

const STATUS_BADGE: Record<
  NonNullable<FuncionarioRow['status']>,
  { label: string; className: string }
> = {
  ativo:     { label: 'Ativo',     className: 'bg-green-50 text-green-700 ring-green-200'      },
  atestado:  { label: 'Atestado',  className: 'bg-amber-50 text-amber-700 ring-amber-200'      },
  afastado:  { label: 'Afastado',  className: 'bg-red-50 text-red-700 ring-red-200'            },
  ferias:    { label: 'Férias',    className: 'bg-orange-50 text-orange-700 ring-orange-200'   },
  desligado: { label: 'Desligado', className: 'bg-gray-100 text-gray-500 ring-gray-200'        },
  faltante:  { label: '⚑ FALTANTE', className: 'bg-rose-100 text-rose-800 ring-rose-400 font-bold' },
}

const STATUS_ROW: Record<
  NonNullable<FuncionarioRow['status']>,
  { bg: string; hover: string; borderLeft: string; dimmed: boolean }
> = {
  ativo:     { bg: 'bg-white',    hover: 'hover:bg-gray-50',    borderLeft: '',                                    dimmed: false },
  atestado:  { bg: 'bg-amber-50', hover: 'hover:bg-amber-100',  borderLeft: 'border-l-[3px] border-l-amber-400',  dimmed: false },
  afastado:  { bg: 'bg-red-50',   hover: 'hover:bg-red-100',    borderLeft: 'border-l-[3px] border-l-red-400',    dimmed: false },
  ferias:    { bg: 'bg-blue-50',  hover: 'hover:bg-blue-100',   borderLeft: 'border-l-[3px] border-l-blue-400',   dimmed: false },
  desligado: { bg: 'bg-gray-50',  hover: 'hover:bg-gray-100',   borderLeft: '',                                    dimmed: true  },
  faltante:  { bg: 'bg-rose-50',  hover: 'hover:bg-rose-100',   borderLeft: 'border-l-[3px] border-l-rose-500',   dimmed: false },
}

const COLS: { label: string; sortKey?: string }[] = [
  { label: 'Registro'                           },
  { label: 'Nome',       sortKey: 'nome'       },
  { label: 'Função',     sortKey: 'funcao'     },
  { label: 'Posto',      sortKey: 'posto'      },
  { label: 'Secretaria', sortKey: 'secretaria' },
  { label: 'Supervisor'                         },
  { label: 'Status',     sortKey: 'status'     },
  { label: 'Ações'                              },
]

export function FuncionariosTable({
  funcionarios,
  postos,
  funcoes,
  cids,
  sortCol,
  sortDir,
  onSort,
  isAdmin,
  faltasAtivas,
  coberturaSubstitutos,
  coberturaAusentes,
}: {
  funcionarios: FuncionarioRow[]
  postos: { id: string; nome: string; secretaria: string | null }[]
  funcoes: { id: string; nome: string }[]
  cids: { codigo: string; descricao: string }[]
  sortCol?: string
  sortDir?: 'asc' | 'desc'
  onSort?: (col: string) => void
  isAdmin?: boolean
  faltasAtivas?: Record<string, boolean>
  coberturaSubstitutos?: Record<string, boolean>
  coberturaAusentes?: Record<string, boolean>
}) {
  const [atestadoFuncionario, setAtestadoFuncionario]     = useState<FuncionarioRow | null>(null)
  const [afastarFuncionario, setAfastarFuncionario]       = useState<FuncionarioRow | null>(null)
  const [solicitarFuncionario, setSolicitarFuncionario]   = useState<FuncionarioRow | null>(null)
  const [editarFuncionario,    setEditarFuncionario]      = useState<FuncionarioRow | null>(null)

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        {funcionarios.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-gray-400">
            Nenhum funcionário encontrado.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-slate-50">
                <tr>
                  {COLS.map(col => (
                    <th
                      key={col.label}
                      onClick={col.sortKey ? () => onSort?.(col.sortKey!) : undefined}
                      className={cn(
                        'px-5 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400',
                        col.sortKey && 'cursor-pointer select-none hover:text-gray-600',
                      )}
                    >
                      {col.label}
                      {col.sortKey && sortCol === col.sortKey && (
                        <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {funcionarios.map(f => {
                  const badge    = f.status ? STATUS_BADGE[f.status] : null
                  const rowStyle = f.status ? STATUS_ROW[f.status] : null
                  const supLabel = fmtSupervisor(f.supervisor_nome)
                  const exp = calcularStatusExperiencia(f.data_admissao, f.periodo_experiencia)

                  return (
                    <tr
                      key={f.id}
                      className={cn(
                        'transition-colors',
                        rowStyle?.bg,
                        rowStyle?.hover,
                        rowStyle?.dimmed && 'opacity-60',
                      )}
                    >
                      <td className="px-5 py-3.5 font-mono text-sm text-gray-500">
                        {f.registro ?? '—'}
                      </td>
                      <td
                        className={cn(
                          'px-5 py-3.5 font-medium text-gray-900',
                          rowStyle?.borderLeft,
                        )}
                      >
                        {f.nome}
                        {f.cpf && (
                          <span className="block text-xs font-normal text-gray-400">
                            ***.***.***-**
                          </span>
                        )}
                        {exp.emExperiencia && (
                          <span className={cn(
                            'mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset',
                            exp.alertaCritico
                              ? 'bg-red-50 text-red-700 ring-red-200'
                              : 'bg-purple-50 text-purple-700 ring-purple-200',
                          )}>
                            {exp.labelBadge}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">{f.funcoes?.nome ?? '—'}</td>
                      <td className="px-5 py-3.5 text-gray-500">{f.postos?.nome ?? '—'}</td>
                      <td className="px-5 py-3.5 text-gray-500">{f.postos?.secretaria ?? '—'}</td>
                      <td className="px-5 py-3.5">
                        {supLabel ? (
                          <span
                            className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700"
                            title={f.supervisor_nome ?? undefined}
                          >
                            {supLabel}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {badge ? (
                          <div className="flex flex-col gap-0.5">
                            <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', badge.className)}>
                              {badge.label}
                            </span>
                            {f.status === 'afastado' && f.motivo_afastamento === 'inss' && (
                              <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-700 ring-1 ring-inset ring-purple-200">
                                INSS
                              </span>
                            )}
                            {(f.status === 'afastado' || f.status === 'atestado') && f.origem_ocupacional_cat && (
                              <span className="text-[10px] font-semibold text-orange-600 pl-0.5">
                                {ORIGEM_SUBTEXT[f.origem_ocupacional_cat] ?? f.origem_ocupacional_cat}
                              </span>
                            )}
                            {faltasAtivas?.[f.id] && (
                              <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                                Falta
                              </span>
                            )}
                            {coberturaSubstitutos?.[f.id] && (
                              <span className="inline-flex items-center rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-semibold text-teal-700 ring-1 ring-inset ring-teal-200">
                                Em Cobertura
                              </span>
                            )}
                            {coberturaAusentes?.[f.id] && (
                              <span className="inline-flex items-center rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-semibold text-teal-700 ring-1 ring-inset ring-teal-200">
                                Sendo Coberto
                              </span>
                            )}
                          </div>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          {isAdmin && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditarFuncionario(f)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Editar
                            </Button>
                          )}
                          {(f.status === 'ativo' || f.status === 'atestado' || f.status === 'afastado') && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setAtestadoFuncionario(f)}
                              disabled={!f.posto_id}
                              title={!f.posto_id ? 'Sem posto vinculado' : undefined}
                            >
                              <FileMinus className="h-3.5 w-3.5" />
                              Atestado
                            </Button>
                          )}
                          {f.status === 'ativo' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setAfastarFuncionario(f)}
                            >
                              <UserMinus className="h-3.5 w-3.5" />
                              Afastar
                            </Button>
                          )}
                          {f.status === 'faltante' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-rose-400 text-rose-700 hover:bg-rose-50"
                              onClick={async () => {
                                if (!confirm(`Confirmar retorno de ${f.nome}?`)) return
                                const res = await marcarRetornoFaltante(f.id)
                                if (!res.success) alert(res.error ?? 'Erro ao registrar retorno')
                              }}
                            >
                              <UserCheck className="h-3.5 w-3.5" />
                              Retornou
                            </Button>
                          )}
                          {f.status !== 'desligado' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSolicitarFuncionario(f)}
                            >
                              <ClipboardList className="h-3.5 w-3.5" />
                              Solicitar
                            </Button>
                          )}
                          <Link
                            href={`/efetivo/${f.id}`}
                            className={buttonVariants({ size: 'sm', variant: 'outline' })}
                          >
                            <ArrowUpRight className="h-3.5 w-3.5" />
                            Ver perfil
                          </Link>
                          <Link
                            href={`/efetivo/${f.id}/historico`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={buttonVariants({ size: 'sm', variant: 'outline' })}
                            title="Prontuário"
                          >
                            <Clock className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {atestadoFuncionario && (
        <ModalAtestado
          open
          onClose={() => setAtestadoFuncionario(null)}
          funcionario={atestadoFuncionario}
          cids={cids}
        />
      )}

      {afastarFuncionario && (
        <ModalAfastar
          open
          onClose={() => setAfastarFuncionario(null)}
          funcionario={afastarFuncionario}
        />
      )}

      {solicitarFuncionario && (
        <ModalNovaSolicitacao
          open
          onClose={() => setSolicitarFuncionario(null)}
          funcionario={solicitarFuncionario}
          postos={postos}
          funcoes={funcoes}
        />
      )}

      {editarFuncionario && (
        <ModalEditarFuncionario
          key={editarFuncionario.id}
          open
          onClose={() => setEditarFuncionario(null)}
          funcionario={editarFuncionario}
          postos={postos}
          funcoes={funcoes}
        />
      )}
    </>
  )
}
