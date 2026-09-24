'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUser } from '@/lib/auth/get-user'
import { montarDiffs, tipoDoTermo, tituloDoTermo, paraHorario, TURNO_COLUNAS, type TurnoRow } from './montar-termo'
import { consolidarTurnos, exigeTermo } from './exige-termo'
import type { HorarioTermo, TermoData } from './tipos'

type NomeRel = { nome: string | null } | null

type MovRow = {
  id: string
  tipo: string
  campo_alterado: string | null
  valor_antes: string | null
  valor_depois: string | null
  created_at: string | null
  funcionario_id: string
  solicitacao_id: string | null
  perfis: NomeRel
}

type SolRow = {
  tipo: string
  motivo: string | null
  dados_antes: Record<string, unknown> | null
  dados_depois: Record<string, unknown> | null
  created_at: string | null
  aprovado_em: string | null
  sol: NomeRel
  apr: NomeRel
}

type FuncRow = {
  id: string
  nome: string
  registro: string | null
  data_admissao: string | null
  posto_id: string | null
  funcoes: NomeRel
  postos: { nome: string | null; secretaria: string | null } | null
}

type Snapshot = {
  supervisor_origem_nome?: string | null
  supervisor_destino_nome?: string | null
  posto_origem_id?: string | null
  posto_destino_id?: string | null
  data_efetivacao?: string | null
}

export async function carregarTermoDaMovimentacao(movId: string): Promise<TermoData | null> {
  const auth = await getUser()
  if (!auth) return null
  const supabase = createClient()
  const { data } = await supabase.from('movimentacoes').select('id, solicitacao_id').eq('id', movId).maybeSingle()
  if (!data) return null
  return carregarTermo(data.solicitacao_id ? `sol:${data.solicitacao_id}` : `mov:${data.id}`)
}

export async function carregarTermo(chave: string): Promise<TermoData | null> {
  const auth = await getUser()
  if (!auth) return null

  const [prefixo, refId] = chave.split(':')
  if (!refId || (prefixo !== 'sol' && prefixo !== 'mov')) return null

  const supabase = createClient()
  const admin = createAdminClient()

  // 1. Linhas de movimentação (RLS valida o acesso)
  const baseSel =
    'id, tipo, campo_alterado, valor_antes, valor_depois, created_at, funcionario_id, solicitacao_id, perfis!executado_por(nome)'
  const q = supabase.from('movimentacoes').select(baseSel)
  const { data: movsRaw } = await (prefixo === 'sol' ? q.eq('solicitacao_id', refId) : q.eq('id', refId))
  const movs = ((movsRaw ?? []) as unknown as MovRow[]).sort((a, b) =>
    (a.created_at ?? '').localeCompare(b.created_at ?? ''),
  )
  if (movs.length === 0) return null

  // 2. Solicitação
  let sol: SolRow | null = null
  if (prefixo === 'sol') {
    const { data } = await supabase
      .from('solicitacoes')
      .select(
        'tipo, motivo, dados_antes, dados_depois, created_at, aprovado_em, sol:perfis!supervisor_id(nome), apr:perfis!aprovado_por(nome)',
      )
      .eq('id', refId)
      .maybeSingle()
    sol = (data as unknown as SolRow | null) ?? null
  }
  const dadosAntes = (sol?.dados_antes ?? {}) as Record<string, unknown>
  const dadosDepois = (sol?.dados_depois ?? {}) as Record<string, unknown>
  const snap = (dadosDepois.termo_snapshot ?? {}) as Snapshot

  // 3. Colaborador
  const funcionarioId = movs[0].funcionario_id
  const { data: funcRaw } = await supabase
    .from('funcionarios')
    .select('id, nome, registro, data_admissao, posto_id, funcoes!funcao_id(nome), postos!posto_id(nome, secretaria)')
    .eq('id', funcionarioId)
    .maybeSingle()
  const func = funcRaw as unknown as FuncRow | null
  if (!func) return null

  // 4. Postos origem/destino
  const houveTransf = movs.some(m => m.tipo === 'transferencia')
  const postoOrigemId =
    snap.posto_origem_id ?? (dadosAntes.posto_id as string | undefined) ?? func.posto_id ?? null
  const postoDestinoId = houveTransf
    ? snap.posto_destino_id ?? (dadosDepois.posto_destino_id as string | undefined) ?? func.posto_id ?? null
    : postoOrigemId
  const idsPosto = [postoOrigemId, postoDestinoId].filter((x): x is string => !!x)
  const postosMap = new Map<string, { nome: string | null; secretaria: string | null }>()
  if (idsPosto.length > 0) {
    const { data } = await admin.from('postos').select('id, nome, secretaria').in('id', idsPosto)
    for (const p of data ?? []) postosMap.set(p.id, { nome: p.nome, secretaria: p.secretaria })
  }
  const postoOrigem = postoOrigemId ? postosMap.get(postoOrigemId) : undefined
  const postoDestino = postoDestinoId ? postosMap.get(postoDestinoId) : undefined

  // 5. Função
  const funcaoMov = movs.find(m => m.campo_alterado === 'funcao_id')
  const funcaoAtual = func.funcoes?.nome ?? null
  let funcaoAntes = funcaoAtual
  let funcaoDepois = funcaoAtual
  if (funcaoMov) {
    const ids = [funcaoMov.valor_antes, funcaoMov.valor_depois].filter((x): x is string => !!x)
    const { data } = ids.length > 0 ? await admin.from('funcoes').select('id, nome').in('id', ids) : { data: [] }
    const nomes = new Map((data ?? []).map(f => [f.id, f.nome as string]))
    funcaoAntes = funcaoMov.valor_antes ? nomes.get(funcaoMov.valor_antes) ?? null : null
    funcaoDepois = funcaoMov.valor_depois ? nomes.get(funcaoMov.valor_depois) ?? null : null
  }

  // 6. Horário (consolida todos os movimentos de turno do grupo)
  const horMovs = movs.filter(m => m.tipo === 'mudanca_horario')
  const turnosIds = consolidarTurnos(horMovs)
  let horario: { antes: HorarioTermo | null; depois: HorarioTermo | null } | undefined
  if (turnosIds) {
    const ids = [turnosIds.antesId, turnosIds.depoisId].filter((x): x is string => !!x)
    const { data } =
      ids.length > 0
        ? await admin.from('turnos_postos').select(TURNO_COLUNAS).in('id', ids)
        : { data: [] }
    const turnos = new Map(((data ?? []) as TurnoRow[]).map(t => [t.id, t]))
    horario = {
      antes: paraHorario(turnosIds.antesId ? turnos.get(turnosIds.antesId) : undefined),
      depois: paraHorario(turnosIds.depoisId ? turnos.get(turnosIds.depoisId) : undefined),
    }
  }

  // 7. Supervisores
  const manual = !sol
  const supervisorOrigem = snap.supervisor_origem_nome ?? null
  let supervisorDestino = snap.supervisor_destino_nome ?? sol?.sol?.nome ?? null
  if (manual) {
    // Termo manual: supervisor ATUAL do posto (config_supervisores_postos)
    const postoAtual = func.posto_id ?? postoDestinoId
    if (postoAtual) {
      const { data } = await admin
        .from('config_supervisores_postos')
        .select('perfis!supervisor_id(nome)')
        .eq('posto_id', postoAtual)
      const nomes = ((data ?? []) as unknown as { perfis: NomeRel }[])
        .map(r => r.perfis?.nome)
        .filter((n): n is string => !!n)
        .sort()
      if (nomes.length > 0) supervisorDestino = nomes.join(' / ')
    }
  }

  // 8. Diffs, título, código
  const tipos = Array.from(new Set([...(sol ? [sol.tipo] : []), ...movs.map(m => m.tipo)]))
  const tiposMov = Array.from(new Set(movs.map(m => m.tipo)))
  const diffs = montarDiffs({
    posto: { antes: postoOrigem?.nome ?? null, depois: postoDestino?.nome ?? null },
    secretaria: { antes: postoOrigem?.secretaria ?? null, depois: postoDestino?.secretaria ?? null },
    // origem desconhecida (manual/legado): não afirma troca de supervisor
    supervisor: supervisorOrigem ? { antes: supervisorOrigem, depois: supervisorDestino } : undefined,
    funcao: { antes: funcaoAntes, depois: funcaoDepois },
    horario,
  })
  const exige = exigeTermo({ tipos: tiposMov, horario, supervisorOrigem, supervisorDestino })
  const idBase = sol ? refId : movs[0].id
  const tiposTermo = sol ? tipos : tiposMov

  // 9. Efetivação
  const efetivacao = snap.data_efetivacao ?? (movs[0].created_at ? movs[0].created_at.slice(0, 10) : null)

  return {
    chave,
    codigo: 'MOV-' + idBase.slice(0, 8).toUpperCase(),
    tipo: tipoDoTermo(tiposTermo),
    titulo: tituloDoTermo(tiposTermo),
    tiposIncluidos: tiposTermo,
    colaborador: {
      id: func.id,
      nome: func.nome,
      registro: func.registro,
      funcao: funcaoDepois ?? funcaoAtual,
      admissao: func.data_admissao,
    },
    diffs,
    efetivacao,
    solicitadoPor: sol ? sol.sol?.nome ?? null : null,
    solicitadoEm: sol?.created_at ?? null,
    aprovadoPor: sol ? sol.apr?.nome ?? null : null,
    aprovadoEm: sol ? sol.aprovado_em : null,
    motivo: sol?.motivo ?? null,
    supervisorOrigem,
    supervisorDestino,
    emitidoEm: new Date().toISOString(),
    manual,
    registradoPor: manual ? movs[0].perfis?.nome ?? null : null,
    registradoEm: manual ? movs[0].created_at : null,
    exigeTermo: exige,
  }
}
