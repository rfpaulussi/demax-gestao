'use server'

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/get-user'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

function requireAdminOrCoord(role: string | null) {
  if (!role || !['admin', 'coordenador'].includes(role)) {
    throw new Error('Acesso negado')
  }
}

// ─── leitura ──────────────────────────────────────────────────────────────────

export async function listarConvencoes() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('convencoes_coletivas')
    .select(`
      id, descricao, data_vigencia_inicio, data_vigencia_fim,
      percentual_reajuste, status, created_at, aplicada_em,
      perfis!criada_por(nome)
    `)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function buscarConvencao(id: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('convencoes_coletivas')
    .select(`
      id, descricao, data_vigencia_inicio, data_vigencia_fim,
      percentual_reajuste, observacoes, status, created_at, aplicada_em,
      perfis!criada_por(nome),
      aplicador:perfis!aplicada_por(nome),
      convencao_valores_funcoes(
        id, funcao_id, salario_base, va, vr, vt, enc_inss, fgts,
        assid_asseio, bss, aux_saude, plr, insalubridade_perc,
        insalubridade_valor, periculosidade_perc, periculosidade_valor,
        um_doze_decimo_terceiro, um_terceiro_ferias, enc_provisorio,
        um_doze_lei_12506, multa_40_pct, total_por_func
      )
    `)
    .eq('id', id)
    .single()
  if (error) return null
  return data
}

export async function buscarFuncoesComCustos() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('funcoes')
    .select(`
      id, nome, salario_base, insalubridade_perc, insalubridade_valor,
      periculosidade_perc, periculosidade_valor,
      custos_funcoes(
        va, vr, vt, enc_inss, fgts, assid_asseio, bss, aux_saude, plr,
        um_doze_decimo_terceiro, um_terceiro_ferias, enc_provisorio,
        um_doze_lei_12506, multa_40_pct, total_por_func
      )
    `)
    .eq('ativo', true)
    .order('nome')
  if (error) throw new Error(error.message)
  return data ?? []
}

// ─── criação ──────────────────────────────────────────────────────────────────

export async function criarConvencao(dados: {
  descricao: string
  data_vigencia_inicio: string
  data_vigencia_fim: string
  percentual_reajuste: number | null
  observacoes: string | null
}) {
  const auth = await getUser()
  requireAdminOrCoord(auth?.perfil.role ?? null)

  const supabase = createClient()
  const { data, error } = await supabase
    .from('convencoes_coletivas')
    .insert({
      ...dados,
      status:     'rascunho',
      criada_por: auth!.user.id,
    })
    .select('id')
    .single()

  if (error) return { success: false as const, error: error.message }
  redirect(`/convencoes/${data.id}`)
}

// ─── edição de valores por função ─────────────────────────────────────────────

export type ValorFuncaoInput = {
  funcao_id: string
  salario_base: number
  va?: number | null; vr?: number | null; vt?: number | null
  enc_inss?: number | null; fgts?: number | null
  assid_asseio?: number | null; bss?: number | null; aux_saude?: number | null
  plr?: number | null; insalubridade_perc?: number | null; insalubridade_valor?: number | null
  periculosidade_perc?: number | null; periculosidade_valor?: number | null
  um_doze_decimo_terceiro?: number | null; um_terceiro_ferias?: number | null
  enc_provisorio?: number | null; um_doze_lei_12506?: number | null
  multa_40_pct?: number | null; total_por_func?: number | null
}

export async function salvarValoresFuncoes(convencaoId: string, valores: ValorFuncaoInput[]) {
  const auth = await getUser()
  requireAdminOrCoord(auth?.perfil.role ?? null)

  const supabase = createClient()

  // Verificar que está em rascunho
  const { data: conv } = await supabase
    .from('convencoes_coletivas')
    .select('status')
    .eq('id', convencaoId)
    .single()
  if (conv?.status !== 'rascunho') return { success: false, error: 'Só é possível editar rascunhos' }

  // Deletar valores existentes e reinserir (upsert via delete+insert)
  await supabase.from('convencao_valores_funcoes').delete().eq('convencao_id', convencaoId)

  const inserts = valores.map(v => ({ convencao_id: convencaoId, ...v }))
  const { error } = await supabase.from('convencao_valores_funcoes').insert(inserts)
  if (error) return { success: false, error: error.message }

  revalidatePath(`/convencoes/${convencaoId}`)
  return { success: true }
}

// ─── fluxo de status ──────────────────────────────────────────────────────────

export async function publicarConvencao(id: string) {
  const auth = await getUser()
  requireAdminOrCoord(auth?.perfil.role ?? null)

  const supabase = createClient()

  // Verificar que tem valores para pelo menos uma função
  const { count } = await supabase
    .from('convencao_valores_funcoes')
    .select('*', { count: 'exact', head: true })
    .eq('convencao_id', id)
  if (!count || count === 0) return { success: false, error: 'Adicione os valores das funções antes de publicar' }

  const { error } = await supabase
    .from('convencoes_coletivas')
    .update({ status: 'publicada' })
    .eq('id', id)
    .eq('status', 'rascunho')
  if (error) return { success: false, error: error.message }

  revalidatePath(`/convencoes/${id}`)
  revalidatePath('/convencoes')
  return { success: true }
}

export async function voltarParaRascunho(id: string) {
  const auth = await getUser()
  requireAdminOrCoord(auth?.perfil.role ?? null)

  const supabase = createClient()
  const { error } = await supabase
    .from('convencoes_coletivas')
    .update({ status: 'rascunho' })
    .eq('id', id)
    .eq('status', 'publicada')
  if (error) return { success: false, error: error.message }

  revalidatePath(`/convencoes/${id}`)
  revalidatePath('/convencoes')
  return { success: true }
}

export async function aplicarConvencao(id: string) {
  const auth = await getUser()
  if (!auth || auth.perfil.role !== 'admin') {
    return { success: false, error: 'Somente administradores podem aplicar convenções' }
  }

  const supabase = createClient()

  // Buscar convenção e verificar status
  const { data: conv } = await supabase
    .from('convencoes_coletivas')
    .select('status, percentual_reajuste, convencao_valores_funcoes(*)')
    .eq('id', id)
    .single()

  if (!conv)                      return { success: false, error: 'Convenção não encontrada' }
  if (conv.status !== 'publicada') return { success: false, error: 'A convenção precisa estar publicada para ser aplicada' }

  type ValorRow = {
    funcao_id: string; salario_base: number
    va: number | null; vr: number | null; vt: number | null
    enc_inss: number | null; fgts: number | null
    assid_asseio: number | null; bss: number | null; aux_saude: number | null
    plr: number | null; insalubridade_perc: number | null; insalubridade_valor: number | null
    periculosidade_perc: number | null; periculosidade_valor: number | null
    um_doze_decimo_terceiro: number | null; um_terceiro_ferias: number | null
    enc_provisorio: number | null; um_doze_lei_12506: number | null
    multa_40_pct: number | null; total_por_func: number | null
  }
  const valores = (conv.convencao_valores_funcoes ?? []) as ValorRow[]

  // Aplicar cada função em sequência (transação manual — PostgREST não tem begin/commit via client)
  for (const v of valores) {
    // Atualizar funcoes
    await supabase.from('funcoes').update({
      salario_base:         v.salario_base,
      insalubridade_perc:   v.insalubridade_perc,
      insalubridade_valor:  v.insalubridade_valor,
      periculosidade_perc:  v.periculosidade_perc,
      periculosidade_valor: v.periculosidade_valor,
      updated_at:           new Date().toISOString(),
    }).eq('id', v.funcao_id)

    // Atualizar custos_funcoes
    await supabase.from('custos_funcoes').update({
      va:                      v.va,
      vr:                      v.vr,
      vt:                      v.vt,
      enc_inss:                v.enc_inss,
      fgts:                    v.fgts,
      assid_asseio:            v.assid_asseio,
      bss:                     v.bss,
      aux_saude:               v.aux_saude,
      plr:                     v.plr,
      um_doze_decimo_terceiro: v.um_doze_decimo_terceiro,
      um_terceiro_ferias:      v.um_terceiro_ferias,
      enc_provisorio:          v.enc_provisorio,
      um_doze_lei_12506:       v.um_doze_lei_12506,
      multa_40_pct:            v.multa_40_pct,
      total_por_func:          v.total_por_func,
      updated_at:              new Date().toISOString(),
    }).eq('funcao_id', v.funcao_id)
  }

  // Marcar convenção como aplicada
  const { error: errAplic } = await supabase
    .from('convencoes_coletivas')
    .update({
      status:       'aplicada',
      aplicada_em:  new Date().toISOString(),
      aplicada_por: auth.user.id,
    })
    .eq('id', id)
  if (errAplic) return { success: false, error: errAplic.message }

  revalidatePath(`/convencoes/${id}`)
  revalidatePath('/convencoes')
  return { success: true, funcoes: valores.length }
}
