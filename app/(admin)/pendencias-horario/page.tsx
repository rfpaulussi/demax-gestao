import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth/get-user'
import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { FUNCAO_JOVEM_APRENDIZ } from '@/lib/turnos/escala'
import { PendenciasHorarioClient, type PendenteRow, type TurnoOpcao } from '@/components/pendencias-horario/pendencias-horario-client'

type FuncionarioRaw = {
  id: string
  nome: string
  posto_id: string | null
  data_admissao: string | null
  funcoes: { nome: string } | null
  postos: { nome: string } | null
}

export default async function PendenciasHorarioPage() {
  const auth = await getUser()
  if (!auth) redirect('/login')
  if (!['admin', 'coordenador', 'supervisor'].includes(auth.perfil.role ?? '')) redirect('/dashboard')

  const supabase = createClient()

  // Supervisor vê só os pendentes dos postos que gerencia
  let postoIds: string[] | null = null
  if (auth.perfil.role === 'supervisor') {
    const { data: postos } = await supabase
      .from('config_supervisores_postos')
      .select('posto_id')
      .eq('supervisor_id', auth.user.id)
    postoIds = (postos ?? []).map(p => p.posto_id)
  }

  // Leituras paginadas e filtradas em memória: listas de ids no .in() estouram o limite de
  // URL do PostgREST (~800 funcionários no admin) e a falha silenciosa fazia todo mundo
  // aparecer como pendente.
  const funcionarios = await fetchAllRows<FuncionarioRaw>((from, to) => {
    let q = supabase
      .from('funcionarios')
      .select('id, nome, posto_id, data_admissao, funcoes!funcao_id(nome), postos!posto_id(nome)')
      .eq('status', 'ativo')
      .order('nome')
      .order('id')
      .range(from, to)
    if (postoIds) q = q.in('posto_id', postoIds.length > 0 ? postoIds : ['__none__'])
    return q as unknown as PromiseLike<{ data: FuncionarioRaw[] | null; error: { message: string } | null }>
  })

  const vigentes = await fetchAllRows<{ funcionario_id: string }>((from, to) =>
    supabase
      .from('horarios_funcionarios')
      .select('funcionario_id')
      .is('data_fim', null)
      .order('id')
      .range(from, to),
  )

  const comHorario = new Set(vigentes.map(v => v.funcionario_id))
  const pendentes = funcionarios.filter(f => !comHorario.has(f.id) && f.posto_id)

  const turnos = await fetchAllRows<TurnoOpcao & { posto_id: string | null }>((from, to) =>
    supabase
      .from('turnos_postos')
      .select('id, posto_id, nome, hora_entrada, hora_saida_seg_qui, hora_saida_sex, hora_inicio_almoco, hora_fim_almoco, tipo_escala')
      .eq('ativo', true)
      .order('hora_entrada')
      .order('id')
      .range(from, to) as unknown as PromiseLike<{ data: (TurnoOpcao & { posto_id: string | null })[] | null; error: { message: string } | null }>,
  )

  const turnosPorPosto = new Map<string, TurnoOpcao[]>()
  // Turnos de jovem aprendiz são globais (sem posto): valem para qualquer posto.
  const turnosGlobaisJovem: TurnoOpcao[] = []
  for (const t of turnos) {
    if (t.posto_id) {
      if (!turnosPorPosto.has(t.posto_id)) turnosPorPosto.set(t.posto_id, [])
      turnosPorPosto.get(t.posto_id)!.push(t)
    } else if (t.tipo_escala === 'jovem_aprendiz') {
      turnosGlobaisJovem.push(t)
    }
  }

  function turnosDisponiveis(funcao: string | undefined, postoId: string): TurnoOpcao[] {
    const doPosto = turnosPorPosto.get(postoId) ?? []
    if (funcao === FUNCAO_JOVEM_APRENDIZ) {
      return [...turnosGlobaisJovem, ...doPosto.filter(t => t.tipo_escala === 'jovem_aprendiz')]
    }
    return doPosto.filter(t => t.tipo_escala !== 'jovem_aprendiz')
  }

  type SupervisorRaw = { posto_id: string; perfis: { nome: string } | null }
  const supervisoresRaw = await fetchAllRows<SupervisorRaw>((from, to) =>
    supabase
      .from('config_supervisores_postos')
      .select('posto_id, ativo, perfis!supervisor_id(nome)')
      .eq('ativo', true)
      .order('posto_id')
      .range(from, to) as unknown as PromiseLike<{ data: SupervisorRaw[] | null; error: { message: string } | null }>,
  )

  const supervisorPorPosto = new Map<string, string>()
  for (const s of supervisoresRaw) {
    if (s.perfis?.nome) supervisorPorPosto.set(s.posto_id, s.perfis.nome)
  }

  const rows: PendenteRow[] = pendentes.map(f => ({
    id: f.id,
    nome: f.nome,
    funcao: f.funcoes?.nome ?? '—',
    postoId: f.posto_id as string,
    postoNome: f.postos?.nome ?? '—',
    supervisorNome: supervisorPorPosto.get(f.posto_id as string) ?? '—',
    dataAdmissao: f.data_admissao,
    turnos: turnosDisponiveis(f.funcoes?.nome, f.posto_id as string),
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Horários Pendentes</h1>
        <p className="text-sm text-gray-400">
          Funcionários sem horário registrado. Escolha o turno de cada um a partir dos que já estão cadastrados no posto.
        </p>
      </div>

      <PendenciasHorarioClient rows={rows} />
    </div>
  )
}
