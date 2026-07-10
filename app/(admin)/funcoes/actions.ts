'use server'

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/get-user'
import { revalidatePath } from 'next/cache'

function requireAdminOrCoord(role: string | null) {
  if (!role || !['admin', 'coordenador'].includes(role)) {
    throw new Error('Acesso negado')
  }
}

export async function listarFuncoes() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('funcoes')
    .select(`
      id, nome, salario_base,
      insalubridade_perc, insalubridade_valor,
      periculosidade_perc, periculosidade_valor,
      custos_funcoes (
        va, vr, vt, enc_inss, fgts, assid_asseio, bss, aux_saude, plr,
        um_doze_decimo_terceiro, um_terceiro_ferias, enc_provisorio,
        um_doze_lei_12506, multa_40_pct, total_por_func
      )
    `)
    .eq('ativo', true)
    .order('nome')
  if (error) throw new Error(error.message)
  // custos_funcoes pode vir como array (PostgREST) — normalizar para objeto
  return (data ?? []).map(f => ({
    ...f,
    custos: Array.isArray(f.custos_funcoes)
      ? (f.custos_funcoes[0] ?? null)
      : (f.custos_funcoes ?? null),
  }))
}

export type CustoFuncaoInput = {
  va?: number | null; vr?: number | null; vt?: number | null
  enc_inss?: number | null; fgts?: number | null
  assid_asseio?: number | null; bss?: number | null; aux_saude?: number | null
  plr?: number | null
  um_doze_decimo_terceiro?: number | null; um_terceiro_ferias?: number | null
  enc_provisorio?: number | null; um_doze_lei_12506?: number | null
  multa_40_pct?: number | null; total_por_func?: number | null
}

export async function atualizarSalarioFuncao(
  funcaoId: string,
  dados: {
    salario_base: number
    insalubridade_perc: number
    insalubridade_valor: number
    periculosidade_perc: number
    periculosidade_valor: number
  } & CustoFuncaoInput
) {
  const auth = await getUser()
  requireAdminOrCoord(auth?.perfil.role ?? null)

  const supabase = createClient()

  // UPDATE funcoes
  const { error } = await supabase
    .from('funcoes')
    .update({
      salario_base:         dados.salario_base,
      insalubridade_perc:   dados.insalubridade_perc,
      insalubridade_valor:  dados.insalubridade_valor,
      periculosidade_perc:  dados.periculosidade_perc,
      periculosidade_valor: dados.periculosidade_valor,
      updated_at:           new Date().toISOString(),
    })
    .eq('id', funcaoId)

  if (error) return { success: false as const, error: error.message }

  // UPSERT custos_funcoes
  const { error: errCustos } = await supabase
    .from('custos_funcoes')
    .upsert({
      funcao_id:               funcaoId,
      va:                      dados.va ?? null,
      vr:                      dados.vr ?? null,
      vt:                      dados.vt ?? null,
      enc_inss:                dados.enc_inss ?? null,
      fgts:                    dados.fgts ?? null,
      assid_asseio:            dados.assid_asseio ?? null,
      bss:                     dados.bss ?? null,
      aux_saude:               dados.aux_saude ?? null,
      plr:                     dados.plr ?? null,
      um_doze_decimo_terceiro: dados.um_doze_decimo_terceiro ?? null,
      um_terceiro_ferias:      dados.um_terceiro_ferias ?? null,
      enc_provisorio:          dados.enc_provisorio ?? null,
      um_doze_lei_12506:       dados.um_doze_lei_12506 ?? null,
      multa_40_pct:            dados.multa_40_pct ?? null,
      total_por_func:          dados.total_por_func ?? null,
      updated_at:              new Date().toISOString(),
    }, { onConflict: 'funcao_id' })

  if (errCustos) return { success: false as const, error: errCustos.message }

  revalidatePath('/funcoes')
  return { success: true as const }
}
