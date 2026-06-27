'use server'

import { createAdminClient } from './supabase/admin'
import { revalidatePath } from 'next/cache'

export type ResultadoRetorno = {
  processados: number
  nomes: string[]
}

/**
 * Retorna automaticamente a "ativo" todos os funcionários afastados cujo
 * atestado já terminou E que não possuem afastamento INSS ativo.
 *
 * Regras:
 * - status = 'afastado'
 * - Todos os atestados têm data_fim < hoje (nenhum ativo)
 * - Não há afastamento INSS ativo (data_fim_prevista futura ou nula)
 */
export async function processarRetornosAtestado(): Promise<ResultadoRetorno> {
  const admin = createAdminClient()
  const hoje  = new Date().toISOString().split('T')[0]

  // 1. Buscar todos os funcionários afastados
  const { data: afastados } = await admin
    .from('funcionarios')
    .select('id, nome')
    .eq('status', 'afastado')

  if (!afastados || afastados.length === 0) return { processados: 0, nomes: [] }

  const ids = afastados.map((f: { id: string }) => f.id)

  // 2. Quem ainda tem atestado ativo hoje (data_fim >= hoje)
  const { data: atestadosAtivos } = await admin
    .from('atestados')
    .select('funcionario_id')
    .in('funcionario_id', ids)
    .gte('data_fim', hoje)

  const comAtestadoAtivo = new Set(
    (atestadosAtivos ?? []).map((a: { funcionario_id: string }) => a.funcionario_id)
  )

  // 3. Quem tem afastamento INSS ativo (motivo contém INSS ou data_fim_prevista futura/nula)
  const { data: inssAtivos } = await admin
    .from('afastamentos')
    .select('funcionario_id')
    .in('funcionario_id', ids)
    .or(`data_fim_prevista.is.null,data_fim_prevista.gte.${hoje}`)

  const comInssAtivo = new Set(
    (inssAtivos ?? []).map((a: { funcionario_id: string }) => a.funcionario_id)
  )

  // 4. Candidatos a retorno: sem atestado ativo E sem INSS ativo
  const retornar = afastados.filter(
    (f: { id: string; nome: string }) => !comAtestadoAtivo.has(f.id) && !comInssAtivo.has(f.id)
  )

  if (retornar.length === 0) return { processados: 0, nomes: [] }

  // 5. Atualizar para ativo
  const retornarIds = retornar.map((f: { id: string }) => f.id)
  await admin
    .from('funcionarios')
    .update({ status: 'ativo', motivo_afastamento: null })
    .in('id', retornarIds)

  revalidatePath('/efetivo')
  revalidatePath('/dashboard')

  return {
    processados: retornar.length,
    nomes: retornar.map((f: { nome: string }) => f.nome),
  }
}
