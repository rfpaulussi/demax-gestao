'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUser } from '@/lib/auth/get-user'
import { montarDiffs, tipoDoTermo, tituloDoTermo } from './montar-termo'
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

type TurnoRow = {
  id: string
  nome: string
  tipo_escala: string
  hora_entrada: string
  hora_saida_seg_qui: string
  hora_entrada_sex: string | null
  hora_saida_sex: string | null
  hora_inicio_almoco: string | null
  hora_fim_almoco: string | null
  hora_entrada_sabado: string | null
  hora_saida_sabado: string | null
}

type Snapshot = {
  supervisor_origem_nome?: string | null
  supervisor_destino_nome?: string | null
  posto_origem_id?: string | null
  posto_destino_id?: string | null
  data_efetivacao?: string | null
}

const paraHorario = (t: TurnoRow | undefined): HorarioTermo | null =>
  t
    ? {
        nome: t.nome,
        escala: t.tipo_escala,
        entrada: t.hora_entrada,
        saidaSegQui: t.hora_saida_seg_qui,
        entradaSex: t.hora_entrada_sex,
        saidaSex: t.hora_saida_sex,
        almocoInicio: t.hora_inicio_almoco,
        almocoFim: t.hora_fim_almoco,
        entradaSab: t.hora_entrada_sabado,
        saidaSab: t.hora_saida_sabado,
      }
    : null

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

  // 6. Horário
  const horMov = movs.find(m => m.tipo === 'mudanca_horario')
  let horario: { antes: HorarioTermo | null; depois: HorarioTermo | null } | undefined
  if (horMov) {
    const ids = [horMov.valor_antes, horMov.valor_depois].filter((x): x is string => !!x)
    const { data } =
      ids.length > 0
        ? await admin
            .from('turnos_postos')
            .select(
              'id, nome, tipo_escala, hora_entrada, hora_saida_seg_qui, hora_entrada_sex, hora_saida_sex, hora_inicio_almoco, hora_fim_almoco, hora_entrada_sabado, hora_saida_sabado',
            )
            .in('id', ids)
        : { data: [] }
    const turnos = new Map(((data ?? []) as TurnoRow[]).map(t => [t.id, t]))
    horario = {
      antes: paraHorario(horMov.valor_antes ? turnos.get(horMov.valor_antes) : undefined),
      depois: paraHorario(horMov.valor_depois ? turnos.get(horMov.valor_depois) : undefined),
    }
  }

  // 7. Supervisores
  const supervisorOrigem = snap.supervisor_origem_nome ?? null
  const supervisorDestino = snap.supervisor_destino_nome ?? sol?.sol?.nome ?? null

  // 8. Diffs, título, código
  const tipos = Array.from(new Set([...(sol ? [sol.tipo] : []), ...movs.map(m => m.tipo)]))
  const tiposMov = Array.from(new Set(movs.map(m => m.tipo)))
  const diffs = montarDiffs({
    posto: { antes: postoOrigem?.nome ?? null, depois: postoDestino?.nome ?? null },
    secretaria: { antes: postoOrigem?.secretaria ?? null, depois: postoDestino?.secretaria ?? null },
    supervisor: { antes: supervisorOrigem, depois: supervisorDestino },
    funcao: { antes: funcaoAntes, depois: funcaoDepois },
    horario,
  })
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
    aprovadoPor: sol ? sol.apr?.nome ?? null : movs[0].perfis?.nome ?? null,
    aprovadoEm: sol ? sol.aprovado_em : movs[0].created_at,
    motivo: sol?.motivo ?? null,
    supervisorOrigem,
    supervisorDestino,
    emitidoEm: new Date().toISOString(),
  }
}
