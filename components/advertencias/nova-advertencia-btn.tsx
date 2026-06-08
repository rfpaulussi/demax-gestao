'use client'

import { useState } from 'react'
import { ModalAdvertencia } from './modal-advertencia'
import type { FuncionarioOpt } from '@/app/(admin)/advertencias/actions'

interface Props {
  funcionarios: FuncionarioOpt[]
  reincidencias: Record<string, number>
}

export function NovaAdvertenciaBtn({ funcionarios, reincidencias }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-9 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-700"
      >
        + Nova Advertência
      </button>
      <ModalAdvertencia
        open={open}
        onClose={() => setOpen(false)}
        funcionarios={funcionarios}
        reincidencias={reincidencias}
      />
    </>
  )
}
