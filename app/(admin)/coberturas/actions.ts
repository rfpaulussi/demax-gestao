'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/get-user'

export type RegisterResult =
  | { success: false; error: string }
  | { success: true; faltaMsg?: string; atestadoMsg?: string; ultrapassaMes?: boolean }

type ActionResult = { success: true } | { success: false; error: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (table: string) => any }

async function assertAuth(): Promise<{ success: true; userId: string } | { success: false; error: string }> {
  const auth = await getUser()
  if (!auth) return { success: false, error: 'Não autenticado' }
  return { success: true, userId: auth.user.id }
}

function calcUrgencia(dataPrevRetorno: string | null): 'baixa' | 'media' | 'alta' {
  if (!dataPrevRetorno) return 'baixa'
  const hoje = new Date()
  const hojeDate = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  const [y, m, d] = dataPrevRetorno.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const diff = Math.ceil((dt.getTime() - hojeDate.getTime()) / 86_400_000)
  if (diff <= 1) return 'alta'
  if (diff <= 3) return 'media'
  return 'baixa'
}

function fmtDateBR(iso: string | null | undefined): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export async function registrarCobertura(formData: FormData): Promise<RegisterResult> {
  const guard = await assertAuth()
  if (!guard.success) return guard

  const supabase = createClient()

  const substitutoId        = formData.get('substituto_id') as string
  const postoDestinoId      = formData.get('posto_destino_id') as string
  const tipoMotivo          = (formData.get('tipo_motivo') as string) || null
  const motivo              = (formData.get('motivo') as string) || null
  const dataInicio          = formData.get('data_inicio') as string
  const dataPrevRetorno     = (formData.get('data_fim') as string) || null
  const ausenteId           = (formData.get('funcionario_ausente_id') as string) || null
  const supervisorDestinoId = (formData.get('supervisor_id') as string) || null
  const tipoCobertura       = (formData.get('tipo_cobertura') as string) || null
  const ausenteNome         = (formData.get('funcionario_ausente_nome') as string) || 'funcionário'
  const lancarFalta         = formData.get('lancar_falta') !== 'false'
  const registrarAtestado   = formData.get('registrar_atestado') !== 'false'
  const atestadoMotivo      = (formData.get('atestado_motivo') as string) || null
  const atestadoDataInicio  = (formData.get('atestado_data_inicio') as string) || dataInicio
  const atestadoDataFim     = (formData.get('atestado_data_fim') as string) || (dataPrevRetorno ?? dataInicio)
  const atestadoCidCodigo   = (formData.get('atestado_cid_codigo') as string) || null

  if (!substitutoId || !postoDestinoId || !dataInicio) {
    return { success: false, error: 'Campos obrigatórios faltando' }
  }

  const { data: substituto } = await supabase
    .from('funcionarios')
    .select('posto_id')
    .eq('id', substitutoId)
    .single()

  const postoOrigemId = substituto?.posto_id ?? null
  const urgencia      = calcUrgencia(dataPrevRetorno)

  const { data: cobData, error } = await (supabase as unknown as AnyClient)
    .from('coberturas_temporarias')
    .insert({
      funcionario_id:         substitutoId,
      posto_destino_id:       postoDestinoId,
      posto_origem_id:        postoOrigemId,
      tipo_motivo:            tipoMotivo,
      motivo,
      data_inicio:            dataInicio,
      data_prev_retorno:      dataPrevRetorno,
      urgencia,
      status:                 'ativa',
      supervisor_origem_id:   guard.userId,
      supervisor_destino_id:  supervisorDestinoId,
      funcionario_ausente_id: ausenteId,
      tipo_cobertura:         tipoCobertura,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }
  const coberturaId = (cobData as { id: string } | null)?.id ?? null

  const { error: errSubstituto } = await supabase
    .from('funcionarios')
    .update({ posto_id: postoDestinoId })
    .eq('id', substitutoId)
  if (errSubstituto) console.error('[coberturas] registrarCobertura: atualizar posto do substituto:', errSubstituto.message)

  const isFalta    = tipoMotivo === 'falta_justificada' || tipoMotivo === 'falta_injustificada'
  const isAtestado = tipoMotivo === 'atestado_medico'

  // Cross-month check
  const eom = (() => {
    const [y, m] = dataInicio.split('-').map(Number)
    return new Date(y, m, 0).toISOString().split('T')[0]
  })()
  const ultrapassaMes = Boolean(dataPrevRetorno && dataPrevRetorno > eom)

  let faltaMsg: string | undefined
  let atestadoMsg: string | undefined

  if (ausenteId) {
    const dias = dataPrevRetorno
      ? Math.round((new Date(dataPrevRetorno + 'T12:00:00').getTime() - new Date(dataInicio + 'T12:00:00').getTime()) / 86400000) + 1
      : 1

    if (isAtestado && registrarAtestado) {
      // Check existing afastamento overlapping this period
      const { data: existingAfast } = await supabase
        .from('afastamentos')
        .select('id')
        .eq('funcionario_id', ausenteId)
        .lte('data_inicio', dataPrevRetorno ?? dataInicio)
        .or(`data_fim_prevista.is.null,data_fim_prevista.gte.${dataInicio}`)
        .maybeSingle()

      if (existingAfast) {
        atestadoMsg = `Atestado de ${ausenteNome} já estava registrado.`
      } else {
        const { error: errAfast } = await supabase.from('afastamentos').insert({
          funcionario_id:    ausenteId,
          data_inicio:       atestadoDataInicio,
          data_fim_prevista: atestadoDataFim,
          motivo:            atestadoMotivo,
        } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        if (errAfast) {
          console.error('[coberturas] registrarCobertura: inserir afastamento:', errAfast.message)
        } else {
          // Inserir também em atestados (posto_id e registrado_por são obrigatórios)
          const { error: errAtest } = await supabase.from('atestados').insert({
            funcionario_id: ausenteId,
            posto_id:       postoDestinoId,
            data_inicio:    atestadoDataInicio,
            data_fim:       atestadoDataFim,
            motivo:         atestadoMotivo || motivo || null,
            cid_codigo:     atestadoCidCodigo,
            registrado_por: guard.userId,
          } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
          const { error: errAfastar } = await supabase.from('funcionarios').update({ status: 'afastado' }).eq('id', ausenteId)
          if (errAtest) {
            console.error('[coberturas] registrarCobertura: inserir atestado:', errAtest.message)
            atestadoMsg = `⚠ Afastamento de ${ausenteNome} registrado mas atestado não foi salvo — registre manualmente em Atestados.`
          } else if (errAfastar) {
            console.error('[coberturas] registrarCobertura: marcar ausente como afastado:', errAfastar.message)
            atestadoMsg = `⚠ Atestado de ${ausenteNome} registrado mas status não foi atualizado — revise em Efetivo. (${errAfastar.message})`
          } else {
            atestadoMsg = `Atestado de ${ausenteNome} registrado.`
          }
        }
      }
    } else if (isFalta) {
      if (dias >= 4) {
        const { error: errAusente } = await supabase
          .from('funcionarios')
          .update({ status: 'afastado' })
          .eq('id', ausenteId)
        if (errAusente) console.error('[coberturas] registrarCobertura: marcar ausente como afastado:', errAusente.message)
      }

      if (lancarFalta && coberturaId) {
        const { data: existingFalta } = await (supabase as unknown as AnyClient)
          .from('faltas')
          .select('id')
          .eq('cobertura_id', coberturaId)
          .maybeSingle()

        if (existingFalta) {
          faltaMsg = `Falta de ${ausenteNome} já estava registrada.`
        } else {
          const { error: errFalta } = await (supabase as unknown as AnyClient)
            .from('faltas')
            .insert({
              funcionario_id: ausenteId,
              data_falta:     dataInicio,
              data_fim:       dataPrevRetorno,
              tipo:           tipoMotivo === 'falta_injustificada' ? 'sem_justificativa' : 'justificada',
              dias,
              observacao:     motivo,
              origem:         'cobertura',
              cobertura_id:   coberturaId,
              registrado_por: guard.userId,
            })
          if (errFalta) {
            console.error('[coberturas] registrarCobertura: inserir falta:', errFalta.message)
            faltaMsg = `⚠ Falta de ${ausenteNome} não registrada: ${errFalta.message}`
          } else {
            const periodoLabel = dataPrevRetorno && dataPrevRetorno !== dataInicio
              ? ` para ${fmtDateBR(dataInicio)} a ${fmtDateBR(dataPrevRetorno)}`
              : ` para ${fmtDateBR(dataInicio)}`
            faltaMsg = `Falta de ${ausenteNome} registrada${periodoLabel}.`
          }
        }
      }
    }
    // folga / outros: cobertura registrada normalmente, ausente permanece 'ativo'
  }

  revalidatePath('/coberturas')
  revalidatePath('/efetivo')
  revalidatePath('/dashboard')
  return { success: true, faltaMsg, atestadoMsg, ultrapassaMes }
}

export async function encerrarCobertura(id: string): Promise<ActionResult> {
  const guard = await assertAuth()
  if (!guard.success) return guard

  const supabase = createClient()
  const hoje = new Date().toISOString().split('T')[0]

  const { data: cob, error: fetchError } = await (supabase as unknown as AnyClient)
    .from('coberturas_temporarias')
    .select('funcionario_id, posto_origem_id, funcionario_ausente_id')
    .eq('id', id)
    .single()

  if (fetchError || !cob) return { success: false, error: 'Cobertura não encontrada' }

  const { error } = await supabase
    .from('coberturas_temporarias')
    .update({ status: 'encerrada', data_retorno_real: hoje })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  if (cob.posto_origem_id && cob.funcionario_id) {
    const { error: errRestore } = await supabase
      .from('funcionarios')
      .update({ posto_id: cob.posto_origem_id })
      .eq('id', cob.funcionario_id)
    if (errRestore) console.error('[coberturas] encerrarCobertura: restaurar posto do substituto:', errRestore.message)
  }

  if (cob.funcionario_ausente_id) {
    const { count } = await (supabase as unknown as AnyClient)
      .from('coberturas_temporarias')
      .select('id', { count: 'exact', head: true })
      .eq('funcionario_ausente_id', cob.funcionario_ausente_id)
      .eq('status', 'ativa')
    if (count === 0) {
      const { error: errRev } = await supabase.from('funcionarios')
        .update({ status: 'ativo' })
        .eq('id', cob.funcionario_ausente_id)
        .eq('status', 'afastado')
      if (errRev) console.error('[coberturas] encerrarCobertura: reverter status do ausente', cob.funcionario_ausente_id, ':', errRev.message)
    }
  }

  revalidatePath('/coberturas')
  revalidatePath('/efetivo')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function encerrarCoberturasVencidas(): Promise<{ encerradas: number }> {
  const supabase = createClient()
  const hoje = new Date().toISOString().split('T')[0]

  const { data: vencidas } = await (supabase as unknown as AnyClient)
    .from('coberturas_temporarias')
    .select('id, funcionario_id, posto_origem_id, posto_destino_id, funcionario_ausente_id')
    .eq('status', 'ativa')
    .lt('data_prev_retorno', hoje)

  if (!vencidas || vencidas.length === 0) return { encerradas: 0 }

  const ausentesParaVerificar = new Set<string>()

  for (const cob of vencidas) {
    const { error: errEnc } = await supabase
      .from('coberturas_temporarias')
      .update({ status: 'encerrada', data_retorno_real: hoje })
      .eq('id', cob.id)
    if (errEnc) {
      console.error('[coberturas] encerrarCoberturasVencidas: encerrar cobertura', cob.id, ':', errEnc.message)
      continue
    }

    if (cob.posto_origem_id && cob.funcionario_id) {
      const { error: errPosto } = await supabase
        .from('funcionarios')
        .update({ posto_id: cob.posto_origem_id })
        .eq('id', cob.funcionario_id)
      if (errPosto) console.error('[coberturas] encerrarCoberturasVencidas: restaurar posto', cob.funcionario_id, ':', errPosto.message)

      const { error: errHist } = await supabase.from('historico_funcionarios').insert({
        funcionario_id:   cob.funcionario_id,
        tipo:             'cobertura_encerrada_automatico',
        dados_anteriores: { posto_id: cob.posto_destino_id },
        dados_novos:      { posto_id: cob.posto_origem_id },
      } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      if (errHist) console.error('[coberturas] encerrarCoberturasVencidas: registrar historico', cob.funcionario_id, ':', errHist.message)
    }

    if (cob.funcionario_ausente_id) ausentesParaVerificar.add(cob.funcionario_ausente_id)
  }

  for (const ausenteId of Array.from(ausentesParaVerificar)) {
    const { count } = await (supabase as unknown as AnyClient)
      .from('coberturas_temporarias')
      .select('id', { count: 'exact', head: true })
      .eq('funcionario_ausente_id', ausenteId)
      .eq('status', 'ativa')
    if (count === 0) {
      const { error: errRev } = await supabase.from('funcionarios')
        .update({ status: 'ativo' })
        .eq('id', ausenteId)
        .eq('status', 'afastado')
      if (errRev) console.error('[coberturas] encerrarCoberturasVencidas: reverter status do ausente', ausenteId, ':', errRev.message)
    }
  }

  revalidatePath('/coberturas')
  revalidatePath('/efetivo')
  revalidatePath('/dashboard')
  return { encerradas: vencidas.length }
}

export async function buscarFuncionariosAtivosNoPostoSemAfastamento(
  postoId: string
): Promise<{ id: string; nome: string; funcao: string | null }[]> {
  const supabase = createClient()
  const hoje = new Date().toISOString().split('T')[0]

  const { data: rawFuncs } = await supabase
    .from('funcionarios')
    .select('id, nome, funcoes:funcao_id(nome)')
    .eq('posto_id', postoId)
    .eq('status', 'ativo')
    .order('nome')

  type FuncRow = { id: string; nome: string; funcoes: { nome: string } | null }
  const funcionarios = (rawFuncs ?? []) as unknown as FuncRow[]

  if (!funcionarios.length) return []

  const ids = funcionarios.map(f => f.id)

  const [{ data: comAfastamento }, { data: comFalta }] = await Promise.all([
    supabase
      .from('afastamentos')
      .select('funcionario_id')
      .in('funcionario_id', ids)
      .lte('data_inicio', hoje)
      .or(`data_fim_prevista.is.null,data_fim_prevista.gte.${hoje}`),
    supabase
      .from('faltas')
      .select('funcionario_id')
      .in('funcionario_id', ids)
      .eq('data_falta', hoje),
  ])

  const excluir = new Set([
    ...(comAfastamento ?? []).map((r: { funcionario_id: string }) => r.funcionario_id),
    ...(comFalta ?? []).map((r: { funcionario_id: string }) => r.funcionario_id),
  ])

  return funcionarios
    .filter(f => !excluir.has(f.id))
    .map(f => ({ id: f.id, nome: f.nome, funcao: f.funcoes?.nome ?? null }))
}

export async function buscarTodosSupervisores(): Promise<{ id: string; nome: string }[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('perfis')
    .select('id, nome')
    .eq('role', 'supervisor')
    .eq('ativo', true)
    .order('nome')
  return (data ?? []).map(s => ({ id: s.id, nome: s.nome ?? '' }))
}
