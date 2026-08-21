import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUser } from '@/lib/auth/get-user'
import { EfetivoClient } from '@/components/efetivo/efetivo-client'
import type { FuncionarioRow } from '@/components/efetivo/funcionarios-table'
import { processarRetornosAtestado } from '@/lib/processar-retornos'
import { encerrarCoberturasVencidas } from '@/app/(admin)/coberturas/actions'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { resolverTipoEscala, formatarResumoTurno } from '@/lib/turnos/escala'
import { FUNCOES_FORA_DO_EFETIVO } from '@/lib/constants'

// ─── counter card ─────────────────────────────────────────────────────────────

function CounterCard({
  label,
  value,
  topColor,
}: {
  label: string
  value: number
  topColor: string
}) {
  return (
    <div className={`rounded-xl border border-gray-100 border-t-4 bg-white p-3 shadow-sm ${topColor}`}>
      <p className="text-2xl font-black tracking-tight text-gray-900">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">
        {label}
      </p>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQ = { from: (t: string) => any }

// ─── types ────────────────────────────────────────────────────────────────────

type ConfigRow = {
  supervisor_id: string
  posto_id: string
  perfis: { id: string; nome: string | null } | null
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function EfetivoPage() {
  const supabase = createClient()
  const supabaseAdmin = createAdminClient()
  const auth = await getUser()
  const isAdmin = auth?.perfil.role === 'admin'
  const podeIgnorarAfastado = auth?.perfil.role === 'admin' || auth?.perfil.role === 'coordenador'

  // Processa retornos silenciosamente a cada carregamento do Efetivo
  await processarRetornosAtestado()
  await encerrarCoberturasVencidas()

  const [
    { data: raw },
    { data: supervisoresRaw },
    { data: configRaw },
    { data: postosRaw },
    { data: funcoesRaw },
    { data: cidsRaw },
    { count: countTotal },
    { count: countAfastados },
    { count: countFerias },
    { count: countRescisaoIndireta },
  ] = await Promise.all([
    supabase
      .from('funcionarios')
      .select(`
        id, nome, registro, cpf, status, motivo_afastamento, data_admissao, posto_id,
        data_desligamento, motivo_desligamento,
        periodo_experiencia, fase_experiencia, data_fim_fase1, data_fim_fase2,
        pcd, pcd_tipo, pcd_tipo_outro,
        funcoes!funcao_id ( id, nome ),
        postos!posto_id ( id, nome, secretaria )
      `)
      .order('nome')
      .range(0, 1499),
    supabase
      .from('perfis')
      .select('id, nome')
      .eq('role', 'supervisor')
      .eq('ativo', true)
      .order('nome'),
    supabase
      .from('config_supervisores_postos')
      .select('supervisor_id, posto_id, perfis!supervisor_id(id, nome)')
      .eq('ativo', true),
    supabaseAdmin.from('postos').select('id, nome, secretaria').order('nome'),
    supabase.from('funcoes').select('id, nome').order('nome'),
    supabase.from('cid_referencia').select('codigo, descricao').order('codigo'),
    // KPIs via COUNT — bypassa o max_rows do PostgREST (head:true não retorna linhas)
    // Total = efetivo do contrato (exclui desligados, que ficam só no histórico)
    supabase.from('funcionarios').select('*', { count: 'exact', head: true }).neq('status', 'desligado'),
    supabase.from('funcionarios').select('*', { count: 'exact', head: true }).in('status', ['afastado', 'atestado']),
    supabase.from('funcionarios').select('*', { count: 'exact', head: true }).eq('status', 'ferias'),
    supabase.from('funcionarios').select('*', { count: 'exact', head: true }).eq('status', 'rescisao_indireta'),
  ])

  // Ativos: mesmo critério usado em Postos e no dashboard do supervisor —
  // só status='ativo', excluindo volantes e funções fora do efetivo contratual
  // (edital), senão o card diverge da soma "Atual" dos postos.
  const excludedFuncaoIds = new Set(
    (funcoesRaw ?? [])
      .filter(f => (FUNCOES_FORA_DO_EFETIVO as readonly string[]).includes(f.nome))
      .map(f => f.id)
  )
  let ativosQuery = supabase
    .from('funcionarios')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'ativo')
    .not('eh_encarregado_volante', 'is', true)
  if (excludedFuncaoIds.size > 0) {
    ativosQuery = ativosQuery.not('funcao_id', 'in', `(${Array.from(excludedFuncaoIds).join(',')})`)
  }
  const { count: countAtivos } = await ativosQuery

  // posto_id → { supervisor_id, nomeCompleto }
  const postoSupervisorMap = new Map<string, { id: string; nomeCompleto: string }>()
  for (const row of (configRaw ?? []) as unknown as ConfigRow[]) {
    const nome = row.perfis?.nome
    if (nome && !postoSupervisorMap.has(row.posto_id)) {
      postoSupervisorMap.set(row.posto_id, { id: row.supervisor_id, nomeCompleto: nome })
    }
  }

  // Para cada afastado, buscar o atestado mais recente (sem filtro data_fim)
  // e usar a origem_ocupacional dele — o status 'afastado' já garante que
  // esse é o motivo atual; o que importa é a origem, não se a data_fim passou.
  const rawFuncs = (raw ?? []) as unknown as FuncionarioRow[]
  const afastadoIds = rawFuncs.filter(f => f.status === 'afastado' || f.status === 'atestado').map(f => f.id)
  const catOrigemMap = new Map<string, string | null>()
  if (afastadoIds.length > 0) {
    const { data: catData } = await supabase
      .from('atestados')
      .select('funcionario_id, origem_ocupacional')
      .in('funcionario_id', afastadoIds)
      .order('data_inicio', { ascending: false })
    for (const c of (catData ?? []) as unknown as { funcionario_id: string; origem_ocupacional: string | null }[]) {
      if (!catOrigemMap.has(c.funcionario_id)) {
        catOrigemMap.set(c.funcionario_id, c.origem_ocupacional)
      }
    }
  }

  // Data prevista de retorno do afastamento aberto (data_fim_real IS NULL) de cada
  // funcionário afastado — o mais recente, quando há mais de um aberto.
  const afastamentoPrevistoMap = new Map<string, string | null>()
  const soAfastadoIds = rawFuncs.filter(f => f.status === 'afastado').map(f => f.id)
  if (soAfastadoIds.length > 0) {
    const { data: afastData } = await supabase
      .from('afastamentos')
      .select('funcionario_id, data_fim_prevista')
      .in('funcionario_id', soAfastadoIds)
      .is('data_fim_real', null)
      .order('created_at', { ascending: false })
    for (const a of (afastData ?? []) as unknown as { funcionario_id: string; data_fim_prevista: string | null }[]) {
      if (!afastamentoPrevistoMap.has(a.funcionario_id)) {
        afastamentoPrevistoMap.set(a.funcionario_id, a.data_fim_prevista)
      }
    }
  }

  // Faltas ativas hoje (para badge na tabela)
  const hoje = new Date().toISOString().split('T')[0]
  const { data: faltasRaw } = await (supabase as unknown as AnyQ)
    .from('faltas')
    .select('funcionario_id, data_falta, data_fim')
    .lte('data_falta', hoje)
    .or(`data_fim.is.null,data_fim.gte.${hoje}`)
  type FaltaHoje = { funcionario_id: string; data_falta: string; data_fim: string | null }
  const faltasAtivas: Record<string, boolean> = {}
  for (const f of (faltasRaw ?? []) as FaltaHoje[]) {
    if (f.data_fim === null && f.data_falta !== hoje) continue
    faltasAtivas[f.funcionario_id] = true
  }

  // Horário vigente de todos os funcionários (para o Excel) — sem filtro de IDs
  // para evitar URL enorme com até ~1500 UUIDs; pagina além do limite de 1000
  // linhas do PostgREST via fetchAllRows.
  type HorarioVigenteRow = {
    funcionario_id: string
    turnos_postos: {
      nome: string
      tipo_escala: string
      hora_entrada: string
      hora_saida_seg_qui: string
      hora_saida_sex: string | null
      hora_inicio_almoco: string | null
      hora_fim_almoco: string | null
    } | null
  }
  const horariosVigentes = await fetchAllRows<HorarioVigenteRow>((from, to) =>
    supabase
      .from('horarios_funcionarios')
      .select('funcionario_id, turnos_postos!turno_id(nome, tipo_escala, hora_entrada, hora_saida_seg_qui, hora_saida_sex, hora_inicio_almoco, hora_fim_almoco)')
      .is('data_fim', null)
      .order('data_inicio', { ascending: false })
      .range(from, to) as unknown as PromiseLike<{ data: HorarioVigenteRow[] | null; error: { message: string } | null }>,
  )
  const horarioMap = new Map<string, { nome: string; regime: string; resumo: string }>()
  for (const h of horariosVigentes) {
    if (!h.turnos_postos) continue
    if (horarioMap.has(h.funcionario_id)) continue
    horarioMap.set(h.funcionario_id, {
      nome:   h.turnos_postos.nome,
      regime: resolverTipoEscala(h.turnos_postos.tipo_escala),
      resumo: formatarResumoTurno(h.turnos_postos),
    })
  }

  // Coberturas ativas hoje (para badges Em Cobertura / Sendo Coberto)
  const { data: coberturasHoje } = await (supabase as unknown as AnyQ)
    .from('coberturas_temporarias')
    .select('funcionario_id, funcionario_ausente_id')
    .eq('status', 'ativa')
    .lte('data_inicio', hoje)
    .or(`data_prev_retorno.is.null,data_prev_retorno.gte.${hoje}`)
  type CoberturaHoje = { funcionario_id: string; funcionario_ausente_id: string | null }
  const coberturaSubstitutos: Record<string, boolean> = {}
  const coberturaAusentes: Record<string, boolean> = {}
  for (const c of (coberturasHoje ?? []) as CoberturaHoje[]) {
    coberturaSubstitutos[c.funcionario_id] = true
    if (c.funcionario_ausente_id) coberturaAusentes[c.funcionario_ausente_id] = true
  }

  // Enrich ALL funcionarios with supervisor_nome + supervisor_id + origem_ocupacional_cat + turno_atual
  const funcionarios = rawFuncs.map(f => {
    const sup = f.posto_id ? postoSupervisorMap.get(f.posto_id) : undefined
    const horario = horarioMap.get(f.id)
    return {
      ...f,
      supervisor_nome:        sup?.nomeCompleto ?? null,
      supervisor_id:          sup?.id ?? null,
      origem_ocupacional_cat: catOrigemMap.get(f.id) ?? null,
      turno_atual_nome:       horario?.nome ?? null,
      turno_atual_regime:     horario?.regime ?? null,
      turno_atual_resumo:     horario?.resumo ?? null,
      data_fim_prevista_afastamento: f.status === 'afastado' ? (afastamentoPrevistoMap.get(f.id) ?? null) : null,
    }
  })

  // KPI counters via COUNT exact — independentes do limite de linhas da query da tabela
  const total       = countTotal    ?? 0
  const ativos      = countAtivos   ?? 0
  const afastados   = countAfastados ?? 0
  const emFerias    = countFerias   ?? 0
  const emProcesso  = countRescisaoIndireta ?? 0

  const supervisores = (supervisoresRaw ?? []) as { id: string; nome: string | null }[]
  const postos       = (postosRaw ?? []) as { id: string; nome: string; secretaria: string | null }[]
  const funcoes      = (funcoesRaw ?? []) as { id: string; nome: string }[]
  const cids         = (cidsRaw ?? []) as { codigo: string; descricao: string }[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Efetivo</h1>
        <p className="text-sm text-gray-400">Gestão do quadro de funcionários</p>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <CounterCard label="Total"        value={total}      topColor="border-t-gray-400"   />
        <CounterCard label="Ativos"       value={ativos}     topColor="border-t-green-500"  />
        <CounterCard label="Afastados"    value={afastados}  topColor="border-t-red-500"    />
        <CounterCard label="Em Férias"    value={emFerias}   topColor="border-t-orange-500" />
        <CounterCard label="Em Processo"  value={emProcesso} topColor="border-t-purple-500" />
      </div>

      {/* Filters + Table (client-side) */}
      <EfetivoClient
        funcionarios={funcionarios}
        supervisores={supervisores}
        postos={postos}
        funcoes={funcoes}
        cids={cids}
        isAdmin={isAdmin}
        podeIgnorarAfastado={podeIgnorarAfastado}
        faltasAtivas={faltasAtivas}
        coberturaSubstitutos={coberturaSubstitutos}
        coberturaAusentes={coberturaAusentes}
      />
    </div>
  )
}
