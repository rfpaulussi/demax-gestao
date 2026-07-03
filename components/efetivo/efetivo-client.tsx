'use client'

import { useState, useMemo } from 'react'
import { FileSpreadsheet, UserPlus } from 'lucide-react'
import { ModalAdmitirAdmin } from './modal-admitir-admin'
import { FiltrosEfetivo } from './filtros-efetivo'
import type { FiltrosValues, FiltrosCounts } from './filtros-efetivo'
import { FuncionariosTable } from './funcionarios-table'
import type { FuncionarioRow } from './funcionarios-table'
import { exportToExcel } from '@/lib/export-excel'

const STATUS_LABELS: Record<string, string> = {
  ativo:     'Ativo',
  afastado:  'Afastado',
  ferias:    'Férias',
  desligado: 'Desligado',
}

const STATUS_COLORS: Record<string, { fill: string; color: string }> = {
  ativo:     { fill: 'F0FDF4', color: '15803D' },
  afastado:  { fill: 'FFF1F2', color: 'B91C1C' },
  ferias:    { fill: 'FFF7ED', color: 'C2410C' },
  desligado: { fill: 'F3F4F6', color: '6B7280' },
}

function todayFilename() {
  const d = new Date()
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `efetivo_${dd}${mm}${yyyy}.xlsx`
}

interface Props {
  funcionarios: FuncionarioRow[]
  supervisores: { id: string; nome: string | null }[]
  postos: { id: string; nome: string; secretaria: string | null }[]
  funcoes: { id: string; nome: string }[]
  cids: { codigo: string; descricao: string }[]
  isAdmin?: boolean
  faltasAtivas?: Record<string, boolean>
  coberturaSubstitutos?: Record<string, boolean>
  coberturaAusentes?: Record<string, boolean>
}

export function EfetivoClient({ funcionarios, supervisores, postos, funcoes, cids, isAdmin, faltasAtivas, coberturaSubstitutos, coberturaAusentes }: Props) {
  const [values, setValues] = useState<FiltrosValues>({
    busca: '', status: '', secretaria: '', supervisor: '', posto: '',
  })
  const [sortCol, setSortCol] = useState<string>('nome')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [admitirOpen, setAdmitirOpen] = useState(false)

  function toggleSort(col: string) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

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
    if (q)               list = list.filter(f => f.nome.toLowerCase().includes(q) || (f.registro ?? '').includes(q))
    if (values.status)   list = list.filter(f => f.status === values.status)
    if (values.secretaria) list = list.filter(f => f.postos?.secretaria === values.secretaria)
    if (values.supervisor === 'sem_supervisor') {
      list = list.filter(f => !f.supervisor_id)
    } else if (values.supervisor) {
      list = list.filter(f => f.supervisor_id === values.supervisor)
    }
    if (values.posto) list = list.filter(f => (f.postos?.nome ?? '').toLowerCase().includes(values.posto.toLowerCase()))
    return list
  }, [funcionarios, values])

  const sorted = useMemo(() => {
    const list = [...filtered]
    list.sort((a, b) => {
      let av = '', bv = ''
      if (sortCol === 'nome')       { av = a.nome ?? '';                bv = b.nome ?? ''                }
      if (sortCol === 'funcao')     { av = a.funcoes?.nome ?? '';       bv = b.funcoes?.nome ?? ''       }
      if (sortCol === 'posto')      { av = a.postos?.nome ?? '';        bv = b.postos?.nome ?? ''        }
      if (sortCol === 'secretaria') { av = a.postos?.secretaria ?? '';  bv = b.postos?.secretaria ?? ''  }
      if (sortCol === 'status')     { av = a.status ?? '';              bv = b.status ?? ''              }
      const cmp = av.localeCompare(bv, 'pt-BR', { sensitivity: 'base' })
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [filtered, sortCol, sortDir])

  const counts = useMemo<FiltrosCounts>(() => {
    const statusCounts: Record<string, number> = {}
    const secretariaCounts: Record<string, number> = {}
    const supervisorCounts: Record<string, number> = {}
    const postoCounts: Record<string, number> = {}
    let semSupervisorCount = 0
    for (const f of funcionarios) {
      if (f.status) statusCounts[f.status] = (statusCounts[f.status] ?? 0) + 1
      const sec = f.postos?.secretaria
      if (sec) secretariaCounts[sec] = (secretariaCounts[sec] ?? 0) + 1
      if (f.posto_id) postoCounts[f.posto_id] = (postoCounts[f.posto_id] ?? 0) + 1
      if (f.supervisor_id) {
        supervisorCounts[f.supervisor_id] = (supervisorCounts[f.supervisor_id] ?? 0) + 1
      } else {
        semSupervisorCount++
      }
    }
    return { statusCounts, secretariaCounts, supervisorCounts, semSupervisorCount, postoCounts }
  }, [funcionarios])

  function handleChange(key: keyof FiltrosValues, value: string) {
    setValues(prev => ({ ...prev, [key]: value }))
  }

  function handleExport() {
    exportToExcel(
      sorted,
      [
        { label: 'Registro',   value: r => r.registro ?? '', asText: true },
        { label: 'Nome',       value: r => r.nome },
        { label: 'Função',     value: r => r.funcoes?.nome ?? '' },
        { label: 'Posto',      value: r => r.postos?.nome ?? '' },
        { label: 'Secretaria', value: r => r.postos?.secretaria ?? '' },
        { label: 'Supervisor', value: r => r.supervisor_nome ?? '' },
        {
          label: 'Status',
          value: r => STATUS_LABELS[r.status ?? ''] ?? '',
          cellStyle: r => STATUS_COLORS[r.status ?? ''],
        },
      ],
      todayFilename(),
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1">
          <FiltrosEfetivo
            secretarias={secretarias}
            supervisores={supervisores}
            postos={postos}
            counts={counts}
            values={values}
            onChange={handleChange}
          />
        </div>
        <button
          onClick={handleExport}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 text-sm font-medium text-green-700 shadow-sm hover:bg-green-100"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Exportar Excel
        </button>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setAdmitirOpen(true)}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <UserPlus className="h-4 w-4" />
            Admitir Funcionário
          </button>
        )}
      </div>
      <FuncionariosTable
        funcionarios={sorted}
        postos={postos}
        funcoes={funcoes}
        cids={cids}
        sortCol={sortCol}
        sortDir={sortDir}
        onSort={toggleSort}
        isAdmin={isAdmin}
        faltasAtivas={faltasAtivas}
        coberturaSubstitutos={coberturaSubstitutos}
        coberturaAusentes={coberturaAusentes}
      />
      <ModalAdmitirAdmin
        open={admitirOpen}
        onClose={() => setAdmitirOpen(false)}
        postos={postos}
        funcoes={funcoes}
      />
    </div>
  )
}
