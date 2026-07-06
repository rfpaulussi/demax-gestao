'use server'

import { createClient } from '@/lib/supabase/server'
import { FUNCOES_FORA_DO_EFETIVO } from '@/lib/constants'

// Espelha exatamente INSALUBRIDADE_POR_SECRETARIA de postos/actions.ts
const INSALUBRIDADE_POR_SECRETARIA: Record<string, string> = {
  SME:   'AGENTE DE HIGIENIZAÇÃO B',
  SMS:   'AGENTE DE HIGIENIZAÇÃO A',
  SMGCP: 'AGENTE DE HIGIENIZAÇÃO B',
  SMMT:  'AGENTE DE HIGIENIZAÇÃO C',
  SMEL:  'AGENTE DE HIGIENIZAÇÃO B',
  SEMAS: 'AGENTE DE HIGIENIZAÇÃO B',
  SMAPA: 'AGENTE DE HIGIENIZAÇÃO B',
  SMSEG: 'AGENTE DE HIGIENIZAÇÃO B',
  SMC:   'AGENTE DE HIGIENIZAÇÃO B',
  SMDET: 'AGENTE DE HIGIENIZAÇÃO B',
  SMASA: 'AGENTE DE HIGIENIZAÇÃO B',
  SMGOV: 'AGENTE DE HIGIENIZAÇÃO B',
  SMSUZ: 'AGENTE DE HIGIENIZAÇÃO B',
  SEDE:  'AGENTE DE HIGIENIZAÇÃO B',
}

export type PostoImpact = {
  id: string
  nome: string
  secretaria: string
  efetivo_previsto: number
  cota_insalubridade: number
  efetivo_atual: number
  insalubridade_atual: number
  efetivo_apos: number
  insalubridade_apos: number
}

export type ImpactoResult = {
  origem: PostoImpact
  destino?: PostoImpact
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQ = { from: (t: string) => any }

/**
 * Calcula o impacto de uma transferência ou mudança de função nos postos afetados.
 * - Se posto_destino_id for fornecido → transferência (origem perde, destino ganha)
 * - Se nova_funcao_nome sem posto_destino_id → mudança de função no mesmo posto
 */
export async function calcularImpactoPosto(params: {
  funcionario_id: string
  posto_destino_id?: string
  nova_funcao_nome?: string
}): Promise<ImpactoResult | null> {
  const { funcionario_id, posto_destino_id, nova_funcao_nome } = params
  const supabase = createClient()

  // 1. Estado atual do funcionário
  const { data: empData } = await (supabase as unknown as AnyQ)
    .from('funcionarios')
    .select('posto_id, status, funcao_id, eh_encarregado_volante, funcoes!funcao_id(nome)')
    .eq('id', funcionario_id)
    .single()

  if (!empData?.posto_id) return null

  const postoOrigemId   = empData.posto_id as string
  const funcaoAtualNome = ((empData.funcoes?.nome ?? '') as string).trim().toUpperCase()
  const ehVolante       = empData.eh_encarregado_volante === true
  const statusAtual     = empData.status as string

  // Mesma lógica de postos/actions.ts: só 'ativo' conta no efetivo, sem volante, sem exclusões
  const contaNoEfetivo = statusAtual === 'ativo' && !ehVolante &&
    !FUNCOES_FORA_DO_EFETIVO.includes(funcaoAtualNome as never)

  // 2. Busca dados dos postos envolvidos e funcionários ativos nesses postos
  const postoIds = [postoOrigemId, ...(posto_destino_id ? [posto_destino_id] : [])]

  const [{ data: postosData }, { data: funcsRaw }, { data: empsAtivos }] = await Promise.all([
    supabase
      .from('postos')
      .select('id, nome, secretaria, efetivo_previsto, cota_insalubridade')
      .in('id', postoIds),
    supabase.from('funcoes').select('id, nome'),
    (supabase as unknown as AnyQ)
      .from('funcionarios')
      .select('id, posto_id, funcao_id, eh_encarregado_volante')
      .in('posto_id', postoIds)
      .eq('status', 'ativo'),
  ])

  if (!postosData?.length) return null

  const funcaoNomeMap = new Map(
    (funcsRaw ?? []).map((f: { id: string; nome: string }) => [f.id, f.nome.trim().toUpperCase()])
  )
  const excludedIds = new Set(
    (funcsRaw ?? [])
      .filter((f: { nome: string }) => FUNCOES_FORA_DO_EFETIVO.includes(f.nome as never))
      .map((f: { id: string }) => f.id)
  )
  const postoSecMap = new Map(
    postosData.map((p: { id: string; secretaria: string | null }) => [p.id, (p.secretaria ?? '').toUpperCase()])
  )
  const postoDataMap = new Map(postosData.map(p => [p.id, p]))

  // 3. Conta efetivo e insalubridade atuais (mesma lógica do postos/actions.ts)
  const efetivoMap = new Map<string, number>()
  const insalubMap = new Map<string, number>()

  for (const e of (empsAtivos ?? []) as { id: string; posto_id: string; funcao_id: string | null; eh_encarregado_volante: boolean | null }[]) {
    const secretaria = postoSecMap.get(e.posto_id) ?? ''
    if (secretaria === 'AFASTADOS') continue
    if (e.eh_encarregado_volante === true) continue
    if (e.funcao_id && excludedIds.has(e.funcao_id)) continue

    efetivoMap.set(e.posto_id, (efetivoMap.get(e.posto_id) ?? 0) + 1)

    const funcNome  = e.funcao_id ? (funcaoNomeMap.get(e.funcao_id) ?? '') : ''
    const expected  = INSALUBRIDADE_POR_SECRETARIA[secretaria]
    if (expected && funcNome === expected) {
      insalubMap.set(e.posto_id, (insalubMap.get(e.posto_id) ?? 0) + 1)
    }
  }

  // 4. Calcula impacto ORIGEM
  const postoOrigem    = postoDataMap.get(postoOrigemId) as { nome: string; secretaria: string | null; efetivo_previsto: number | null; cota_insalubridade: number | null }
  const origemSec      = postoSecMap.get(postoOrigemId) ?? ''
  const efAtualOrigem  = efetivoMap.get(postoOrigemId) ?? 0
  const inAtualOrigem  = insalubMap.get(postoOrigemId) ?? 0

  const funcaoEsperadaOrigem = INSALUBRIDADE_POR_SECRETARIA[origemSec]
  const contaInsalubOrigem   = contaNoEfetivo && funcaoEsperadaOrigem === funcaoAtualNome

  const isMudancaFuncaoApenas = !posto_destino_id && !!nova_funcao_nome

  let efAposOrigem: number
  let inAposOrigem: number

  if (isMudancaFuncaoApenas) {
    // Mudança de função no mesmo posto: efetivo não muda, insalubridade ajusta
    const novaNome       = nova_funcao_nome!.trim().toUpperCase()
    const adicionaInsalub = funcaoEsperadaOrigem && novaNome === funcaoEsperadaOrigem && contaNoEfetivo
    efAposOrigem = efAtualOrigem
    inAposOrigem = inAtualOrigem - (contaInsalubOrigem ? 1 : 0) + (adicionaInsalub ? 1 : 0)
  } else {
    // Transferência: origem perde o funcionário
    efAposOrigem = efAtualOrigem - (contaNoEfetivo ? 1 : 0)
    inAposOrigem = inAtualOrigem - (contaInsalubOrigem ? 1 : 0)
  }

  const origem: PostoImpact = {
    id:                   postoOrigemId,
    nome:                 postoOrigem.nome,
    secretaria:           postoOrigem.secretaria ?? '',
    efetivo_previsto:     postoOrigem.efetivo_previsto ?? 0,
    cota_insalubridade:   postoOrigem.cota_insalubridade ?? 0,
    efetivo_atual:        efAtualOrigem,
    insalubridade_atual:  inAtualOrigem,
    efetivo_apos:         efAposOrigem,
    insalubridade_apos:   inAposOrigem,
  }

  // 5. Calcula impacto DESTINO (transferência)
  let destino: PostoImpact | undefined
  if (posto_destino_id) {
    const postoDestino = postoDataMap.get(posto_destino_id) as { nome: string; secretaria: string | null; efetivo_previsto: number | null; cota_insalubridade: number | null } | undefined
    if (postoDestino) {
      const destSec         = postoSecMap.get(posto_destino_id) ?? ''
      const efAtualDestino  = efetivoMap.get(posto_destino_id) ?? 0
      const inAtualDestino  = insalubMap.get(posto_destino_id) ?? 0

      // Função no destino: nova_funcao_nome se mudando, senão mantém a atual
      const funcaoNoDestino      = (nova_funcao_nome ?? funcaoAtualNome).trim().toUpperCase()
      const funcaoEsperadaDest   = INSALUBRIDADE_POR_SECRETARIA[destSec]
      const adicionaInsalubDest  = !!(funcaoEsperadaDest && funcaoNoDestino === funcaoEsperadaDest)

      destino = {
        id:                   posto_destino_id,
        nome:                 postoDestino.nome,
        secretaria:           postoDestino.secretaria ?? '',
        efetivo_previsto:     postoDestino.efetivo_previsto ?? 0,
        cota_insalubridade:   postoDestino.cota_insalubridade ?? 0,
        efetivo_atual:        efAtualDestino,
        insalubridade_atual:  inAtualDestino,
        efetivo_apos:         efAtualDestino + 1,
        insalubridade_apos:   inAtualDestino + (adicionaInsalubDest ? 1 : 0),
      }
    }
  }

  return { origem, destino }
}
