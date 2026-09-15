import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth/get-user'
import { createClient } from '@/lib/supabase/server'
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

  let qFuncionarios = supabase
    .from('funcionarios')
    .select('id, nome, posto_id, data_admissao, funcoes!funcao_id(nome), postos!posto_id(nome)')
    .eq('status', 'ativo')
    .order('nome')
  if (postoIds) qFuncionarios = qFuncionarios.in('posto_id', postoIds.length > 0 ? postoIds : ['__none__'])

  const { data: funcionariosRaw } = await qFuncionarios
  const funcionarios = (funcionariosRaw ?? []) as unknown as FuncionarioRaw[]

  const { data: vigentesRaw } = funcionarios.length
    ? await supabase
        .from('horarios_funcionarios')
        .select('funcionario_id')
        .in('funcionario_id', funcionarios.map(f => f.id))
        .is('data_fim', null)
    : { data: [] }

  const comHorario = new Set((vigentesRaw ?? []).map(v => v.funcionario_id as string))
  const pendentes = funcionarios.filter(f => !comHorario.has(f.id) && f.posto_id)

  const postoIdsPendentes = Array.from(new Set(pendentes.map(f => f.posto_id as string)))

  const { data: turnosRaw } = postoIdsPendentes.length
    ? await supabase
        .from('turnos_postos')
        .select('id, posto_id, nome, hora_entrada, hora_saida_seg_qui, hora_saida_sex, hora_inicio_almoco, hora_fim_almoco, tipo_escala')
        .in('posto_id', postoIdsPendentes)
        .eq('ativo', true)
        .order('hora_entrada')
    : { data: [] }

  const turnosPorPosto = new Map<string, TurnoOpcao[]>()
  for (const t of (turnosRaw ?? []) as unknown as (TurnoOpcao & { posto_id: string })[]) {
    if (!turnosPorPosto.has(t.posto_id)) turnosPorPosto.set(t.posto_id, [])
    turnosPorPosto.get(t.posto_id)!.push(t)
  }

  const rows: PendenteRow[] = pendentes.map(f => ({
    id: f.id,
    nome: f.nome,
    funcao: f.funcoes?.nome ?? '—',
    postoId: f.posto_id as string,
    postoNome: f.postos?.nome ?? '—',
    dataAdmissao: f.data_admissao,
    turnos: turnosPorPosto.get(f.posto_id as string) ?? [],
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
