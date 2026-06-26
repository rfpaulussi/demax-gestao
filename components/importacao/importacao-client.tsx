'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx-js-style'
import {
  importarEventosHistorico,
  importarMudancasFuncao,
  importarAdvertencias,
  importarEfetivo,
  importarFeriasHistoricasBulk,
  importarCoberturaInsalubridade,
  importarInsalubridadeCoberturaMensal,
} from '@/app/(admin)/importacao/actions'
import type {
  ImportResult,
  EventoHistoricoInput,
  MudancaFuncaoRow,
  AdvertenciaRow,
  EfetivoRow,
  FeriasImportRow,
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
  if (!isNaN(serial) && serial > 30000) {
    const dias = Math.round(serial)
    const data = new Date(Date.UTC(1899, 11, 30))
    data.setUTCDate(data.getUTCDate() + dias)
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

function parseCSVEfetivo(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const raw = e.target?.result as string
        const text = normalizarTexto(raw)
        const lines = text.split(/\r?\n/).filter(l => l.trim() !== '')
        if (lines.length < 2) { resolve([]); return }

        const firstLine = lines[0]
        const sep = detectarDelimitador(firstLine)

        const headers = firstLine.split(sep).map(h => h.trim())
        const rows: Record<string, string>[] = []

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(sep)
          const row: Record<string, string> = {}
          headers.forEach((h, idx) => {
            row[h] = (cols[idx] ?? '').trim()
          })
          rows.push(row)
        }

        resolve(rows)
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


function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// ─── Diff algorithm — ABA 1 ──────────────────────────────────

interface AlocacaoRow {
  mesAno: string; registro: string; nome: string; cargo: string
  status: string; supervisor: string; posto: string; secretaria: string
  dataDemissao: string; admissao: string; emFerias: string
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
    emFerias:     colByName(r, 'Está de Férias Hoje?'),
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
    const admData = parseDataFlexivel(first.admissao ?? '') ?? mesAnoToDate(first.mesAno)
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

      if (curr.emFerias?.trim().toLowerCase() === 'sim') {
        eventos.push({
          matricula:        curr.registro,
          tipo:             'ferias',
          data_evento:      dataEvento,
          descricao:        `Em férias em ${curr.mesAno}`,
          dados_novos:      { em_ferias: true, mes_referencia: curr.mesAno },
        })
      }
    }

    // Desligamento
    const last = sorted[sorted.length - 1]
    if (last.dataDemissao) {
      const demData = parseDataFlexivel(last.dataDemissao ?? '') ?? mesAnoToDate(last.mesAno)
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

// ─── Relatório Mensal Insalubridade ──────────────────────────

type RelatorioMensalRow = {
  registro: string
  nome: string
  mes: number
  ano: number
  data_cobertura: string
  periodo_dias: number
  agente_ausente_nome: string
  funcao_agente: string
  supervisor: string
  observacao: string
}

function parsearRelatorioInsalubridade(tsv: string): RelatorioMensalRow[] {
  const linhas = tsv.trim().split('\n').slice(1)
  const result: RelatorioMensalRow[] = []
  for (const linha of linhas) {
    const cols = linha.split('\t')
    if (cols.length < 13) continue
    const [mesStr, anoStr] = cols[0].trim().split('/')
    const [dd, mm, yyyy] = cols[8].trim().split('/')
    if (!yyyy || !mm || !dd) continue
    result.push({
      registro:            cols[1].trim(),
      nome:                cols[2].trim(),
      mes:                 parseInt(mesStr),
      ano:                 parseInt(anoStr),
      data_cobertura:      `${yyyy}-${mm}-${dd}`,
      periodo_dias:        parseInt(cols[9].trim()) || 1,
      agente_ausente_nome: cols[6].trim(),
      funcao_agente:       cols[7].trim().replace(/⚠.*$/, '').trim(),
      supervisor:          cols[10].trim(),
      observacao:          `[${cols[10].trim()}] ${cols[12].trim()}`,
    })
  }
  return result
}

function RelatorioMensalSection() {
  const [tsv, setTsv]         = useState('')
  const [rows, setRows]       = useState<RelatorioMensalRow[]>([])
  const [processing, setProc] = useState(false)
  const [resultado, setRes]   = useState<{ inseridos: number; naoEncontrados: string[]; erros: string[] } | null>(null)

  function handleProcessar() {
    setRes(null)
    setRows(parsearRelatorioInsalubridade(tsv))
  }

  async function handleImportar() {
    if (processing || !rows.length) return
    setProc(true)
    setRes(null)
    try {
      const r = await importarInsalubridadeCoberturaMensal(
        rows.map(({ registro, mes, ano, data_cobertura, periodo_dias, agente_ausente_nome, observacao }) => ({
          registro, mes, ano, data_cobertura, periodo_dias, agente_ausente_nome, observacao,
        }))
      )
      setRes(r)
    } finally {
      setProc(false)
    }
  }

  return (
    <div className="space-y-4 pt-2">
      <hr className="border-gray-100" />
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Importar Relatório Mensal (TSV)</p>
      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm space-y-3">
        <p className="text-xs text-gray-400">
          Cole o relatório gerado pelo Apps Script. Cabeçalho esperado:{' '}
          <span className="font-mono text-gray-600">Mês/Ano · Registro · Nome · Função (Efetivo) · Posto Atual · Dias no mês · Agente Ausente · Função Agente Ausente · Data Início · Período (dias) · Supervisor · Posto (formulário) · Motivo</span>
        </p>
        <textarea
          value={tsv}
          onChange={e => setTsv(e.target.value)}
          placeholder="Cole o relatório mensal aqui..."
          rows={8}
          className="w-full rounded-lg border border-gray-200 p-3 font-mono text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
        />
        <button
          type="button"
          onClick={handleProcessar}
          disabled={!tsv.trim()}
          className="flex h-9 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
        >
          Processar
        </button>
      </div>

      {rows.length > 0 && (
        <>
          <PreviewTable rows={rows.slice(0, 5).map(r => ({
            Registro:         r.registro,
            Nome:             r.nome,
            Data:             r.data_cobertura,
            'Período (dias)': r.periodo_dias,
            'Agente Ausente': r.agente_ausente_nome,
            Supervisor:       r.supervisor,
          }))} />
          <p className="text-xs text-gray-400">
            {rows.length} registro{rows.length !== 1 ? 's' : ''} encontrado{rows.length !== 1 ? 's' : ''}
          </p>
          <button
            type="button"
            onClick={handleImportar}
            disabled={processing}
            className="flex h-9 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
          >
            {processing ? 'Importando…' : `Importar ${rows.length} registros`}
          </button>
        </>
      )}

      {resultado && (
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm space-y-2">
          <p className="text-sm font-semibold text-gray-700">
            <span className="text-green-600">{resultado.inseridos} inserido{resultado.inseridos !== 1 ? 's' : ''}</span>
            {resultado.naoEncontrados.length > 0 && (
              <span className="ml-2 text-amber-600">
                {resultado.naoEncontrados.length} não encontrado{resultado.naoEncontrados.length !== 1 ? 's' : ''}
              </span>
            )}
            {resultado.erros.length > 0 && (
              <span className="ml-2 text-red-500">
                {resultado.erros.length} erro{resultado.erros.length !== 1 ? 's' : ''}
              </span>
            )}
          </p>
          {resultado.naoEncontrados.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-700 mb-1">Registros não encontrados:</p>
              <p className="font-mono text-xs text-amber-600">
                {resultado.naoEncontrados.slice(0, 30).join(', ')}
                {resultado.naoEncontrados.length > 30 ? ` … +${resultado.naoEncontrados.length - 30}` : ''}
              </p>
            </div>
          )}
          {resultado.erros.length > 0 && (
            <ul className="max-h-32 overflow-y-auto space-y-0.5">
              {resultado.erros.map((e, i) => <li key={i} className="text-xs text-red-600">{e}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

// ─── ABA 2: Coberturas Insalubres ────────────────────────────

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
  const [preview, setPreview]   = useState<EfetivoRow[]>([])
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
        const d1 = parseDataFlexivel(per1)
        if (d1) {
          const dias = Math.round((new Date(d1).getTime() - new Date(data_admissao).getTime()) / 86400000)
          periodo_experiencia = dias <= 30 ? '30+30' : '45+45'
        }
      }

      parsed.push({ registro, nome, cargo, status, data_admissao, data_desligamento, periodo_experiencia })
    }

    setPreview(parsed.slice(0, 5))
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
          <PreviewTable rows={preview.map(r => ({
            Registro:       r.registro,
            Nome:           r.nome,
            Cargo:          r.cargo,
            Status:         r.status,
            Admissão:       r.data_admissao?.split('-').reverse().join('/') ?? '',
            Desligamento:   r.data_desligamento?.split('-').reverse().join('/') ?? '',
            'Período Exp.': r.periodo_experiencia ?? '',
          }))} />
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

// ─── ABA 5: Férias ───────────────────────────────────────────

function calcularNumeroPeriodo(admissao: string, periodoInicio: string): number {
  const adm = new Date(admissao)
  const ini = new Date(periodoInicio)
  let anos = ini.getFullYear() - adm.getFullYear()
  const mesDia    = ini.getMonth() * 100 + ini.getDate()
  const mesDiaAdm = adm.getMonth() * 100 + adm.getDate()
  if (mesDia < mesDiaAdm) anos--
  return anos + 1
}

type FeriasPreviewRow = FeriasImportRow & { registro_num: string; nome: string }

function calcularStatusFerias(data_inicio: string | null, limite_gozo: string | null): 'concluido' | 'agendado' | 'disponivel' | 'vencido' {
  if (data_inicio) return 'concluido'
  if (!limite_gozo) return 'disponivel'
  const limite = new Date(limite_gozo)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  if (limite < hoje) return 'vencido'
  return 'disponivel'
}

function TabFerias() {
  const [preview, setPreview]   = useState<FeriasPreviewRow[]>([])
  const [rows, setRows]         = useState<FeriasImportRow[]>([])
  const [notFound, setNotFound] = useState<string[]>([])
  const [processing, setProc]   = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult]     = useState<ImportResult | null>(null)
  const [csvError, setCsvError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setResult(null); setRows([]); setNotFound([]); setCsvError(null); setPreview([])
    const raw = await parseCSVEfetivo(file)
    if (!raw.length) { setCsvError('Arquivo vazio ou sem dados.'); return }

    // Lookup funcionarios (client-side, uma vez)
    const { createClient: createClientBrowser } = await import('@/lib/supabase/client')
    const sb = createClientBrowser()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: funcsData } = await (sb as any).from('funcionarios').select('id, registro').range(0, 1999)
    const funcMap = new Map<string, string>()
    for (const func of (funcsData ?? []) as { id: string; registro: string | null }[]) {
      if (func.registro) funcMap.set(String(func.registro), func.id)
    }

    const parsed: FeriasImportRow[] = []
    const previews: FeriasPreviewRow[] = []
    const missing: string[] = []

    for (const row of raw) {
      const registro = getCol(row, 'REGISTRO')
      const nome     = getCol(row, 'NOME')
      if (!registro) continue

      const funcionario_id = funcMap.get(registro)
      if (!funcionario_id) { missing.push(registro); continue }

      const data_admissao  = parseDataFlexivel(getCol(row, 'DATA DE ADMISSÃO', 'DATA DE ADMISSAO'))
      const periodo_inicio = parseDataFlexivel(getCol(row, 'PERÍODO AQUISITIVO INÍCIO', 'PERIODO AQUISITIVO INICIO', 'PERÍODO AQUISITIVO INICIO'))
      if (!periodo_inicio) continue

      const periodo_fim    = parseDataFlexivel(getCol(row, 'PERÍODO AQUISITIVO FIM', 'PERIODO AQUISITIVO FIM', 'PERÍODO AQUISITIVO FIM'))
      const limite_gozo    = parseDataFlexivel(getCol(row, 'LIMITE PARA GOZO'))
      const dias_direito   = parseInt(getCol(row, 'DIAS DE DIREITO')) || 30
      const data_inicio    = parseDataFlexivel(getCol(row, 'Início Programado', 'INÍCIO PROGRAMADO', 'INICIO PROGRAMADO'))
      const data_fim       = parseDataFlexivel(getCol(row, 'Fim Programado', 'FIM PROGRAMADO'))

      const numero_periodo = data_admissao
        ? Math.max(1, calcularNumeroPeriodo(data_admissao, periodo_inicio))
        : 1

      const dias_utilizados = data_inicio && data_fim
        ? Math.round((new Date(data_fim).getTime() - new Date(data_inicio).getTime()) / 86400000) + 1
        : null

      const status = calcularStatusFerias(data_inicio, limite_gozo)

      const importRow: FeriasImportRow = {
        funcionario_id, numero_periodo,
        periodo_inicio, periodo_fim, limite_gozo,
        dias_direito, data_inicio, data_fim, dias_utilizados,
        status, observacao: 'Importação histórica',
      }
      parsed.push(importRow)
      previews.push({ ...importRow, registro_num: registro, nome })
    }

    setNotFound(missing)
    setPreview(previews.slice(0, 5))
    setRows(parsed)
  }

  async function handleProcess() {
    if (!rows.length) return
    setProc(true); setProgress(0); setResult(null)
    const dedupMap = new Map<string, FeriasImportRow>()
    for (const row of rows) {
      const key = `${row.funcionario_id}__${row.numero_periodo}`
      dedupMap.set(key, row)
    }
    const rowsDedup = Array.from(dedupMap.values())
    const batches = chunk(rowsDedup, 100)
    let imported = 0; const errors: string[] = []
    for (let i = 0; i < batches.length; i++) {
      const r = await importarFeriasHistoricasBulk(batches[i])
      imported += r.imported; errors.push(...r.errors)
      setProgress(Math.round(((i + 1) / batches.length) * 100))
    }
    if (notFound.length > 0) {
      errors.push(...notFound.map(r => `Registro ${r} não encontrado no sistema`))
    }
    setResult({ imported, errors }); setProc(false)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm space-y-3">
        <p className="text-xs text-gray-400">
          Arquivo CSV ou TSV. Colunas esperadas: <span className="font-mono text-gray-600">REGISTRO · NOME · DATA DE ADMISSÃO · PERÍODO AQUISITIVO INÍCIO · PERÍODO AQUISITIVO FIM · LIMITE PARA GOZO · DIAS DE DIREITO · Início Programado · Fim Programado</span>
        </p>
        <input type="file" accept=".csv,.tsv" className={inputFile}
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
      </div>

      {csvError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-700">{csvError}</p>
        </div>
      )}

      {notFound.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-700">
            {notFound.length} registro{notFound.length !== 1 ? 's' : ''} não encontrado{notFound.length !== 1 ? 's' : ''} — serão ignorados:
          </p>
          <p className="mt-1 font-mono text-xs text-amber-600">
            {notFound.slice(0, 20).join(', ')}{notFound.length > 20 ? ` … +${notFound.length - 20}` : ''}
          </p>
        </div>
      )}

      {preview.length > 0 && (
        <>
          <PreviewTable rows={preview.map(r => ({
            Registro:      r.registro_num,
            Nome:          r.nome,
            'Per. Início': r.periodo_inicio.split('-').reverse().join('/'),
            'Per. Fim':    r.periodo_fim?.split('-').reverse().join('/') ?? '',
            'Dias Dir.':   r.dias_direito,
            Status:        r.status,
          }))} />
          <p className="text-xs text-gray-400">
            {rows.length} registro{rows.length !== 1 ? 's' : ''} de férias prontos para importar
          </p>
          <button onClick={handleProcess} disabled={processing || rows.length === 0}
            className="flex h-9 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40">
            {processing ? 'Processando…' : `Importar ${rows.length} registros`}
          </button>
        </>
      )}

      {processing && <ProgressBar value={progress} />}
      {result && <ResultPanel result={result} />}
    </div>
  )
}

// ─── ABA 7: Coberturas Insalubridade (histórico TSV) ─────────

type CoberturaInsalubridadePreview = {
  mes_ano: string
  registro: string
  nome_colaborador: string
  funcao_colaborador: string
  posto_atual: string
  dias_no_mes: number
  agente_ausente: string
  funcao_agente_ausente: string
  data_inicio: string
  periodo_dias: number
  supervisor: string
  posto_formulario: string
  motivo: string
  contrato_id: string
  origem: string
}

function parsearCoberturaInsalubridade(tsv: string): {
  resultado: CoberturaInsalubridadePreview[]
  duplicatas: string[]
} {
  const linhas = tsv.trim().split('\n')
  const dados = linhas.slice(1)

  const seen = new Set<string>()
  const resultado: CoberturaInsalubridadePreview[] = []
  const duplicatas: string[] = []

  for (const linha of dados) {
    const cols = linha.split('\t')
    if (cols.length < 13) continue

    const mesAnoRaw = cols[0].trim()
    const [m, a] = mesAnoRaw.split('/')
    const mes_ano = `${m.padStart(2, '0')}/${a}`

    const dataRaw = cols[8].trim()
    const [dd, mm, yyyy] = dataRaw.split('/')
    const data_inicio = `${yyyy}-${mm}-${dd}`

    const chave = `${mes_ano}__${cols[1].trim()}__${data_inicio}__${cols[6].trim()}`
    if (seen.has(chave)) { duplicatas.push(chave); continue }
    seen.add(chave)

    resultado.push({
      mes_ano,
      registro:              cols[1].trim(),
      nome_colaborador:      cols[2].trim(),
      funcao_colaborador:    cols[3].trim(),
      posto_atual:           cols[4].trim(),
      dias_no_mes:           parseInt(cols[5].trim()) || 0,
      agente_ausente:        cols[6].trim(),
      funcao_agente_ausente: cols[7].trim(),
      data_inicio,
      periodo_dias:          parseInt(cols[9].trim()) || 0,
      supervisor:            cols[10].trim(),
      posto_formulario:      cols[11].trim(),
      motivo:                cols[12].trim(),
      contrato_id:           'c73a81ae-0104-4c05-b7d6-e6266f6be1b2',
      origem:                'historico',
    })
  }
  return { resultado, duplicatas }
}

function TabCoberturaInsalubridade() {
  const [tsv, setTsv]           = useState('')
  const [rows, setRows]         = useState<CoberturaInsalubridadePreview[]>([])
  const [dupCount, setDupCount] = useState(0)
  const [processing, setProc]   = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult]     = useState<ImportResult | null>(null)

  function handleProcessar() {
    setResult(null)
    const { resultado, duplicatas } = parsearCoberturaInsalubridade(tsv)
    setRows(resultado)
    setDupCount(duplicatas.length)
  }

  async function handleImportar() {
    if (!rows.length) return
    setProc(true); setProgress(0); setResult(null)
    const r = await importarCoberturaInsalubridade(rows)
    setProgress(100)
    setResult({ imported: r.inseridos, errors: r.erros })
    setProc(false)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm space-y-3">
        <p className="text-xs text-gray-400">
          Cole o TSV abaixo. Cabeçalho esperado: <span className="font-mono text-gray-600">Mês/Ano · Registro · Nome · Função (Efetivo) · Posto Atual · Dias no mês · Agente Ausente · Função Agente Ausente · Data Início · Período (dias) · Supervisor · Posto (formulário) · Motivo</span>
        </p>
        <textarea
          value={tsv}
          onChange={e => setTsv(e.target.value)}
          placeholder="Cole o conteúdo do TSV aqui…"
          rows={8}
          className="w-full rounded-lg border border-gray-200 p-3 font-mono text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
        />
        <button
          onClick={handleProcessar}
          disabled={!tsv.trim()}
          className="flex h-9 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
        >
          Processar TSV
        </button>
      </div>

      {rows.length > 0 && (
        <>
          <PreviewTable rows={rows.slice(0, 5).map(r => ({
            'Mês/Ano':       r.mes_ano,
            'Registro':      r.registro,
            'Nome':          r.nome_colaborador,
            'Dias/Mês':      r.dias_no_mes,
            'Agente Ausente':r.agente_ausente,
            'Data Início':   r.data_inicio,
            'Supervisor':    r.supervisor,
          }))} />
          <p className="text-xs text-gray-400">
            {rows.length} registro{rows.length !== 1 ? 's' : ''} encontrado{rows.length !== 1 ? 's' : ''}
            {dupCount > 0 && ` (${dupCount} duplicata${dupCount !== 1 ? 's' : ''} removida${dupCount !== 1 ? 's' : ''})`}
          </p>
          <button
            onClick={handleImportar}
            disabled={processing}
            className="flex h-9 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
          >
            {processing ? 'Importando…' : `Importar ${rows.length} registros`}
          </button>
        </>
      )}

      {processing && <ProgressBar value={progress} />}
      {result && <ResultPanel result={result} />}
      <RelatorioMensalSection />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────

const TABS = [
  { id: 'efetivo',                   label: 'Efetivo'                    },
  { id: 'alocacoes',                 label: 'Alocações Mensais'          },
  { id: 'ferias',                    label: 'Férias'                     },
  { id: 'coberturas-insalubridade',  label: 'Coberturas Insalubridade'   },
  { id: 'mudancas',                  label: 'Mudanças de Função'         },
  { id: 'advertencias',              label: 'Advertências'               },
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
      <div className={active !== 'ferias'       ? 'hidden' : ''}><TabFerias /></div>
      <div className={active !== 'coberturas-insalubridade'  ? 'hidden' : ''}><TabCoberturaInsalubridade /></div>
      <div className={active !== 'mudancas'                  ? 'hidden' : ''}><TabMudancasFuncao /></div>
      <div className={active !== 'advertencias' ? 'hidden' : ''}><TabAdvertencias /></div>
    </div>
  )
}
