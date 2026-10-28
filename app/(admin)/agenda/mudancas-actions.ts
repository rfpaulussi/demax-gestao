'use server'

import { revalidatePath } from 'next/cache'
import { getUser } from '@/lib/auth/get-user'
import { createAdminClient } from '@/lib/supabase/admin'
import { ehData, hojeBR, segundaDe } from '@/lib/agenda/datas'
import { lerMudancas } from '@/lib/agenda/mudancas-db'
import { restantes } from '@/lib/agenda/mudancas'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (table: string) => any }
const db = () => createAdminClient() as unknown as AnyClient

type Resultado = { ok: true } | { ok: false; erro: string }

const MSG_MIGRACAO = 'Recurso indisponível: aplique a migração 20261030_agenda_limite_mudancas.sql no Supabase Studio.'

export type PedidoMudanca = {
  id: string
  supervisorId: string
  supervisorNome: string
  semanaInicio: string
  motivo: string
  usadas: number
  criadoEm: string
}

/** Supervisor pede uma mudança além do limite da semana. Um pedido pendente por semana. */
export async function pedirMudancaExtra(input: { semanaInicio: string; motivo: string }): Promise<Resultado> {
  const auth = await getUser()
  if (!auth || auth.perfil.role !== 'supervisor' || auth.perfil.ativo === false) return { ok: false, erro: 'Somente o supervisor pede mudança da própria agenda' }
  if (!ehData(input.semanaInicio) || segundaDe(input.semanaInicio) !== input.semanaInicio) return { ok: false, erro: 'Semana inválida' }
  const motivo = input.motivo.trim().slice(0, 400)
  if (motivo.length < 10) return { ok: false, erro: 'Explique o que precisa mudar e por quê (ao menos 10 caracteres)' }

  const admin = db()
  const { data: semana } = await admin
    .from('agenda_semanas')
    .select('id, status')
    .eq('supervisor_id', auth.perfil.id)
    .eq('semana_inicio', input.semanaInicio)
    .maybeSingle()
  if (!semana || semana.status !== 'publicada') return { ok: false, erro: 'A agenda desta semana não está publicada' }

  const resumo = await lerMudancas(admin, semana.id)
  if (!resumo) return { ok: false, erro: MSG_MIGRACAO }
  if (restantes(resumo) > 0) return { ok: false, erro: 'Você ainda tem mudanças disponíveis nesta semana' }
  if (resumo.pedidoPendente) return { ok: false, erro: 'Já existe um pedido aguardando a coordenação nesta semana' }

  const { error } = await admin.from('agenda_mudanca_pedidos').insert({ semana_id: semana.id, supervisor_id: auth.perfil.id, motivo })
  if (error) return { ok: false, erro: MSG_MIGRACAO }
  await admin.from('agenda_comentarios').insert({
    semana_id: semana.id, autor_id: auth.perfil.id, texto: `🙋 Pediu mudança além do limite: ${motivo}`,
  })
  revalidatePath('/agenda')
  return { ok: true }
}

/** Horas de validade da liberação de um dia passado. */
const HORAS_LIBERACAO = 48

/** Admin libera um dia que já passou, numa agenda publicada, para o supervisor corrigir por 48 h. */
export async function liberarDia(input: { semanaInicio: string; supervisorId: string; data: string }): Promise<Resultado> {
  const auth = await getUser()
  if (!auth || auth.perfil.role !== 'admin' || auth.perfil.ativo === false) return { ok: false, erro: 'Só o admin libera dias passados' }
  if (!ehData(input.semanaInicio) || segundaDe(input.semanaInicio) !== input.semanaInicio) return { ok: false, erro: 'Semana inválida' }
  if (!ehData(input.data) || segundaDe(input.data) !== input.semanaInicio) return { ok: false, erro: 'Data fora da semana' }
  if (input.data >= hojeBR()) return { ok: false, erro: 'Só dias que já passaram precisam de liberação' }

  const admin = db()
  const { data: semana } = await admin
    .from('agenda_semanas')
    .select('id, status')
    .eq('supervisor_id', input.supervisorId)
    .eq('semana_inicio', input.semanaInicio)
    .maybeSingle()
  if (!semana || semana.status !== 'publicada') return { ok: false, erro: 'A agenda desta semana não está publicada' }

  const expira = new Date(Date.now() + HORAS_LIBERACAO * 3_600_000).toISOString()
  const { error } = await admin
    .from('agenda_liberacoes_dia')
    .insert({ semana_id: semana.id, data: input.data, liberado_por: auth.perfil.id, expira_em: expira })
  if (error) return { ok: false, erro: 'Recurso indisponível: aplique a migração 20261101_agenda_liberacao_dia.sql no Supabase Studio.' }

  await admin.from('agenda_comentarios').insert({
    semana_id: semana.id,
    autor_id: auth.perfil.id,
    texto: `🔓 Liberou ${input.data.split('-').reverse().slice(0, 2).join('/')} para o supervisor corrigir (vale por ${HORAS_LIBERACAO} h).`,
  })
  revalidatePath('/agenda')
  return { ok: true }
}

/** Pedidos pendentes de todos os supervisores (gestão). Vazio se a migração ainda não foi aplicada. */
export async function listarPedidosMudanca(): Promise<PedidoMudanca[]> {
  const auth = await getUser()
  if (!auth || (auth.perfil.role !== 'admin' && auth.perfil.role !== 'coordenador')) return []
  const { data, error } = await db()
    .from('agenda_mudanca_pedidos')
    .select('id, supervisor_id, motivo, created_at, perfis!supervisor_id(nome), agenda_semanas!semana_id(semana_inicio, mudancas_pos_publicacao)')
    .eq('status', 'pendente')
    .order('created_at', { ascending: true })
  if (error) return []
  type Raw = {
    id: string; supervisor_id: string; motivo: string; created_at: string
    perfis: { nome: string | null } | null
    agenda_semanas: { semana_inicio: string; mudancas_pos_publicacao: number } | null
  }
  return ((data ?? []) as Raw[]).map(r => ({
    id: r.id,
    supervisorId: r.supervisor_id,
    supervisorNome: r.perfis?.nome ?? 'Supervisor',
    semanaInicio: r.agenda_semanas?.semana_inicio ?? '',
    motivo: r.motivo,
    usadas: r.agenda_semanas?.mudancas_pos_publicacao ?? 0,
    criadoEm: r.created_at,
  }))
}

/** Admin ou coordenador aprova (libera +1 mudança na semana) ou recusa o pedido. */
export async function decidirPedidoMudanca(input: { pedidoId: string; aprovar: boolean; resposta?: string }): Promise<Resultado> {
  const auth = await getUser()
  if (!auth || (auth.perfil.role !== 'admin' && auth.perfil.role !== 'coordenador') || auth.perfil.ativo === false) {
    return { ok: false, erro: 'Sem permissão' }
  }
  const admin = db()
  const { data: pedido } = await admin
    .from('agenda_mudanca_pedidos')
    .select('id, semana_id, status')
    .eq('id', input.pedidoId)
    .maybeSingle()
  if (!pedido) return { ok: false, erro: 'Pedido não encontrado' }
  if (pedido.status !== 'pendente') return { ok: false, erro: 'Este pedido já foi decidido' }

  const resposta = (input.resposta ?? '').trim().slice(0, 300) || null
  // Só decide se ainda estiver pendente (duas pessoas decidindo ao mesmo tempo não aprovam duas vezes).
  const { data: decidido, error } = await admin
    .from('agenda_mudanca_pedidos')
    .update({
      status: input.aprovar ? 'aprovado' : 'recusado',
      resposta,
      decidido_por: auth.perfil.id,
      decidido_em: new Date().toISOString(),
    })
    .eq('id', pedido.id)
    .eq('status', 'pendente')
    .select('id')
  if (error) return { ok: false, erro: error.message }
  if (!decidido || decidido.length === 0) return { ok: false, erro: 'Este pedido já foi decidido' }

  if (input.aprovar) {
    const { data: sem } = await admin.from('agenda_semanas').select('mudancas_extras').eq('id', pedido.semana_id).maybeSingle()
    await admin.from('agenda_semanas').update({ mudancas_extras: (sem?.mudancas_extras ?? 0) + 1 }).eq('id', pedido.semana_id)
  }
  await admin.from('agenda_comentarios').insert({
    semana_id: pedido.semana_id,
    autor_id: auth.perfil.id,
    texto: `${input.aprovar ? '✅ Aprovou' : '⛔ Recusou'} o pedido de mudança${input.aprovar ? ' (+1 mudança nesta semana)' : ''}.${resposta ? ` ${resposta}` : ''}`,
  })
  revalidatePath('/agenda')
  return { ok: true }
}
