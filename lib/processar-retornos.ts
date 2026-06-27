'use server'

import { createAdminClient } from './supabase/admin'
import { revalidatePath } from 'next/cache'

export type ResultadoRetorno = {
  processados: number
  nomes: string[]
}

/**
 * Retorna automaticamente a "ativo" funcionários afastados cujo período terminou.
 *
 * Protegidos (NÃO retornam automaticamente):
 * - motivo_afastamento = 'inss'
 * - Têm registro ativo em `afastamentos` (data_fim_prevista >= hoje ou nula)
 * - Têm atestado ainda válido (atestados.data_fim >= hoje)
 * - Têm falta multi-dia ainda vigente (faltas.data_fim >= hoje)
 */
export async function processarRetornosAtestado(): Promise<ResultadoRetorno> {
  const admin = createAdminClient()
  const hoje  = new Date().toISOString().split('T')[0]

  // 1. Afastados que NÃO são INSS (motivo_afastamento != 'inss')
  const { data: afastados } = await admin
    .from('funcionarios')
    .select('id, nome')
    .eq('status', 'afastado')
    .neq('motivo_afastamento', 'inss')

  if (!afastados || afastados.length === 0) return { processados: 0, nomes: [] }

  const ids = afastados.map((f: { id: string }) => f.id)

  // 2. Quem ainda tem atestado ativo (data_fim >= hoje)
  const { data: atestadosAtivos } = await admin
    .from('atestados')
    .select('funcionario_id')
    .in('funcionario_id', ids)
    .gte('data_fim', hoje)

  const comAtestadoAtivo = new Set(
    (atestadosAtivos ?? []).map((a: { funcionario_id: string }) => a.funcionario_id)
  )

  // 3. Quem tem falta multi-dia ainda vigente (data_fim >= hoje)
  const { data: faltasAtivas } = await admin
    .from('faltas')
    .select('funcionario_id')
    .in('funcionario_id', ids)
    .gte('data_fim', hoje)

  const comFaltaAtiva = new Set(
    (faltasAtivas ?? []).map((f: { funcionario_id: string }) => f.funcionario_id)
  )

  // 4. Quem tem afastamento formal ativo (segurança extra além do motivo_afastamento)
  const { data: afastamentosAtivos } = await admin
    .from('afastamentos')
    .select('funcionario_id')
    .in('funcionario_id', ids)
    .or(`data_fim_prevista.is.null,data_fim_prevista.gte.${hoje}`)

  const comAfastamentoAtivo = new Set(
    (afastamentosAtivos ?? []).map((a: { funcionario_id: string }) => a.funcionario_id)
  )

  // 5. Candidatos: sem nenhum impedimento ativo
  const retornar = afastados.filter(
    (f: { id: string; nome: string }) =>
      !comAtestadoAtivo.has(f.id) &&
      !comFaltaAtiva.has(f.id) &&
      !comAfastamentoAtivo.has(f.id)
  )

  if (retornar.length === 0) return { processados: 0, nomes: [] }

  // 6. Atualizar para ativo
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
