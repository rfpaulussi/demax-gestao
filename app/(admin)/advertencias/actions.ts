'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUser } from '@/lib/auth/get-user'
import { logSupervisorAcao } from '@/lib/log-supervisor'

export type AdvertenciaGrau = 'verbal' | 'escrita' | 'suspensao'
export type AdvertenciaStatus = 'pendente' | 'gerada' | 'entregue'

export interface AdvertenciaCompleta {
  id: string
  funcionario_id: string
  tipo: string | null
  grau: AdvertenciaGrau | null
  descricao: string | null
  data_ocorrencia: string | null
  horario_fato: string | null
  natureza: string | null
  relato: string | null
  testemunha_1: string | null
  testemunha_2: string | null
  defesa_colaborador: string | null
  dias_suspensao: number | null
  data_aplicacao: string | null
  pdf_url: string | null
  status: AdvertenciaStatus | null
  criado_por: string | null
  registrado_por: string | null
  created_at: string
  funcionarios: {
    id: string
    nome: string
    cpf: string | null
    funcoes: { nome: string } | null
    postos: { nome: string; secretaria: string | null } | null
  } | null
}

export interface FuncionarioOpt {
  id: string
  nome: string
  postos: { nome: string; secretaria: string | null } | null
}

const ADV_SELECT = `
  id, funcionario_id, tipo, grau, descricao, data_ocorrencia, horario_fato,
  natureza, relato, testemunha_1, testemunha_2, defesa_colaborador,
  dias_suspensao, data_aplicacao, pdf_url, status, criado_por, registrado_por, created_at,
  funcionarios!funcionario_id (
    id, nome, cpf,
    funcoes!funcao_id ( nome ),
    postos!posto_id ( nome, secretaria )
  )
`

async function getPostoIdsSupervisor(supabase: ReturnType<typeof createClient>, userId: string): Promise<string[] | null> {
  const { data: cfgData } = await supabase
    .from('config_supervisores_postos')
    .select('posto_id')
    .eq('supervisor_id', userId)
    .eq('ativo', true)
  return (cfgData ?? []).map((r: { posto_id: string }) => r.posto_id)
}

export async function buscarAdvertencias(): Promise<AdvertenciaCompleta[]> {
  const supabase = createClient()
  const auth = await getUser()

  let query = supabase
    .from('advertencias')
    .select(ADV_SELECT)
    .order('data_ocorrencia', { ascending: false })

  if (auth?.perfil.role === 'supervisor') {
    const postoIds = await getPostoIdsSupervisor(supabase, auth.user.id)
    if (!postoIds || postoIds.length === 0) return []
    const { data: funcs } = await supabase
      .from('funcionarios').select('id').in('posto_id', postoIds)
    const funcIds = (funcs ?? []).map((f: { id: string }) => f.id)
    if (funcIds.length === 0) return []
    query = query.in('funcionario_id', funcIds)
  }

  const { data } = await query
  return (data ?? []) as unknown as AdvertenciaCompleta[]
}

export async function buscarFuncionariosAtivos(): Promise<FuncionarioOpt[]> {
  const supabase = createClient()
  const auth = await getUser()

  let query = supabase
    .from('funcionarios')
    .select('id, nome, postos!posto_id(nome, secretaria)')
    .in('status', ['ativo', 'ferias', 'afastado'])
    .order('nome')

  if (auth?.perfil.role === 'supervisor') {
    const postoIds = await getPostoIdsSupervisor(supabase, auth.user.id)
    if (!postoIds || postoIds.length === 0) return []
    query = query.in('posto_id', postoIds)
  }

  const { data } = await query
  return (data ?? []) as unknown as FuncionarioOpt[]
}

export async function criarAdvertencia(formData: FormData) {
  const supabase = createClient()
  const adminSupabase = createAdminClient()
  const auth = await getUser()

  const { data: { user } } = await supabase.auth.getUser()

  const grau = (formData.get('grau') as string) || null
  const diasRaw = formData.get('dias_suspensao')

  const { error } = await adminSupabase.from('advertencias').insert({
    funcionario_id: formData.get('funcionario_id') as string,
    tipo: grau,
    grau: grau as AdvertenciaGrau | null,
    descricao: (formData.get('descricao') as string) || null,
    data_ocorrencia: (formData.get('data_ocorrencia') as string) || null,
    horario_fato: (formData.get('horario_fato') as string) || null,
    natureza: (formData.get('natureza') as string) || null,
    relato: (formData.get('relato') as string) || null,
    testemunha_1: (formData.get('testemunha_1') as string) || null,
    testemunha_2: (formData.get('testemunha_2') as string) || null,
    defesa_colaborador: (formData.get('defesa_colaborador') as string) || null,
    dias_suspensao: diasRaw ? Number(diasRaw) : null,
    data_aplicacao: (formData.get('data_aplicacao') as string) || null,
    registrado_por: (formData.get('registrado_por') as string) || null,
    criado_por: user?.id ?? null,
    status: 'pendente',
  })

  if (error) throw new Error(error.message)

  if (grau === 'suspensao' && diasRaw && Number(diasRaw) > 0) {
    const dataFalta =
      (formData.get('data_aplicacao') as string) ||
      (formData.get('data_ocorrencia') as string) ||
      null
    if (dataFalta) {
      const { error: faltaError } = await adminSupabase.from('faltas').insert({
        funcionario_id: formData.get('funcionario_id') as string,
        data_falta:     dataFalta,
        data_fim:       null,
        tipo:           'suspensao',
        dias:           Number(diasRaw),
        observacao:     'Suspensão gerada automaticamente via advertência',
        registrado_por: user?.id ?? null,
      } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      if (faltaError) console.error('[advertencias] falha ao registrar falta de suspensão:', faltaError.message)
    }
  }

  if (auth?.perfil.role === 'supervisor' && user) {
    const { data: func } = await adminSupabase.from('funcionarios').select('nome').eq('id', formData.get('funcionario_id') as string).single()
    await logSupervisorAcao({ supervisorId: user.id, tipo: 'advertencia', acao: 'criou', funcionarioNome: (func as any)?.nome ?? null, detalhes: grau ?? null }) // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  revalidatePath('/advertencias')
  revalidatePath('/faltas')
}

export async function marcarEntregue(formData: FormData) {
  const supabase = createAdminClient()
  const advertencia_id = formData.get('advertencia_id') as string
  const { error } = await supabase
    .from('advertencias')
    .update({ status: 'entregue' })
    .eq('id', advertencia_id)
  if (error) console.error('[advertencias] marcarEntregue:', error.message)
  revalidatePath('/advertencias')
}

export async function marcarGerada(formData: FormData) {
  const supabase = createAdminClient()
  const advertencia_id = formData.get('advertencia_id') as string
  const { error } = await supabase
    .from('advertencias')
    .update({ status: 'gerada' })
    .eq('id', advertencia_id)
  if (error) console.error('[advertencias] marcarGerada:', error.message)
  revalidatePath('/advertencias')
}

export async function gerarPDFAdvertencia(id: string): Promise<AdvertenciaCompleta | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('advertencias')
    .select(ADV_SELECT)
    .eq('id', id)
    .single()
  return (data ?? null) as unknown as AdvertenciaCompleta | null
}

export type SupervisorOpt = {
  id: string
  nome: string
}

export type HistoricoAdvertencia = {
  id: string
  grau: string
  natureza: string | null
  natureza_label: string
  dias_suspensao: number | null
  data_ocorrencia: string | null
  data_fmt: string
  dias_atras: number
}

const NATUREZA_LABEL_MAP: Record<string, string> = {
  comportamento:  'Comportamento Inadequado',
  falta:          'Falta Injustificada',
  atraso:         'Atraso Recorrente',
  negligencia:    'Negligência no Trabalho',
  descumprimento: 'Descumprimento de Normas',
  insubordinacao: 'Insubordinação',
  'desídia':      'Desídia',
  improbidade:    'Improbidade',
  ofensa_honra:   'Ofensa à Honra',
  uso_indevido:   'Uso Indevido de Equipamentos',
  abandono:       'Abandono de Posto',
  outro:          'Outro',
}

export async function buscarSupervisoresParaAdvertencia(): Promise<SupervisorOpt[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('config_supervisores_postos')
    .select('supervisor_id, perfis(id, nome)')
    .eq('ativo', true)
  if (!data) return []
  const vistos = new Set<string>()
  const result: SupervisorOpt[] = []
  for (const row of data) {
    const perfil = Array.isArray(row.perfis) ? row.perfis[0] : row.perfis
    if (perfil?.id && !vistos.has(perfil.id)) {
      vistos.add(perfil.id)
      result.push({ id: perfil.id, nome: perfil.nome })
    }
  }
  return result.sort((a, b) => a.nome.localeCompare(b.nome))
}

export async function buscarHistoricoAdvertencias(funcionario_id: string): Promise<HistoricoAdvertencia[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('advertencias')
    .select('id, grau, natureza, dias_suspensao, data_ocorrencia')
    .eq('funcionario_id', funcionario_id)
    .order('data_ocorrencia', { ascending: false })
    .limit(10)
  if (!data) return []
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  return data.map(a => {
    const d = a.data_ocorrencia ? new Date(a.data_ocorrencia + 'T00:00:00') : null
    const dias_atras = d ? Math.round((hoje.getTime() - d.getTime()) / 86400000) : 0
    const data_fmt = d ? d.toLocaleDateString('pt-BR') : '—'
    return {
      id: a.id,
      grau: a.grau ?? '',
      natureza: a.natureza,
      natureza_label: a.natureza ? (NATUREZA_LABEL_MAP[a.natureza] ?? a.natureza) : '—',
      dias_suspensao: a.dias_suspensao,
      data_ocorrencia: a.data_ocorrencia,
      data_fmt,
      dias_atras,
    }
  })
}

export async function editarAdvertencia(data: {
  id: string
  funcionario_id: string
  data_ocorrencia: string
  horario_fato?: string | null
  natureza?: string | null
  relato?: string | null
  descricao?: string | null
  grau: string
  dias_suspensao?: number | null
  data_aplicacao?: string | null
  registrado_por?: string | null
  testemunha_1?: string | null
  testemunha_2?: string | null
  defesa_colaborador?: string | null
}) {
  const supabase = createClient()
  const auth = await getUser()
  const { error } = await supabase
    .from('advertencias')
    .update({
      data_ocorrencia:    data.data_ocorrencia,
      horario_fato:       data.horario_fato ?? null,
      natureza:           data.natureza ?? null,
      relato:             data.relato ?? null,
      descricao:          data.descricao ?? null,
      grau:               data.grau as AdvertenciaGrau,
      dias_suspensao:     data.grau === 'suspensao' ? (data.dias_suspensao ?? null) : null,
      data_aplicacao:     data.data_aplicacao ?? null,
      registrado_por:     data.registrado_por ?? null,
      testemunha_1:       data.testemunha_1 ?? null,
      testemunha_2:       data.testemunha_2 ?? null,
      defesa_colaborador: data.defesa_colaborador ?? null,
    })
    .eq('id', data.id)
  if (error) throw new Error(error.message)

  if (auth?.perfil.role === 'supervisor') {
    const { data: func } = await createAdminClient().from('funcionarios').select('nome').eq('id', data.funcionario_id).single()
    await logSupervisorAcao({ supervisorId: auth.user.id, tipo: 'advertencia', acao: 'editou', funcionarioNome: (func as any)?.nome ?? null }) // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  revalidatePath('/advertencias')
}

export async function excluirAdvertencia(id: string) {
  const supabase = createClient()
  const auth = await getUser()

  const { data: adv } = await supabase.from('advertencias').select('funcionario_id, funcionarios!funcionario_id(nome)').eq('id', id).single()
  const { error } = await supabase.from('advertencias').delete().eq('id', id)
  if (error) throw new Error(error.message)

  if (auth?.perfil.role === 'supervisor') {
    const nomeFuncionario = (adv as any)?.funcionarios?.nome ?? null // eslint-disable-line @typescript-eslint/no-explicit-any
    await logSupervisorAcao({ supervisorId: auth.user.id, tipo: 'advertencia', acao: 'excluiu', funcionarioNome: nomeFuncionario })
  }

  revalidatePath('/advertencias')
}
