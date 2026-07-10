'use client'

import { useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { toggleAtivo } from '@/app/(admin)/usuarios/actions'

import type { Perfil, Role } from '@/types'
import { ModalNovoUsuario }    from './modal-novo-usuario'
import { ModalEditarUsuario }  from './modal-editar-usuario'
import { ModalResetarSenha }   from './modal-resetar-senha'

const ROLE_BADGE: Record<Role, { label: string; className: string }> = {
  admin:       { label: 'Admin',        className: 'bg-purple-50 text-purple-700 ring-purple-200' },
  coordenador: { label: 'Coordenador',  className: 'bg-blue-50 text-blue-700 ring-blue-200'       },
  supervisor:  { label: 'Supervisor',   className: 'bg-green-50 text-green-700 ring-green-200'    },
  viewer:      { label: 'Visualizador', className: 'bg-gray-50 text-gray-600 ring-gray-200'       },
}

const COLS = ['Nome', 'E-mail', 'Role', 'Status', 'Criado em', 'Ações']

function fmt(d: string) {
  return new Date(d).toLocaleDateString('pt-BR')
}

function ToggleAtivoButton({
  perfil,
  disabled,
}: {
  perfil: Perfil
  disabled: boolean
}) {
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition]  = useTransition()

  function handleConfirm() {
    const fd = new FormData()
    fd.set('perfil_id', perfil.id)
    fd.set('ativo', String(perfil.ativo))
    startTransition(() => {
      toggleAtivo(fd)
      setConfirming(false)
    })
  }

  if (confirming) {
    return (
      <span className="flex items-center gap-1.5">
        <span className="text-xs text-gray-500">Confirmar?</span>
        <button
          onClick={handleConfirm}
          disabled={pending}
          className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
        >
          Sim
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs text-gray-400 hover:underline"
        >
          Não
        </button>
      </span>
    )
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => setConfirming(true)}
      disabled={disabled || pending}
    >
      {perfil.ativo ? 'Desativar' : 'Ativar'}
    </Button>
  )
}

export function UsuariosTable({
  perfis,
  currentUserId,
}: {
  perfis: Perfil[]
  currentUserId: string
}) {
  const [showNovo, setShowNovo]         = useState(false)
  const [editando, setEditando]         = useState<Perfil | null>(null)
  const [resetando, setResetando]       = useState<string | null>(null)

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          {perfis.length} usuário{perfis.length !== 1 ? 's' : ''}
        </p>
        <Button size="sm" onClick={() => setShowNovo(true)}>
          <Plus className="h-4 w-4" />
          Novo Usuário
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        {perfis.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-gray-400">
            Nenhum usuário cadastrado.
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
                {perfis.map(p => {
                  const role  = p.role as Role | null
                  const badge = role ? ROLE_BADGE[role] : null
                  const isSelf = p.id === currentUserId

                  return (
                    <tr
                      key={p.id}
                      className={cn(
                        'transition-colors hover:bg-gray-50',
                        !p.ativo && 'opacity-60',
                      )}
                    >
                      <td className="px-5 py-3.5 font-medium text-gray-900">
                        {p.nome ?? '—'}
                        {isSelf && (
                          <span className="ml-2 text-xs text-gray-400">(você)</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">{p.email ?? '—'}</td>
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
                        ) : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
                            p.ativo
                              ? 'bg-green-50 text-green-700 ring-green-200'
                              : 'bg-gray-50 text-gray-500 ring-gray-200',
                          )}
                        >
                          {p.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">{p.created_at ? fmt(p.created_at) : '—'}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditando(p)}
                          >
                            Editar Role
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setResetando(p.id)}
                          >
                            Redefinir Senha
                          </Button>
                          <ToggleAtivoButton perfil={p} disabled={isSelf} />
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

      <ModalNovoUsuario    open={showNovo}          onClose={() => setShowNovo(false)}    />
      <ModalEditarUsuario  open={editando !== null}  onClose={() => setEditando(null)}  perfil={editando} />
      <ModalResetarSenha   open={resetando !== null} onClose={() => setResetando(null)} perfilId={resetando} />
    </>
  )
}
