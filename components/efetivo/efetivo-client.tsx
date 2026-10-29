'use client'

import { useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { FileSpreadsheet, UserPlus } from 'lucide-react'
import { ModalAdmitirAdmin } from './modal-admitir-admin'
import { FiltrosEfetivo } from './filtros-efetivo'
import type { FiltrosValues, FiltrosCounts } from './filtros-efetivo'
import { FuncionariosTable } from './funcionarios-table'
import type { FuncionarioRow } from './funcionarios-table'
import { exportToExcelSheets } from '@/lib/export-excel'

const STATUS_LABELS: Record<string, string> = {
  ativo:             'Ativo',
  atestado:          'Atestado',
  afastado:          'Afastado',
  ferias:            'Férias',
  faltante:          'Faltante',
  desligado:         'Desligado',
  rescisao_indireta: 'Rescisão Indireta',
}

const STATUS_COLORS: Record<string, { fill: string; color: string }> = {
  ativo:             { fill: 'F0FDF4', color: '15803D' },
  atestado:          { fill: 'FFFBEB', color: 'B45309' },
  afastado:          { fill: 'FFF1F2', color: 'B91C1C' },
  ferias:            { fill: 'FFF7ED', color: 'C2410C' },
  faltante:          { fill: 'FFFBEB', color: 'B45309' },
  desligado:         { fill: 'F3F4F6', color: '6B7280' },
  rescisao_indireta: { fill: 'FAF5FF', color: '7E22CE' },
}

const REGIME_COLORS: Record<string, { fill: string; color: string }> = {
  '5x2':            { fill: 'EFF6FF', color: '1D4ED8' },
  '5x1':            { fill: 'FAF5FF', color: '7E22CE' },
  '6x1':            { fill: 'FDF2F8', color: 'BE185D' },
  '12x36':          { fill: 'FFF7ED', color: 'C2410C' },
  'jovem_aprendiz':  { fill: 'F0FDFA', color: '0F766E' },
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
  podeIgnorarAfastado?: boolean
  faltasAtivas?: Record<string, boolean>
  coberturaSubstitutos?: Record<string, boolean>
  coberturaAusentes?: Record<string, boolean>
}

export function EfetivoClient({ funcionarios, supervisores, postos, funcoes, cids, isAdmin, podeIgnorarAfastado, faltasAtivas, coberturaSubstitutos, coberturaAusentes }: Props) {
  const searchParams = useSearchParams()
  const buscaInicial = searchParams.get('busca') ?? ''
  const [values, setValues] = useState<FiltrosValues>({
    busca: buscaInicial, status: '', secretaria: '', supervisor: '', posto: '', nivelRisco: '',
  })
  const [sortCol, setSortCol] = useState<string>('risco')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
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
    if (values.nivelRisco) list = list.filter(f => f.status !== 'desligado' && f.nivel_risco === values.nivelRisco)
    return list
  }, [funcionarios, values])

  const sorted = useMemo(() => {
    const list = [...filtered]
    list.sort((a, b) => {
      if (sortCol === 'risco') {
        const cmp = (a.score_risco ?? 0) - (b.score_risco ?? 0)
        return sortDir === 'asc' ? cmp : -cmp
      }
      if (sortCol === 'retorno') {
        const av = a.data_fim_prevista_afastamento ?? ''
        const bv = b.data_fim_prevista_afastamento ?? ''
        if (!av && !bv) return 0
        if (!av) return 1
        if (!bv) return -1
        const cmp = av.localeCompare(bv)
        return sortDir === 'asc' ? cmp : -cmp
      }
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
    const nivelRiscoCounts: Record<string, number> = {}
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
      if (f.status !== 'desligado' && f.nivel_risco) {
        nivelRiscoCounts[f.nivel_risco] = (nivelRiscoCounts[f.nivel_risco] ?? 0) + 1
      }
    }
    return { statusCounts, secretariaCounts, supervisorCounts, semSupervisorCount, postoCounts, nivelRiscoCounts }
  }, [funcionarios])

  function handleChange(key: keyof FiltrosValues, value: string) {
    setValues(prev => ({ ...prev, [key]: value }))
  }

  type Cont = { total: number; status: Record<string, number>; pcd: number }
  type LinhaResumo = { supervisor: string; item: string; extra: string; cont: Cont; subtotal: boolean }

  function novoCont(): Cont { return { total: 0, status: {}, pcd: 0 } }

  // total = quadro sem desligados; desligados aparecem só na coluna própria
  function somar(c: Cont, f: FuncionarioRow) {
    const st = f.status ?? 'ativo'
    c.status[st] = (c.status[st] ?? 0) + 1
    if (st === 'desligado') return
    c.total++
    if (f.pcd) c.pcd++
  }

  function somarCont(destino: Cont, origem: Cont) {
    destino.total += origem.total
    destino.pcd += origem.pcd
    for (const [k, v] of Object.entries(origem.status)) destino.status[k] = (destino.status[k] ?? 0) + v
  }

  const collator = new Intl.Collator('pt-BR', { sensitivity: 'base' })
  // Posto SEDE tem grupo próprio (não entra na linha do supervisor responsável)
  const nomeSupervisor = (f: FuncionarioRow) =>
    f.postos?.nome?.trim().toUpperCase() === 'SEDE'
      ? 'SEDE'
      : f.supervisor_id ? (f.supervisor_nome ?? '(sem nome)') : 'Sem supervisor'

  // Análise 1: uma linha por supervisor
  function buildResumoSupervisores() {
    const map = new Map<string, { cont: Cont; postos: Set<string>; funcoes: Set<string> }>()
    for (const f of funcionarios) {
      const nome = nomeSupervisor(f)
      let r = map.get(nome)
      if (!r) { r = { cont: novoCont(), postos: new Set(), funcoes: new Set() }; map.set(nome, r) }
      somar(r.cont, f)
      if (f.status !== 'desligado') {
        if (f.postos?.nome) r.postos.add(f.postos.nome)
        if (f.funcoes?.nome) r.funcoes.add(f.funcoes.nome)
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => collator.compare(a[0], b[0]))
      .map(([supervisor, r]) => ({ supervisor, cont: r.cont, qtdPostos: r.postos.size, qtdFuncoes: r.funcoes.size }))
  }

  // Análises 2 e 3: supervisor x (função | posto), com subtotal por supervisor
  function buildDetalhe(itemDe: (f: FuncionarioRow) => string, extraDe: (f: FuncionarioRow) => string): LinhaResumo[] {
    const sup = new Map<string, Map<string, { extra: string; cont: Cont }>>()
    for (const f of funcionarios) {
      const nome = nomeSupervisor(f)
      let itens = sup.get(nome)
      if (!itens) { itens = new Map(); sup.set(nome, itens) }
      const item = itemDe(f)
      let it = itens.get(item)
      if (!it) { it = { extra: extraDe(f), cont: novoCont() }; itens.set(item, it) }
      somar(it.cont, f)
    }
    const linhas: LinhaResumo[] = []
    for (const [supervisor, itens] of Array.from(sup.entries()).sort((a, b) => collator.compare(a[0], b[0]))) {
      const subtotal = novoCont()
      const ordenados = Array.from(itens.entries()).sort((a, b) => b[1].cont.total - a[1].cont.total || collator.compare(a[0], b[0]))
      for (const [item, it] of ordenados) {
        linhas.push({ supervisor, item, extra: it.extra, cont: it.cont, subtotal: false })
        somarCont(subtotal, it.cont)
      }
      linhas.push({ supervisor, item: 'TOTAL', extra: '', cont: subtotal, subtotal: true })
    }
    return linhas
  }

  // Análises 4 e 5: agrupamento simples (secretaria | função) sem supervisor
  function buildGrupo(itemDe: (f: FuncionarioRow) => string): LinhaResumo[] {
    const map = new Map<string, Cont>()
    for (const f of funcionarios) {
      const item = itemDe(f)
      let c = map.get(item)
      if (!c) { c = novoCont(); map.set(item, c) }
      somar(c, f)
    }
    const linhas = Array.from(map.entries())
      .sort((a, b) => b[1].total - a[1].total || collator.compare(a[0], b[0]))
      .map(([item, cont]): LinhaResumo => ({ supervisor: '', item, extra: '', cont, subtotal: false }))
    const geral = novoCont()
    for (const l of linhas) somarCont(geral, l.cont)
    linhas.push({ supervisor: '', item: 'TOTAL', extra: '', cont: geral, subtotal: true })
    return linhas
  }

  const SUBTOTAL_STYLE = { fill: 'E2E8F0', color: '0F172A' }
  const pct = (parte: number, total: number) => (total > 0 ? Math.round((parte / total) * 1000) / 10 : 0)

  // Colunas padrão de análise: total, um por status, PCD, % ativos e % ausentes
  function colunasAnalise<T>(get: (r: T) => Cont, sub: (r: T) => boolean) {
    const st = (r: T) => (sub(r) ? SUBTOTAL_STYLE : undefined)
    return [
      { label: 'Total (sem desligados)', value: (r: T) => get(r).total, cellStyle: st },
      ...Object.keys(STATUS_LABELS).map(k => ({
        label: STATUS_LABELS[k],
        value: (r: T) => get(r).status[k] ?? 0,
        cellStyle: (r: T) => (sub(r) ? SUBTOTAL_STYLE : get(r).status[k] ? STATUS_COLORS[k] : undefined),
      })),
      { label: 'PCD', value: (r: T) => get(r).pcd, cellStyle: st },
      { label: '% Ativos', value: (r: T) => pct(get(r).status.ativo ?? 0, get(r).total), cellStyle: st },
      { label: '% Ausentes', value: (r: T) => pct(get(r).total - (get(r).status.ativo ?? 0), get(r).total), cellStyle: st },
    ]
  }

  function handleExport() {
    const resumo = buildResumoSupervisores()
    const porSupFuncao = buildDetalhe(f => f.funcoes?.nome ?? "Sem função", () => "")
    const porSupPosto = buildDetalhe(f => f.postos?.nome ?? "Sem posto", f => f.postos?.secretaria ?? "")
    const porSecretaria = buildGrupo(f => f.postos?.secretaria ?? "Sem secretaria")
    const porFuncao = buildGrupo(f => f.funcoes?.nome ?? "Sem função")
    exportToExcelSheets([
      {
        name: 'Efetivo',
        data: sorted,
        columns: [
        { label: 'Registro',   value: r => r.registro ?? '', asText: true },
        { label: 'Nome',       value: r => r.nome },
        {
          label: 'PCD',
          value: r => r.pcd ? (r.pcd_tipo === 'Outra' && r.pcd_tipo_outro ? `Outra (${r.pcd_tipo_outro})` : r.pcd_tipo ?? 'Sim') : '',
          cellStyle: r => r.pcd ? { fill: 'FFFBEB', color: 'B45309' } : undefined,
        },
        { label: 'Função',     value: r => r.funcoes?.nome ?? '' },
        { label: 'Posto',      value: r => r.postos?.nome ?? '' },
        { label: 'Secretaria', value: r => r.postos?.secretaria ?? '' },
        { label: 'Supervisor', value: r => r.supervisor_nome ?? '' },
        {
          label: 'Status',
          value: r => STATUS_LABELS[r.status ?? ''] ?? '',
          cellStyle: r => STATUS_COLORS[r.status ?? ''],
        },
        { label: 'Turno',    value: r => r.turno_atual_nome ?? '' },
        {
          label: 'Horário',
          value: r => r.turno_atual_resumo ?? '',
          cellStyle: r => r.turno_atual_regime ? REGIME_COLORS[r.turno_atual_regime] : undefined,
        },
        ],
      },
      {
        name: 'Resumo Supervisores',
        data: resumo,
        columns: [
          { label: 'Supervisor', value: r => r.supervisor },
          ...colunasAnalise<typeof resumo[number]>(r => r.cont, () => false),
          { label: 'Qtd. Postos', value: r => r.qtdPostos },
          { label: 'Qtd. Funções', value: r => r.qtdFuncoes },
        ],
      },
      {
        name: 'Supervisor x Função',
        data: porSupFuncao,
        columns: [
          { label: 'Supervisor', value: r => r.supervisor, cellStyle: r => (r.subtotal ? SUBTOTAL_STYLE : undefined) },
          { label: 'Função', value: r => r.item, cellStyle: r => (r.subtotal ? SUBTOTAL_STYLE : undefined) },
          ...colunasAnalise<LinhaResumo>(r => r.cont, r => r.subtotal),
        ],
      },
      {
        name: 'Supervisor x Posto',
        data: porSupPosto,
        columns: [
          { label: 'Supervisor', value: r => r.supervisor, cellStyle: r => (r.subtotal ? SUBTOTAL_STYLE : undefined) },
          { label: 'Posto', value: r => r.item, cellStyle: r => (r.subtotal ? SUBTOTAL_STYLE : undefined) },
          { label: 'Secretaria', value: r => r.extra, cellStyle: r => (r.subtotal ? SUBTOTAL_STYLE : undefined) },
          ...colunasAnalise<LinhaResumo>(r => r.cont, r => r.subtotal),
        ],
      },
      {
        name: 'Por Secretaria',
        data: porSecretaria,
        columns: [
          { label: 'Secretaria', value: r => r.item, cellStyle: r => (r.subtotal ? SUBTOTAL_STYLE : undefined) },
          ...colunasAnalise<LinhaResumo>(r => r.cont, r => r.subtotal),
        ],
      },
      {
        name: 'Por Função',
        data: porFuncao,
        columns: [
          { label: 'Função', value: r => r.item, cellStyle: r => (r.subtotal ? SUBTOTAL_STYLE : undefined) },
          ...colunasAnalise<LinhaResumo>(r => r.cont, r => r.subtotal),
        ],
      },
    ], todayFilename())
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
        podeIgnorarAfastado={podeIgnorarAfastado}
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
