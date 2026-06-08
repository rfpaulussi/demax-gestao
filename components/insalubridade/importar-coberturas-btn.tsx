'use client'

import { useTransition } from 'react'
import { importarDasCoberturas } from '@/app/(admin)/insalubridade/actions'

interface Props { mes: number; ano: number }

export function ImportarCoberturasBtn({ mes, ano }: Props) {
  const [pending, start] = useTransition()

  return (
    <button
      onClick={() => start(async () => {
        const r = await importarDasCoberturas(mes, ano)
        if (r.importados === 0) alert('Nenhuma cobertura insalubre nova encontrada para este mês.')
        else alert(`${r.importados} registro${r.importados !== 1 ? 's' : ''} importado${r.importados !== 1 ? 's' : ''} com sucesso.`)
      })}
      disabled={pending}
      className="flex h-9 items-center rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
    >
      {pending ? 'Importando...' : 'Importar das Coberturas'}
    </button>
  )
}
