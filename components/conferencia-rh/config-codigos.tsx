'use client'

import { useState } from 'react'
import { salvarConfigCodigoRH } from '@/app/(admin)/conferencia-rh/actions'

type ConfigCodigo = { codigo: number; apelido: string; supervisor_id: string | null }
type Supervisor = { id: string; nome: string | null }

export function ConfigCodigos({ codigos, supervisores }: { codigos: ConfigCodigo[]; supervisores: Supervisor[] }) {
  const [salvando, setSalvando] = useState<number | null>(null)
  const [valores, setValores] = useState<Record<number, string>>(
    Object.fromEntries(codigos.map(c => [c.codigo, c.supervisor_id ?? '']))
  )

  async function onChange(codigo: number, supervisorId: string) {
    setValores(v => ({ ...v, [codigo]: supervisorId }))
    setSalvando(codigo)
    await salvarConfigCodigoRH(codigo, supervisorId || null)
    setSalvando(null)
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">
        Configuração de Códigos RH → Supervisor
      </h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-400">
            <th scope="col" className="pb-2">Código</th>
            <th scope="col" className="pb-2">Apelido</th>
            <th scope="col" className="pb-2">Supervisor vinculado</th>
          </tr>
        </thead>
        <tbody>
          {codigos.map(c => (
            <tr key={c.codigo} className="border-t border-gray-50">
              <td className="py-2 text-xs text-gray-700">{c.codigo}</td>
              <td className="py-2 text-xs font-medium text-gray-900">{c.apelido}</td>
              <td className="py-2">
                <select
                  value={valores[c.codigo] ?? ''}
                  onChange={e => onChange(c.codigo, e.target.value)}
                  className="h-8 rounded-lg border border-gray-200 px-2 text-xs"
                >
                  <option value="">— não vinculado —</option>
                  {supervisores.map(s => (
                    <option key={s.id} value={s.id}>{s.nome}</option>
                  ))}
                </select>
                {salvando === c.codigo && <span className="ml-2 text-[10px] text-gray-400">salvando...</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
