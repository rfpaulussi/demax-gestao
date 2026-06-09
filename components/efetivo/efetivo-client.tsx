'use client'

import { useState, useMemo } from 'react'
import { FiltrosEfetivo } from './filtros-efetivo'
import type { FiltrosValues, FiltrosCounts } from './filtros-efetivo'
import { FuncionariosTable } from './funcionarios-table'
import type { FuncionarioRow } from './funcionarios-table'

interface Props {
  funcionarios: FuncionarioRow[]
  supervisores: { id: string; nome: string | null }[]
  postos: { id: string; nome: string }[]
  funcoes: { id: string; nome: string }[]
}

export function EfetivoClient({ funcionarios, supervisores, postos, funcoes }: Props) {
  const [values, setValues] = useState<FiltrosValues>({
    busca: '', status: '', secretaria: '', supervisor: '',
  })

  const secretarias = useMemo(
    () =>
      Array.from(
        new Set(
          funcionarios
            .map(f => f.postos?.secretaria)
            .filter((s): s is string => Boolean(s)),
        ),
      ).sort(),
    [funcionarios],
  )

  const filtered = useMemo(() => {
    let list = funcionarios
    const q = values.busca.trim().toLowerCase()
    if (q)               list = list.filter(f => f.nome.toLowerCase().includes(q))
    if (values.status)   list = list.filter(f => f.status === values.status)
    if (values.secretaria) list = list.filter(f => f.postos?.secretaria === values.secretaria)
    if (values.supervisor === 'sem_supervisor') {
      list = list.filter(f => !f.supervisor_id)
    } else if (values.supervisor) {
      list = list.filter(f => f.supervisor_id === values.supervisor)
    }
    return list
  }, [funcionarios, values])

  const counts = useMemo<FiltrosCounts>(() => {
    const statusCounts: Record<string, number> = {}
    const secretariaCounts: Record<string, number> = {}
    const supervisorCounts: Record<string, number> = {}
    let semSupervisorCount = 0
    for (const f of funcionarios) {
      if (f.status) statusCounts[f.status] = (statusCounts[f.status] ?? 0) + 1
      const sec = f.postos?.secretaria
      if (sec) secretariaCounts[sec] = (secretariaCounts[sec] ?? 0) + 1
      if (f.supervisor_id) {
        supervisorCounts[f.supervisor_id] = (supervisorCounts[f.supervisor_id] ?? 0) + 1
      } else {
        semSupervisorCount++
      }
    }
    return { statusCounts, secretariaCounts, supervisorCounts, semSupervisorCount }
  }, [funcionarios])

  function handleChange(key: keyof FiltrosValues, value: string) {
    setValues(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="space-y-6">
      <FiltrosEfetivo
        secretarias={secretarias}
        supervisores={supervisores}
        counts={counts}
        values={values}
        onChange={handleChange}
      />
      <FuncionariosTable funcionarios={filtered} postos={postos} funcoes={funcoes} />
    </div>
  )
}
