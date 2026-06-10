import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProntuarioClient } from '@/components/efetivo/prontuario-client'

export interface ProntuarioFuncionario {
  id: string
  nome: string
  cpf: string | null
  funcao: string | null
  posto: string | null
  secretaria: string | null
  status: string | null
  data_admissao: string | null
}

export interface ProntuarioEvento {
  id: string
  tipo: string
  data: string
  descricao: string | null
  dados_anteriores: Record<string, unknown> | null
  dados_novos: Record<string, unknown> | null
}

function isoToDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  return iso.split('T')[0]
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = iso.split('T')[0]
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

export default async function ProntuarioPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { id } = params

  const [
    { data: funcRaw },
    { data: historico },
    { data: ferias },
    { data: atestados },
    { data: faltas },
    { data: advertencias },
  ] = await Promise.all([
    supabase
      .from('funcionarios')
      .select('id, nome, cpf, status, data_admissao, funcoes!funcao_id(nome), postos!posto_id(nome, secretaria)')
      .eq('id', id)
      .single(),
    supabase
      .from('historico_funcionarios')
      .select('*')
      .eq('funcionario_id', id)
      .order('data_evento', { ascending: false }),
    supabase
      .from('ferias')
      .select('*')
      .eq('funcionario_id', id)
      .order('data_inicio', { ascending: false }),
    supabase
      .from('atestados')
      .select('*')
      .eq('funcionario_id', id)
      .order('data_inicio', { ascending: false }),
    supabase
      .from('faltas')
      .select('*')
      .eq('funcionario_id', id)
      .order('data_falta', { ascending: false }),
    supabase
      .from('advertencias')
      .select('*')
      .eq('funcionario_id', id)
      .order('data_ocorrencia', { ascending: false }),
  ])

  if (!funcRaw) notFound()

  const f = funcRaw as unknown as {
    id: string
    nome: string
    cpf: string | null
    status: string | null
    data_admissao: string | null
    funcoes: { nome: string } | null
    postos: { nome: string; secretaria: string | null } | null
  }

  const funcionario: ProntuarioFuncionario = {
    id: f.id,
    nome: f.nome,
    cpf: f.cpf,
    funcao: f.funcoes?.nome ?? null,
    posto: f.postos?.nome ?? null,
    secretaria: f.postos?.secretaria ?? null,
    status: f.status,
    data_admissao: f.data_admissao,
  }

  // Track historico entries to avoid duplicates from individual tables
  const historicoSet = new Set(
    (historico ?? []).map(e => `${e.tipo}:${e.data_evento}`)
  )

  const eventos: ProntuarioEvento[] = [
    // Primary: historico entries (triggers + manual)
    ...(historico ?? []).map(e => ({
      id: e.id,
      tipo: e.tipo,
      data: e.data_evento,
      descricao: e.descricao ?? null,
      dados_anteriores: e.dados_anteriores as Record<string, unknown> | null,
      dados_novos: e.dados_novos as Record<string, unknown> | null,
    })),

    // Supplementary férias (fallback for data before triggers)
    ...(ferias ?? [])
      .filter(fe => fe.data_inicio && !historicoSet.has(`ferias:${fe.data_inicio}`))
      .map(fe => ({
        id: `ferias-${fe.id}`,
        tipo: 'ferias' as const,
        data: fe.data_inicio!,
        descricao: `Férias: ${fmt(fe.data_inicio)} a ${fmt(fe.data_fim)}${fe.dias_utilizados ? ` (${fe.dias_utilizados}d)` : ''}`,
        dados_anteriores: null,
        dados_novos: { status: fe.status, data_inicio: fe.data_inicio, data_fim: fe.data_fim, dias_utilizados: fe.dias_utilizados } as Record<string, unknown>,
      })),

    // Supplementary atestados
    ...(atestados ?? [])
      .filter(at => !historicoSet.has(`atestado:${at.data_inicio}`))
      .map(at => ({
        id: `atestado-${at.id}`,
        tipo: 'atestado' as const,
        data: at.data_inicio,
        descricao: `Atestado: ${fmt(at.data_inicio)} a ${fmt(at.data_fim)}${at.motivo ? ` — ${at.motivo}` : ''}`,
        dados_anteriores: null,
        dados_novos: { cid: at.cid, motivo: at.motivo } as Record<string, unknown>,
      })),

    // Supplementary faltas
    ...(faltas ?? [])
      .filter(fa => !historicoSet.has(`falta:${fa.data_falta}`))
      .map(fa => ({
        id: `falta-${fa.id}`,
        tipo: 'falta' as const,
        data: fa.data_falta,
        descricao: `Falta — ${fa.tipo}${fa.observacao ? `: ${fa.observacao}` : ''}`,
        dados_anteriores: null,
        dados_novos: { tipo: fa.tipo, dias: fa.dias, justificativa: fa.justificativa } as Record<string, unknown>,
      })),

    // Supplementary advertências/suspensões
    ...(advertencias ?? [])
      .filter(ad => {
        const data = isoToDate(ad.data_ocorrencia) ?? isoToDate(ad.created_at)
        const tipo = ad.grau === 'suspensao' ? 'suspensao' : 'advertencia'
        return data ? !historicoSet.has(`${tipo}:${data}`) : true
      })
      .map(ad => {
        const tipo = ad.grau === 'suspensao' ? 'suspensao' : 'advertencia'
        const data = isoToDate(ad.data_ocorrencia) ?? isoToDate(ad.created_at) ?? new Date().toISOString().split('T')[0]
        return {
          id: `advertencia-${ad.id}`,
          tipo,
          data,
          descricao: ad.descricao ?? null,
          dados_anteriores: null,
          dados_novos: { grau: ad.grau, tipo: ad.tipo, dias_suspensao: ad.dias_suspensao } as Record<string, unknown>,
        }
      }),
  ]

  eventos.sort((a, b) => b.data.localeCompare(a.data))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Prontuário</h1>
        <p className="text-sm text-gray-400">Histórico completo do funcionário</p>
      </div>
      <ProntuarioClient funcionario={funcionario} eventos={eventos} />
    </div>
  )
}
