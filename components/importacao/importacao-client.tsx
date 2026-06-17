'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx-js-style'
import {
  importarEventosHistorico,
  importarCoberturas,
  importarMudancasFuncao,
  importarAdvertencias,
  importarEfetivo,
} from '@/app/(admin)/importacao/actions'
import type {
  ImportResult,
  EventoHistoricoInput,
  CoberturaCsvRow,
  MudancaFuncaoRow,
  AdvertenciaRow,
  EfetivoRow,
} from '@/app/(admin)/importacao/actions'

// ─── CSV utils ────────────────────────────────────────────────

function norm(s: string): string {
  return (s ?? '').trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function parseCSV(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const wb = XLSX.read(text, { type: 'string', raw: false })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, unknown>[]
        resolve(rows)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsText(file, 'UTF-8')
  })
}

function parseCSVFindHeader(
  file: File,
  headerKey: string
): Promise<{ rows: Record<string, unknown>[]; error?: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        // Detect separator from the header line so TSV files (names with commas) work correctly
        const headerLine = text.split(/\r?\n/).find(l => l.includes(headerKey))
        const sep = headerLine?.includes('\t') ? '\t' : ','
        const wb = XLSX.read(text, { type: 'string', raw: false, FS: sep })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]
        const headerIdx = raw.findIndex(row =>
          row.some(cell => String(cell ?? '').trim() === headerKey)
        )
        if (headerIdx === -1) {
          resolve({ rows: [], error: 'Cabeçalho não encontrado. Verifique se o arquivo é o Log de Alocações Mensais.' })
          return
        }
        const headers = raw[headerIdx].map(h => String(h ?? '').trim())
        const rows = raw.slice(headerIdx + 1)
          .filter(row => row.some(cell => String(cell ?? '').trim() !== ''))
          .map(row => {
            const obj: Record<string, unknown> = {}
            headers.forEach((h, i) => { obj[h] = row[i] ?? '' })
            return obj
          })
        resolve({ rows })
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsText(file, 'UTF-8')
  })
}

function normalizarTexto(str: string): string {
  return str
    .replace(/Ã§/g, 'ç').replace(/Ã‡/g, 'Ç')
    .replace(/Ã£/g, 'ã').replace(/Ãƒ/g, 'Ã')
    .replace(/Ã¡/g, 'á').replace(/Ã /g, 'à')
    .replace(/Ã¢/g, 'â').replace(/Ã‚/g, 'Â')
    .replace(/Ã©/g, 'é').replace(/Ã¨/g, 'è')
    .replace(/Ãª/g, 'ê').replace(/ÃŠ/g, 'Ê')
    .replace(/Ã­/g, 'í').replace(/Ã³/g, 'ó')
    .replace(/Ã´/g, 'ô').replace(/Ã"/g, 'Ô')
    .replace(/Ãµ/g, 'õ').replace(/Ã•/g, 'Õ')
    .replace(/Ãº/g, 'ú').replace(/Ã¼/g, 'ü')
    .replace(/Ã/g, 'Î').replace(/Ã/g, 'Ý')
}

function parseDataFlexivel(valor: string): string | null {
  if (!valor || valor.trim() === '') return null

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(valor.trim())) {
    const [d, m, a] = valor.trim().split('/')
    return `${a}-${m}-${d}`
  }

  const serial = parseFloat(valor)
  if (!isNaN(serial) && serial > 40000) {
    const data = new Date((serial - 25569) * 86400 * 1000)
    const d = String(data.getUTCDate()).padStart(2, '0')
    const m = String(data.getUTCMonth() + 1).padStart(2, '0')
    const a = data.getUTCFullYear()
    return `${a}-${m}-${d}`
  }

  return null
}

function detectarDelimitador(linha: string): string {
  const tabs = (linha.match(/\t/g) || []).length
  const virgulas = (linha.match(/,/g) || []).length
  return tabs >= virgulas ? '\t' : ','
}

function parseCSVEfetivo(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const raw = e.target?.result as string
        const text = normalizarTexto(raw)
        const firstLine = text.split(/\r?\n/).find(l => l.trim() !== '') ?? ''
        const sep = detectarDelimitador(firstLine)
        const wb = XLSX.read(text, { type: 'string', raw: false, FS: sep })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, unknown>[]
        resolve(rows.map(row => {
          const clean: Record<string, unknown> = {}
          for (const [k, v] of Object.entries(row)) {
            clean[k.trim()] = typeof v === 'string' ? v.trim() : v
          }
          return clean
        }))
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsText(file, 'UTF-8')
  })
}

function getCol(row: Record<string, unknown>, ...keys: string[]): string {
  const normalized: Record<string, string> = {}
  for (const [k, v] of Object.entries(row)) {
    normalized[norm(k)] = String(v ?? '').trim()
  }
  for (const key of keys) {
    const v = normalized[norm(key)]
    if (v !== undefined && v !== '') return v
  }
  return ''
}

// Match by exact header name; falls back to trimmed-key comparison to handle
// BOM characters or stray whitespace that XLSX may leave in header strings.
function colByName(row: Record<string, unknown>, header: string): string {
  if (header in row) return String(row[header] ?? '').trim()
  const trimmed = header.trim()
  for (const [k, v] of Object.entries(row)) {
    if (k.trim() === trimmed) return String(v ?? '').trim()
  }
  return ''
}

function parseMesAnoKey(s: string): number {
  const [mm, yyyy] = (s ?? '').split('/')
  return parseInt((yyyy ?? '0') + (mm ?? '00').padStart(2, '0'))
}

function mesAnoToDate(s: string): string {
  const [mm, yyyy] = (s ?? '').split('/')
  return `${yyyy}-${(mm ?? '01').padStart(2, '0')}-01`
}

function parseBRDate(s: string): string | null {
  const m = (s ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// ─── Diff algorithm — ABA 1 ──────────────────────────────────

interface AlocacaoRow {
  mesAno: string; registro: string; nome: string; cargo: string
  status: string; supervisor: string; posto: string; secretaria: string
  dataDemissao: string; admissao: string
}

function extractAlocacoes(rows: Record<string, unknown>[]): AlocacaoRow[] {
  return rows.map(r => ({
    mesAno:       colByName(r, 'Mês/Ano Referência'),
    registro:     colByName(r, 'REGISTRO FUNCIONÁRIO'),
    nome:         colByName(r, 'NOME FUNCIONÁRIO'),
    cargo:        colByName(r, 'CARGO (no mês)'),
    status:       colByName(r, 'STATUS'),
    supervisor:   colByName(r, 'SUPERVISOR'),
    posto:        colByName(r, 'POSTO DE TRABALHO (no mês)'),
    secretaria:   colByName(r, 'SECRETARIA (no mês)'),
    dataDemissao: colByName(r, 'Data Demissão'),
    admissao:     colByName(r, 'Admissão'),
    // 'Está de Férias Hoje?', 'É Insalubre?' e colunas extras são ignoradas silenciosamente
  })).filter(r => r.registro)
}

const EXPECTED_ALOCACAO_COLS = [
  'Mês/Ano Referência',
  'REGISTRO FUNCIONÁRIO',
  'NOME FUNCIONÁRIO',
  'CARGO (no mês)',
  'STATUS',
  'SUPERVISOR',
  'POSTO DE TRABALHO (no mês)',
  'SECRETARIA (no mês)',
  'Está de Férias Hoje?',
  'É Insalubre?',
  'Data Demissão',
  'Admissão',
] as const

function checkAlocacaoHeaders(rows: Record<string, unknown>[]): string[] {
  if (rows.length === 0) return []
  const headers = Object.keys(rows[0]).map(k => k.trim())
  return EXPECTED_ALOCACAO_COLS.filter(col => !headers.includes(col))
}

function detectarEventos(rows: AlocacaoRow[]): EventoHistoricoInput[] {
  const eventos: EventoHistoricoInput[] = []
  const byRegistro = new Map<string, AlocacaoRow[]>()

  for (const row of rows) {
    if (!byRegistro.has(row.registro)) byRegistro.set(row.registro, [])
    byRegistro.get(row.registro)!.push(row)
  }

  for (const [, group] of Array.from(byRegistro.entries())) {
    const sorted = group.slice().sort((a, b) => parseMesAnoKey(a.mesAno) - parseMesAnoKey(b.mesAno))
    const first = sorted[0]

    // Admissão
    const admData = parseBRDate(first.admissao) ?? mesAnoToDate(first.mesAno)
    eventos.push({
      matricula:   first.registro,
      tipo:        'admissao',
      data_evento: admData,
      descricao:   `Admissão: ${first.nome}`,
      dados_novos: { cargo: first.cargo, posto: first.posto, supervisor: first.supervisor, status: first.status },
    })

    // Diffs entre meses consecutivos
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]
      const curr = sorted[i]
      const dataEvento = mesAnoToDate(curr.mesAno)

      if (prev.posto !== curr.posto && curr.posto) {
        eventos.push({
          matricula:        curr.registro,
          tipo:             'mudanca_posto',
          data_evento:      dataEvento,
          descricao:        `Posto: ${prev.posto} → ${curr.posto}`,
          dados_anteriores: { posto: prev.posto, secretaria: prev.secretaria },
          dados_novos:      { posto: curr.posto, secretaria: curr.secretaria },
        })
      }

      if (prev.supervisor !== curr.supervisor && curr.supervisor) {
        eventos.push({
          matricula:        curr.registro,
          tipo:             'transferencia',
          data_evento:      dataEvento,
          descricao:        `Supervisor: ${prev.supervisor} → ${curr.supervisor}`,
          dados_anteriores: { supervisor: prev.supervisor },
          dados_novos:      { supervisor: curr.supervisor },
        })
      }

      if (prev.status !== curr.status && curr.status) {
        eventos.push({
          matricula:        curr.registro,
          tipo:             'transferencia',
          data_evento:      dataEvento,
          descricao:        `Status: ${prev.status} → ${curr.status}`,
          dados_anteriores: { status: prev.status },
          dados_novos:      { status: curr.status },
        })
      }
    }

    // Desligamento
    const last = sorted[sorted.length - 1]
    if (last.dataDemissao) {
      const demData = parseBRDate(last.dataDemissao) ?? mesAnoToDate(last.mesAno)
      eventos.push({
        matricula:        last.registro,
        tipo:             'desligamento',
        data_evento:      demData,
        descricao:        `Desligamento: ${last.nome}`,
        dados_anteriores: { posto: last.posto, status: last.status },
        dados_novos:      { data_demissao: last.dataDemissao },
      })
    }
  }

  return eventos
}

// ─── Shared UI components ─────────────────────────────────────

const inputFile = 'block w-full rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-slate-700'

function PreviewTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length) return null
  const headers = Object.keys(rows[0]).slice(0, 8)
  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
      <p className="border-b border-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
        Preview — primeiras {rows.length} linhas
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs" style={{ minWidth: '600px' }}>
          <thead>
            <tr className="bg-gray-50">
              {headers.map(h => (
                <th key={h} className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-gray-400 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((row, i) => (
              <tr key={i}>
                {headers.map(h => (
                  <td key={h} className="px-3 py-2 text-gray-600 whitespace-nowrap max-w-[200px] truncate">{String(row[h] ?? '')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
      <div className="h-2 rounded-full bg-slate-900 transition-all duration-300" style={{ width: `${value}%` }} />
    </div>
  )
}

function ResultPanel({ result }: { result: ImportResult }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm space-y-2">
      <p className="text-sm font-semibold text-gray-700">
        <span className="text-green-600">{result.imported} importados</span>
        {result.errors.length > 0 && (
          <span className="ml-2 text-red-500">{result.errors.length} erro{result.errors.length !== 1 ? 's' : ''}</span>
        )}
      </p>
      {result.errors.length > 0 && (
        <ul className="max-h-48 overflow-y-auto space-y-0.5">
          {result.errors.map((e, i) => (
            <li key={i} className="text-xs text-red-600">{e}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── ABA 1: Alocações Mensais ─────────────────────────────────

function TabAlocacoes() {
  const [preview, setPreview]        = useState<Record<string, unknown>[]>([])
  const [eventos, setEventos]        = useState<EventoHistoricoInput[]>([])
  const [processing, setProc]        = useState(false)
  const [progress, setProgress]      = useState(0)
  const [result, setResult]          = useState<ImportResult | null>(null)
  const [csvError, setCsvError]      = useState<string | null>(null)
  const [headerErrors, setHdrErrors] = useState<string[]>([])

  async function handleFile(f: File) {
    setResult(null); setEventos([]); setCsvError(null); setHdrErrors([]); setPreview([])
    const { rows, error: csvErr } = await parseCSVFindHeader(f, 'REGISTRO FUNCIONÁRIO')
    if (csvErr) { setCsvError(csvErr); return }
    const missing = checkAlocacaoHeaders(rows)
    if (missing.length > 0) { setHdrErrors(missing); return }
    setPreview(rows.slice(0, 5))
    const alocacoes = extractAlocacoes(rows)
    const evs = detectarEventos(alocacoes)
    setEventos(evs)
  }

  async function handleProcess() {
    if (!eventos.length) return
    setProc(true); setProgress(0); setResult(null)
    const batches = chunk(eventos, 500)
    let imported = 0; const errors: string[] = []
    for (let i = 0; i < batches.length; i++) {
      const r = await importarEventosHistorico(batches[i])
      imported += r.imported; errors.push(...r.errors)
      setProgress(Math.round(((i + 1) / batches.length) * 100))
    }
    setResult({ imported, errors }); setProc(false)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm space-y-3">
        <p className="text-xs text-gray-400">
          Colunas esperadas: <span className="font-mono text-gray-600">Mês/Ano Referência · REGISTRO FUNCIONÁRIO · CARGO (no mês) · STATUS · SUPERVISOR · POSTO DE TRABALHO (no mês) · SECRETARIA (no mês) · Está de Férias Hoje? · É Insalubre? · Data Demissão · Admissão</span>
        </p>
        <input type="file" accept=".csv,.tsv,.txt" className={inputFile}
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
      </div>

      {csvError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-700">{csvError}</p>
        </div>
      )}

      {headerErrors.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-700">Colunas obrigatórias não encontradas no CSV:</p>
          <ul className="mt-1 space-y-0.5">
            {headerErrors.map(col => (
              <li key={col} className="font-mono text-xs text-red-600">{col}</li>
            ))}
          </ul>
        </div>
      )}

      {preview.length > 0 && (
        <>
          <PreviewTable rows={preview} />
          <p className="text-xs text-gray-400">
            {eventos.length} evento{eventos.length !== 1 ? 's' : ''} detectado{eventos.length !== 1 ? 's' : ''} por diff
          </p>
          <button onClick={handleProcess} disabled={processing || eventos.length === 0}
            className="flex h-9 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40">
            {processing ? 'Processando…' : `Importar ${eventos.length} eventos`}
          </button>
        </>
      )}

      {processing && <ProgressBar value={progress} />}
      {result && <ResultPanel result={result} />}
    </div>
  )
}

// ─── ABA 2: Coberturas Insalubres ────────────────────────────

function TabCoberturas() {
  const [preview, setPreview]   = useState<Record<string, unknown>[]>([])
  const [rows, setRows]         = useState<CoberturaCsvRow[]>([])
  const [processing, setProc]   = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult]     = useState<ImportResult | null>(null)

  async function handleFile(f: File) {
    setResult(null)
    const raw = await parseCSV(f)
    setPreview(raw.slice(0, 5))
    setRows(raw.map(r => ({
      supervisor:        getCol(r, 'Supervisor', 'supervisor'),
      posto:             getCol(r, 'Posto', 'posto'),
      colaborador_cobriu:getCol(r, 'ColaboradorCobriu', 'Colaborador Cobriu', 'colaborador_cobriu'),
      data_cobertura:    getCol(r, 'DataCobertura', 'Data Cobertura', 'data_cobertura'),
      periodo_dias:      getCol(r, 'PeriodoDias', 'Periodo Dias', 'periodo_dias'),
      agente_fixo_ausente:getCol(r, 'AgenteFixoAusente', 'Agente Fixo Ausente', 'agente_fixo_ausente'),
      motivo_cobertura:  getCol(r, 'MotivoCobertura', 'Motivo Cobertura', 'motivo_cobertura'),
    })).filter(r => r.colaborador_cobriu))
  }

  async function handleProcess() {
    if (!rows.length) return
    setProc(true); setProgress(0); setResult(null)
    const batches = chunk(rows, 500)
    let imported = 0; const errors: string[] = []
    for (let i = 0; i < batches.length; i++) {
      const r = await importarCoberturas(batches[i])
      imported += r.imported; errors.push(...r.errors)
      setProgress(Math.round(((i + 1) / batches.length) * 100))
    }
    setResult({ imported, errors }); setProc(false)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm space-y-3">
        <p className="text-xs text-gray-400">
          Colunas esperadas: <span className="font-mono text-gray-600">Timestamp · Supervisor · Posto · ColaboradorCobriu · DataCobertura · PeriodoDias · AgenteFixoAusente · MotivoCobertura</span>
        </p>
        <input type="file" accept=".csv" className={inputFile}
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
      </div>
      {preview.length > 0 && (
        <>
          <PreviewTable rows={preview} />
          <p className="text-xs text-gray-400">{rows.length} linha{rows.length !== 1 ? 's' : ''} válida{rows.length !== 1 ? 's' : ''}</p>
          <button onClick={handleProcess} disabled={processing}
            className="flex h-9 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40">
            {processing ? 'Processando…' : `Importar ${rows.length} coberturas`}
          </button>
        </>
      )}
      {processing && <ProgressBar value={progress} />}
      {result && <ResultPanel result={result} />}
    </div>
  )
}

// ─── ABA 3: Mudanças de Função ────────────────────────────────

function TabMudancasFuncao() {
  const [preview, setPreview]   = useState<Record<string, unknown>[]>([])
  const [rows, setRows]         = useState<MudancaFuncaoRow[]>([])
  const [processing, setProc]   = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult]     = useState<ImportResult | null>(null)

  async function handleFile(f: File) {
    setResult(null)
    const raw = await parseCSV(f)
    setPreview(raw.slice(0, 5))
    setRows(raw.map(r => ({
      data:            getCol(r, 'Data', 'data'),
      registro:        getCol(r, 'Registro', 'registro', 'matricula'),
      nome:            getCol(r, 'Nome', 'nome'),
      supervisor:      getCol(r, 'Supervisor', 'supervisor'),
      funcao_anterior: getCol(r, 'Função Anterior', 'Funcao Anterior', 'funcao_anterior'),
      nova_funcao:     getCol(r, 'Nova Função', 'Nova Funcao', 'nova_funcao'),
      posto_atual:     getCol(r, 'Posto Atual', 'posto_atual'),
      posto_novo:      getCol(r, 'Posto Novo', 'posto_novo'),
    })).filter(r => r.registro))
  }

  async function handleProcess() {
    if (!rows.length) return
    setProc(true); setProgress(0); setResult(null)
    const batches = chunk(rows, 500)
    let imported = 0; const errors: string[] = []
    for (let i = 0; i < batches.length; i++) {
      const r = await importarMudancasFuncao(batches[i])
      imported += r.imported; errors.push(...r.errors)
      setProgress(Math.round(((i + 1) / batches.length) * 100))
    }
    setResult({ imported, errors }); setProc(false)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm space-y-3">
        <p className="text-xs text-gray-400">
          Colunas esperadas: <span className="font-mono text-gray-600">Data · Registro · Nome · Supervisor · Função Anterior · Nova Função · Posto Atual · Posto Novo</span>
        </p>
        <input type="file" accept=".csv" className={inputFile}
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
      </div>
      {preview.length > 0 && (
        <>
          <PreviewTable rows={preview} />
          <p className="text-xs text-gray-400">{rows.length} linha{rows.length !== 1 ? 's' : ''} válida{rows.length !== 1 ? 's' : ''}</p>
          <button onClick={handleProcess} disabled={processing}
            className="flex h-9 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40">
            {processing ? 'Processando…' : `Importar ${rows.length} mudanças`}
          </button>
        </>
      )}
      {processing && <ProgressBar value={progress} />}
      {result && <ResultPanel result={result} />}
    </div>
  )
}

// ─── ABA 4: Advertências ─────────────────────────────────────

function TabAdvertencias() {
  const [preview, setPreview]   = useState<Record<string, unknown>[]>([])
  const [rows, setRows]         = useState<AdvertenciaRow[]>([])
  const [processing, setProc]   = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult]     = useState<ImportResult | null>(null)

  async function handleFile(f: File) {
    setResult(null)
    const raw = await parseCSV(f)
    setPreview(raw.slice(0, 5))
    setRows(raw.map(r => ({
      registro:       getCol(r, 'Registro', 'registro', 'matricula'),
      nome:           getCol(r, 'Nome', 'nome'),
      posto:          getCol(r, 'Posto', 'posto'),
      data_fato:      getCol(r, 'DataFato', 'Data Fato', 'data_fato'),
      hora_fato:      getCol(r, 'HoraFato', 'Hora Fato', 'hora_fato'),
      natureza:       getCol(r, 'Natureza', 'natureza'),
      descricao:      getCol(r, 'Descricao', 'Descrição', 'descricao'),
      evidencias:     getCol(r, 'Evidencias', 'Evidências', 'evidencias'),
      testemunhas:    getCol(r, 'Testemunhas', 'testemunhas'),
      defesa:         getCol(r, 'Defesa', 'defesa'),
      nivel_sugerido: getCol(r, 'Nivel_Sugerido', 'Nível Sugerido', 'nivel_sugerido'),
      nivel_final:    getCol(r, 'Nivel_Final', 'Nível Final', 'nivel_final'),
      medida_final:   getCol(r, 'Medida_Final', 'Medida Final', 'medida_final'),
      dias_suspensao: getCol(r, 'DiasSuspensao', 'Dias Suspensão', 'dias_suspensao'),
      autor:          getCol(r, 'Autor', 'autor'),
      status_adv:     getCol(r, 'Status', 'status'),
      link_pdf:       getCol(r, 'LinkPDF', 'Link PDF', 'link_pdf'),
    })).filter(r => r.registro))
  }

  async function handleProcess() {
    if (!rows.length) return
    setProc(true); setProgress(0); setResult(null)
    const batches = chunk(rows, 500)
    let imported = 0; const errors: string[] = []
    for (let i = 0; i < batches.length; i++) {
      const r = await importarAdvertencias(batches[i])
      imported += r.imported; errors.push(...r.errors)
      setProgress(Math.round(((i + 1) / batches.length) * 100))
    }
    setResult({ imported, errors }); setProc(false)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm space-y-3">
        <p className="text-xs text-gray-400">
          Colunas esperadas: <span className="font-mono text-gray-600">Timestamp · Contrato · Posto · Supervisor · Registro · Nome · DataFato · HoraFato · Natureza · Descricao · Nivel_Sugerido · Nivel_Final · Medida_Final · DiasSuspensao · Status · LinkPDF</span>
        </p>
        <input type="file" accept=".csv" className={inputFile}
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
      </div>
      {preview.length > 0 && (
        <>
          <PreviewTable rows={preview} />
          <p className="text-xs text-gray-400">{rows.length} linha{rows.length !== 1 ? 's' : ''} válida{rows.length !== 1 ? 's' : ''}</p>
          <button onClick={handleProcess} disabled={processing}
            className="flex h-9 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40">
            {processing ? 'Processando…' : `Importar ${rows.length} advertências`}
          </button>
        </>
      )}
      {processing && <ProgressBar value={progress} />}
      {result && <ResultPanel result={result} />}
    </div>
  )
}

// ─── ABA 5: Efetivo ──────────────────────────────────────────

function TabEfetivo() {
  const [preview, setPreview]   = useState<Record<string, unknown>[]>([])
  const [rows, setRows]         = useState<EfetivoRow[]>([])
  const [processing, setProc]   = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult]     = useState<ImportResult | null>(null)
  const [csvError, setCsvError] = useState<string | null>(null)

  async function handleFile(f: File) {
    setResult(null); setRows([]); setCsvError(null); setPreview([])
    const raw = await parseCSVEfetivo(f)
    if (!raw.length) { setCsvError('Arquivo vazio ou sem dados.'); return }

    const parsed: EfetivoRow[] = []
    for (const row of raw) {
      const registro = getCol(row, 'REGISTRO')
      const nome     = getCol(row, 'NOME')
      if (!registro || !nome) continue

      const cargo      = getCol(row, 'CARGO')
      const funcaoRaw  = getCol(row, 'FUNÇÃO', 'FUNCAO')
      const funcaoNorm = funcaoRaw.toUpperCase().trim()

      let status: EfetivoRow['status'] = 'ativo'
      if (funcaoNorm === 'INATIVO' || funcaoNorm === 'RESCISÃO DE CONTRATO' || funcaoNorm === 'RESCISAO DE CONTRATO') {
        status = 'desligado'
      } else if (funcaoNorm === 'AFASTADO') {
        status = 'afastado'
      }

      const data_admissao     = parseDataFlexivel(getCol(row, 'ADMISSÃO', 'ADMISSAO'))
      const data_desligamento = parseDataFlexivel(getCol(row, 'DATA SAÍDA', 'DATA SAIDA'))

      const per1 = getCol(row, '1º PER.', '1 PER.', '1º PER', '1 PER')
      const per2 = getCol(row, '2º PER.', '2 PER.', '2º PER', '2 PER')
      let periodo_experiencia: EfetivoRow['periodo_experiencia'] = null
      if (per1 && per2 && data_admissao) {
        const d1 = parseBRDate(per1)
        if (d1) {
          const dias = Math.round((new Date(d1).getTime() - new Date(data_admissao).getTime()) / 86400000)
          periodo_experiencia = dias <= 30 ? '30+30' : '45+45'
        }
      }

      parsed.push({ registro, nome, cargo, status, data_admissao, data_desligamento, periodo_experiencia })
    }

    setPreview(raw.slice(0, 5))
    setRows(parsed)
  }

  async function handleProcess() {
    if (!rows.length) return
    setProc(true); setProgress(0); setResult(null)
    const batches = chunk(rows, 100)
    let imported = 0; const errors: string[] = []
    for (let i = 0; i < batches.length; i++) {
      const r = await importarEfetivo(batches[i])
      imported += r.imported; errors.push(...r.errors)
      setProgress(Math.round(((i + 1) / batches.length) * 100))
    }
    setResult({ imported, errors }); setProc(false)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm space-y-3">
        <p className="text-xs text-gray-400">
          Arquivo CSV ou TSV. Colunas esperadas: <span className="font-mono text-gray-600">REGISTRO · NOME · CARGO · FUNÇÃO · ADMISSÃO · DATA SAÍDA · 1º PER. · 2º PER.</span>
        </p>
        <p className="text-xs text-gray-400">
          <strong>FUNÇÃO</strong>: ATIVO → ativo | INATIVO / RESCISÃO DE CONTRATO → desligado | AFASTADO → afastado
        </p>
        <input type="file" accept=".csv,.tsv" className={inputFile}
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
      </div>

      {csvError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-700">{csvError}</p>
        </div>
      )}

      {preview.length > 0 && (
        <>
          <PreviewTable rows={preview} />
          <p className="text-xs text-gray-400">
            {rows.length} funcionário{rows.length !== 1 ? 's' : ''} prontos para importar
          </p>
          <button onClick={handleProcess} disabled={processing || rows.length === 0}
            className="flex h-9 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40">
            {processing ? 'Processando…' : `Importar ${rows.length} funcionários`}
          </button>
        </>
      )}

      {processing && <ProgressBar value={progress} />}
      {result && <ResultPanel result={result} />}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────

const TABS = [
  { id: 'efetivo',      label: 'Efetivo'              },
  { id: 'alocacoes',    label: 'Alocações Mensais'    },
  { id: 'coberturas',   label: 'Coberturas Insalubres' },
  { id: 'mudancas',     label: 'Mudanças de Função'   },
  { id: 'advertencias', label: 'Advertências'          },
] as const

type TabId = typeof TABS[number]['id']

export function ImportacaoClient() {
  const [active, setActive] = useState<TabId>('efetivo')

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-100">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={
              active === t.id
                ? 'border-b-2 border-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-900'
                : 'px-4 py-2.5 text-sm font-medium text-gray-400 hover:text-gray-600'
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab panels — all rendered, hidden via CSS to preserve state */}
      <div className={active !== 'efetivo'      ? 'hidden' : ''}><TabEfetivo /></div>
      <div className={active !== 'alocacoes'    ? 'hidden' : ''}><TabAlocacoes /></div>
      <div className={active !== 'coberturas'   ? 'hidden' : ''}><TabCoberturas /></div>
      <div className={active !== 'mudancas'     ? 'hidden' : ''}><TabMudancasFuncao /></div>
      <div className={active !== 'advertencias' ? 'hidden' : ''}><TabAdvertencias /></div>
    </div>
  )
}
