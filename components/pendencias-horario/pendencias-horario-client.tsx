'use client'

import { useMemo, useState } from 'react'
import { Search, Check } from 'lucide-react'
import { atribuirHorarioPendente } from '@/app/(admin)/pendencias-horario/actions'
import { formatarResumoTurno, resolverTipoEscala, ESCALA_LABEL, ESCALA_BADGE_CLASS } from '@/lib/turnos/escala'
import { cn } from '@/lib/utils'

export type TurnoOpcao = {
  id: string
  nome: string
  hora_entrada: string
  hora_saida_seg_qui: string
  hora_saida_sex: string | null
  hora_inicio_almoco: string | null
  hora_fim_almoco: string | null
  tipo_escala: string
}

export type PendenteRow = {
  id: string
  nome: string
  funcao: string
  postoId: string
  postoNome: string
  supervisorNome: string
  dataAdmissao: string | null
  turnos: TurnoOpcao[]
}

const DIAS_CURSO_OPCOES = [
  { valor: 1, label: 'Segunda' },
  { valor: 2, label: 'Terça' },
  { valor: 3, label: 'Quarta' },
  { valor: 4, label: 'Quinta' },
  { valor: 5, label: 'Sexta' },
]

const inputClass =
  'flex h-9 rounded-lg border border-gray-200 bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'

function hoje(): string {
  return new Date().toISOString().slice(0, 10)
}

function FuncionarioRow({ row, onResolvido }: { row: PendenteRow; onResolvido: (id: string) => void }) {
  const [turnoId, setTurnoId] = useState('')
  const [dataInicio, setDataInicio] = useState(row.dataAdmissao ?? hoje())
  const [diaCurso, setDiaCurso] = useState('')
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const turnoSelecionado = row.turnos.find(t => t.id === turnoId)
  const ehJovemAprendiz = turnoSelecionado ? resolverTipoEscala(turnoSelecionado.tipo_escala) === 'jovem_aprendiz' : false

  async function salvar() {
    if (!turnoId || !dataInicio) return
    if (ehJovemAprendiz && !diaCurso) {
      setErro('Informe o dia de curso')
      return
    }
    setSaving(true)
    setErro(null)
    const res = await atribuirHorarioPendente(
      row.id,
      turnoId,
      dataInicio,
      ehJovemAprendiz ? Number(diaCurso) : undefined,
    )
    setSaving(false)
    if (!res.success) {
      setErro(res.error ?? 'Erro ao salvar')
      return
    }
    onResolvido(row.id)
  }

  return (
    <tr className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/60">
      <td className="px-4 py-3">
        <p className="text-sm font-semibold text-gray-800">{row.nome}</p>
        <p className="text-xs text-gray-400">{row.funcao}</p>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">{row.postoNome}</td>
      <td className="px-4 py-3 text-sm text-gray-600">{row.supervisorNome}</td>
      <td className="px-4 py-3">
        {row.turnos.length === 0 ? (
          <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600">
            Nenhum turno cadastrado neste posto
          </span>
        ) : (
          <select
            value={turnoId}
            onChange={e => { setTurnoId(e.target.value); setErro(null) }}
            className={cn(inputClass, 'w-full min-w-[16rem]')}
          >
            <option value="">Selecione o turno…</option>
            {row.turnos.map(t => (
              <option key={t.id} value={t.id}>
                {t.nome} — {formatarResumoTurno(t)}
              </option>
            ))}
          </select>
        )}
        {turnoSelecionado && (
          <span className={cn(
            'mt-1 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-inset',
            ESCALA_BADGE_CLASS[resolverTipoEscala(turnoSelecionado.tipo_escala)],
          )}>
            {ESCALA_LABEL[resolverTipoEscala(turnoSelecionado.tipo_escala)]}
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <input
          type="date"
          value={dataInicio}
          onChange={e => setDataInicio(e.target.value)}
          className={cn(inputClass, 'w-36')}
        />
      </td>
      <td className="px-4 py-3">
        {ehJovemAprendiz && (
          <select
            value={diaCurso}
            onChange={e => { setDiaCurso(e.target.value); setErro(null) }}
            className={cn(inputClass, 'w-32')}
          >
            <option value="">Dia do curso…</option>
            {DIAS_CURSO_OPCOES.map(d => (
              <option key={d.valor} value={d.valor}>{d.label}</option>
            ))}
          </select>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          onClick={salvar}
          disabled={saving || !turnoId || !dataInicio || row.turnos.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" />
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
        {erro && <p className="mt-1 text-xs text-red-600">{erro}</p>}
      </td>
    </tr>
  )
}

export function PendenciasHorarioClient({ rows: initialRows }: { rows: PendenteRow[] }) {
  const [resolvidos, setResolvidos] = useState<Set<string>>(new Set())
  const [busca, setBusca] = useState('')
  const [postoFiltro, setPostoFiltro] = useState('')
  const [supervisorFiltro, setSupervisorFiltro] = useState('')

  const rows = useMemo(() => initialRows.filter(r => !resolvidos.has(r.id)), [initialRows, resolvidos])

  const postos = useMemo(
    () => Array.from(new Set(initialRows.map(r => r.postoNome))).sort(),
    [initialRows],
  )

  const supervisores = useMemo(
    () => Array.from(new Set(initialRows.map(r => r.supervisorNome))).sort(),
    [initialRows],
  )

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return rows.filter(r =>
      (!termo || r.nome.toLowerCase().includes(termo)) &&
      (!postoFiltro || r.postoNome === postoFiltro) &&
      (!supervisorFiltro || r.supervisorNome === supervisorFiltro),
    )
  }, [rows, busca, postoFiltro, supervisorFiltro])

  function onResolvido(id: string) {
    setResolvidos(prev => new Set(prev).add(id))
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-t-4 border-gray-100 border-t-amber-500 bg-white p-5 shadow-sm">
          <p className="text-2xl font-black tracking-tight text-gray-900">{rows.length}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Pendentes</p>
        </div>
        <div className="rounded-xl border border-t-4 border-gray-100 border-t-green-500 bg-white p-5 shadow-sm">
          <p className="text-2xl font-black tracking-tight text-gray-900">{resolvidos.size}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Resolvidos agora</p>
        </div>
        <div className="rounded-xl border border-t-4 border-gray-100 border-t-red-500 bg-white p-5 shadow-sm">
          <p className="text-2xl font-black tracking-tight text-gray-900">
            {rows.filter(r => r.turnos.length === 0).length}
          </p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Sem turno no posto</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar funcionário…"
            className="text-sm focus:outline-none"
          />
        </div>
        <select value={postoFiltro} onChange={e => setPostoFiltro(e.target.value)} className={inputClass}>
          <option value="">Todos os postos</option>
          {postos.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select value={supervisorFiltro} onChange={e => setSupervisorFiltro(e.target.value)} className={inputClass}>
          <option value="">Todos os supervisores</option>
          {supervisores.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
        {filtrados.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400">
            {rows.length === 0 ? 'Nenhum funcionário pendente. Tudo certo por aqui.' : 'Nenhum funcionário encontrado.'}
          </p>
        ) : (
          <table className="w-full min-w-[980px] text-left">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-semibold uppercase tracking-widest text-gray-400">
                <th className="px-4 py-3">Funcionário</th>
                <th className="px-4 py-3">Posto</th>
                <th className="px-4 py-3">Supervisor</th>
                <th className="px-4 py-3">Turno</th>
                <th className="px-4 py-3">Início</th>
                <th className="px-4 py-3">Dia curso</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(row => (
                <FuncionarioRow key={row.id} row={row} onResolvido={onResolvido} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
