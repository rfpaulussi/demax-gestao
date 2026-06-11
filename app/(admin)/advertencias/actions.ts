'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

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

export async function buscarAdvertencias(): Promise<AdvertenciaCompleta[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('advertencias')
    .select(ADV_SELECT)
    .order('data_ocorrencia', { ascending: false })
  return (data ?? []) as unknown as AdvertenciaCompleta[]
}

export async function buscarFuncionariosAtivos(): Promise<FuncionarioOpt[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('funcionarios')
    .select('id, nome, postos!posto_id(nome, secretaria)')
    .in('status', ['ativo', 'ferias', 'afastado'])
    .order('nome')
  return (data ?? []) as unknown as FuncionarioOpt[]
}

export async function criarAdvertencia(formData: FormData) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const grau = (formData.get('grau') as string) || null
  const diasRaw = formData.get('dias_suspensao')

  const { error } = await supabase.from('advertencias').insert({
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
      const { error: faltaError } = await supabase.from('faltas').insert({
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

  revalidatePath('/advertencias')
  revalidatePath('/faltas')
}

export async function marcarEntregue(formData: FormData) {
  const supabase = createClient()
  const advertencia_id = formData.get('advertencia_id') as string
  await supabase
    .from('advertencias')
    .update({ status: 'entregue' })
    .eq('id', advertencia_id)
  revalidatePath('/advertencias')
}

export async function marcarGerada(formData: FormData) {
  const supabase = createClient()
  const advertencia_id = formData.get('advertencia_id') as string
  await supabase
    .from('advertencias')
    .update({ status: 'gerada' })
    .eq('id', advertencia_id)
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
