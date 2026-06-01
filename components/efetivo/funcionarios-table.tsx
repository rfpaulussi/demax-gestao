'use client'

import { useState } from 'react'
import { FileMinus, Umbrella, UserMinus, UserX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ModalAtestado } from './modal-atestado'
import { ModalFerias } from './modal-ferias'
import { ModalAfastar } from './modal-afastar'
import { ModalDesligar } from './modal-desligar'

export type FuncionarioRow = {
  id: string
  nome: string
  cpf: string | null
  status: 'ativo' | 'afastado' | 'ferias' | 'desligado' | null
  data_admissao: string | null
  posto_id: string | null
  funcoes: { id: string; nome: string } | null
  postos: { id: string; nome: string; secretaria: string | null } | null
}

type ModalType = 'atestado' | 'ferias' | 'afastar' | 'desligar'
type ActiveModal = { type: ModalType; funcionario: FuncionarioRow } | null

const STATUS_BADGE: Record<
  NonNullable<FuncionarioRow['status']>,
  { label: string; className: string }
> = {
  ativo:     { label: 'Ativo',     className: 'bg-green-50 text-green-700 ring-green-200'    },
  afastado:  { label: 'Afastado',  className: 'bg-red-50 text-red-700 ring-red-200'          },
  ferias:    { label: 'Férias',    className: 'bg-orange-50 text-orange-700 ring-orange-200'  },
  desligado: { label: 'Desligado', className: 'bg-gray-100 text-gray-500 ring-gray-200'      },
}

const COLS = ['Nome', 'Função', 'Posto', 'Secretaria', 'Status', 'Ações']

export function FuncionariosTable({
  funcionarios,
}: {
  funcionarios: FuncionarioRow[]
}) {
  const [activeModal, setActiveModal] = useState<ActiveModal>(null)

  function openModal(type: ModalType, funcionario: FuncionarioRow) {
    setActiveModal({ type, funcionario })
  }

  function closeModal() {
    setActiveModal(null)
  }

  const selected = activeModal?.funcionario ?? null

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
              <thead className="border-b border-gray-100">
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
                  const badge = f.status ? STATUS_BADGE[f.status] : null
                  return (
                    <tr key={f.id} className="transition-colors hover:bg-gray-50">
                      <td className="px-5 py-3.5 font-medium text-gray-900">
                        {f.nome}
                        {f.cpf && (
                          <span className="block text-xs font-normal text-gray-400">
                            {f.cpf}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">
                        {f.funcoes?.nome ?? '—'}
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">
                        {f.postos?.nome ?? '—'}
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">
                        {f.postos?.secretaria ?? '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        {badge ? (
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
                              badge.className,
                            )}
                          >
                            {badge.label}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openModal('atestado', f)}
                            disabled={!f.posto_id}
                            title={!f.posto_id ? 'Sem posto vinculado' : undefined}
                          >
                            <FileMinus className="h-3.5 w-3.5" />
                            Atestado
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openModal('ferias', f)}
                          >
                            <Umbrella className="h-3.5 w-3.5" />
                            Férias
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openModal('afastar', f)}
                          >
                            <UserMinus className="h-3.5 w-3.5" />
                            Afastar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => openModal('desligar', f)}
                          >
                            <UserX className="h-3.5 w-3.5" />
                            Desligar
                          </Button>
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

      {selected && (
        <>
          <ModalAtestado
            open={activeModal?.type === 'atestado'}
            onClose={closeModal}
            funcionario={selected}
          />
          <ModalFerias
            open={activeModal?.type === 'ferias'}
            onClose={closeModal}
            funcionario={selected}
          />
          <ModalAfastar
            open={activeModal?.type === 'afastar'}
            onClose={closeModal}
            funcionario={selected}
          />
          <ModalDesligar
            open={activeModal?.type === 'desligar'}
            onClose={closeModal}
            funcionario={selected}
          />
        </>
      )}
    </>
  )
}
