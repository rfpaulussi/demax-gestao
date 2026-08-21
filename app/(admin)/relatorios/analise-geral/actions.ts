'use server'

import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { getUser } from '@/lib/auth/get-user'
import { FALTA_TIPO_LABELS } from '@/components/faltas/faltas-config'

export interface AnaliseGeralSecoes {
  atestados: boolean
  faltas: boolean
  mudancasFuncao: boolean
  coberturasInsalubres: boolean
  efetivoPostos: boolean
  advertencias: boolean
}

export interface AnaliseGeralParams {
  periodoDias: number
  secoes: AnaliseGeralSecoes
}

type FuncJoin = {
  nome: string
  registro: string | null
  posto_id: string | null
  postos: { nome: string; secretaria: string | null } | null
}

function fmtData(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function esc(v: string | number | null | undefined): string {
  return String(v ?? '—').replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

function mdTable(headers: string[], rows: (string | number)[][]): string {
  if (rows.length === 0) return 'Nenhum registro no período.\n'
  const head = `| ${headers.join(' | ')} |`
  const sep = `| ${headers.map(() => '---').join(' | ')} |`
  const body = rows.map(r => `| ${r.map(esc).join(' | ')} |`).join('\n')
  return `${head}\n${sep}\n${body}\n`
}

function diasEntre(inicio: string, fim: string): number {
  const ms = new Date(fim).getTime() - new Date(inicio).getTime()
  return Math.round(ms / 86400000) + 1
}

type AtestadoRaw = {
  id: string
  data_inicio: string
  data_fim: string
  motivo: string | null
  sem_cid: boolean | null
  cid_codigo: string | null
  funcionarios: FuncJoin | null
}

async function secaoAtestados(inicio: string, fim: string): Promise<string> {
  const supabase = createClient()

  const [atestados, { data: cids }] = await Promise.all([
    fetchAllRows<AtestadoRaw>((from, to) =>
      supabase
        .from('atestados')
        .select(`
          id, data_inicio, data_fim, motivo, sem_cid, cid_codigo,
          funcionarios!funcionario_id ( nome, registro, posto_id, postos!posto_id ( nome, secretaria ) )
        `)
        .gte('data_inicio', inicio)
        .lte('data_inicio', fim)
        .order('data_inicio', { ascending: true })
        .range(from, to) as unknown as PromiseLike<{ data: AtestadoRaw[] | null; error: { message: string } | null }>,
    ),
    supabase.from('cid_referencia').select('codigo, descricao'),
  ])

  const cidByCodigo = new Map<string, string>((cids ?? []).map(c => [c.codigo, c.descricao]))

  const rows = atestados.map(a => {
    const func = a.funcionarios
    const cid = a.cid_codigo
      ? `${a.cid_codigo} - ${cidByCodigo.get(a.cid_codigo) ?? ''}`
      : a.sem_cid ? 'Sem CID' : '—'
    return [
      func?.nome ?? '—',
      func?.postos?.nome ?? '—',
      func?.postos?.secretaria ?? '—',
      `${fmtData(a.data_inicio)}–${fmtData(a.data_fim)}`,
      diasEntre(a.data_inicio, a.data_fim),
      cid,
      a.motivo ?? '—',
    ]
  })

  return `## Atestados\n\n${mdTable(
    ['Funcionário', 'Posto', 'Secretaria', 'Período', 'Dias', 'CID', 'Motivo'],
    rows,
  )}`
}

type FaltaRaw = {
  id: string
  data_falta: string
  tipo: string
  dias: number
  observacao: string | null
  funcionarios: FuncJoin | null
}

async function secaoFaltas(inicio: string, fim: string): Promise<string> {
  const supabase = createClient()

  const faltas = await fetchAllRows<FaltaRaw>((from, to) =>
    supabase
      .from('faltas')
      .select(`
        id, data_falta, tipo, dias, observacao,
        funcionarios!funcionario_id ( nome, registro, posto_id, postos!posto_id ( nome, secretaria ) )
      `)
      .gte('data_falta', inicio)
      .lte('data_falta', fim)
      .order('data_falta', { ascending: true })
      .range(from, to) as unknown as PromiseLike<{ data: FaltaRaw[] | null; error: { message: string } | null }>,
  )

  const rows = faltas.map(f => {
    const func = f.funcionarios
    return [
      fmtData(f.data_falta),
      func?.nome ?? '—',
      func?.postos?.nome ?? '—',
      func?.postos?.secretaria ?? '—',
      FALTA_TIPO_LABELS[f.tipo as keyof typeof FALTA_TIPO_LABELS] ?? f.tipo,
      f.dias,
      f.observacao ?? '—',
    ]
  })

  return `## Faltas\n\n${mdTable(
    ['Data', 'Funcionário', 'Posto', 'Secretaria', 'Tipo', 'Dias', 'Observação'],
    rows,
  )}`
}
