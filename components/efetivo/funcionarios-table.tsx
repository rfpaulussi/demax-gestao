'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FileMinus, ArrowUpRight, ClipboardList } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ModalAtestado } from './modal-atestado'
import { ModalNovaSolicitacao } from './modal-nova-solicitacao'

export type FuncionarioRow = {
  id: string
  nome: string
  cpf: string | null
  status: 'ativo' | 'afastado' | 'ferias' | 'desligado' | null
  data_admissao: string | null
  posto_id: string | null
  funcoes: { id: string; nome: string } | null
  postos: { id: string; nome: string; secretaria: string | null } | null
  supervisor_nome?: string | null
  supervisor_id?: string | null
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
  ativo:     { label: 'Ativo',     className: 'bg-green-50 text-green-700 ring-green-200'    },
  afastado:  { label: 'Afastado',  className: 'bg-red-50 text-red-700 ring-red-200'          },
  ferias:    { label: 'Férias',    className: 'bg-orange-50 text-orange-700 ring-orange-200' },
  desligado: { label: 'Desligado', className: 'bg-gray-100 text-gray-500 ring-gray-200'      },
}

const STATUS_ROW: Record<
  NonNullable<FuncionarioRow['status']>,
  { bg: string; hover: string; borderLeft: string; dimmed: boolean }
> = {
  ativo:     { bg: 'bg-white',    hover: 'hover:bg-gray-50',   borderLeft: '',                                   dimmed: false },
  afastado:  { bg: 'bg-amber-50', hover: 'hover:bg-amber-100', borderLeft: 'border-l-[3px] border-l-amber-400', dimmed: false },
  ferias:    { bg: 'bg-blue-50',  hover: 'hover:bg-blue-100',  borderLeft: 'border-l-[3px] border-l-blue-400',  dimmed: false },
  desligado: { bg: 'bg-gray-50',  hover: 'hover:bg-gray-100',  borderLeft: '',                                   dimmed: true  },
}

const COLS = ['Nome', 'Função', 'Posto', 'Secretaria', 'Supervisor', 'Status', 'Ações']

export function FuncionariosTable({
  funcionarios,
  postos,
  funcoes,
}: {
  funcionarios: FuncionarioRow[]
  postos: { id: string; nome: string }[]
  funcoes: { id: string; nome: string }[]
}) {
  const [atestadoFuncionario, setAtestadoFuncionario]     = useState<FuncionarioRow | null>(null)
  const [solicitarFuncionario, setSolicitarFuncionario]   = useState<FuncionarioRow | null>(null)

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
                  {COLS.map(h => (
                    <th
                      key={h}
                      className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {funcionarios.map(f => {
                  const badge    = f.status ? STATUS_BADGE[f.status] : null
                  const rowStyle = f.status ? STATUS_ROW[f.status] : null
                  const supLabel = fmtSupervisor(f.supervisor_nome)

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
                          <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', badge.className)}>
                            {badge.label}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
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
    </>
  )
}
