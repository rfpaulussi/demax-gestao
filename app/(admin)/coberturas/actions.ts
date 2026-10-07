'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUser } from '@/lib/auth/get-user'
import { logSupervisorAcao } from '@/lib/log-supervisor'
import { feriadosDoAno, diasUteisNoPeriodo, toDate } from '@/lib/utils/dias-uteis'
import { removerFaltasCobertas, existeAtestadoNoPeriodo, existeAfastamentoNoPeriodo } from '@/lib/faltas-conflito'
import { existeAfastamentoAberto, fecharAfastamentosVencidos } from '@/lib/afastamentos'
import { buscarAtestadoSobreposto, mensagemSobreposicao } from '@/lib/atestados/sobreposicao'

export type RegisterResult =
  | { success: false; error: string }
  | { success: true; faltaMsg?: string; atestadoMsg?: string; ultrapassaMes?: boolean }

type ActionResult = { success: true } | { success: false; error: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (table: string) => any }

/** Cobertura exige perfil com escrita: admin, coordenador ou supervisor (viewer é só leitura). */
async function assertEscrita(): Promise<
  { success: true; userId: string; role: string } | { success: false; error: string }
> {
  const auth = await getUser()
  if (!auth) return { success: false, error: 'Não autenticado' }
  const role = auth.perfil.role as string
  if (!['admin', 'coordenador', 'supervisor'].includes(role)) {
    return { success: false, error: 'Sem permissão para gerenciar coberturas' }
  }
  return { success: true, userId: auth.user.id, role }
}

/** Data de hoje (YYYY-MM-DD) no fuso de Brasília — toISOString() usa UTC e virava o dia às 21h. */
function hojeBR(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

/** Prazo máximo de uma cobertura aberta por supervisor (dias corridos, início e fim inclusos). */
const MAX_DIAS_COBERTURA_SUPERVISOR = 7

/**
 * Um funcionário "ausente" de uma cobertura pode ter uma ausência própria ainda em
 * curso (atestado, falta multi-dia ou afastamento formal) que não tem relação com a
 * cobertura que está sendo encerrada. Nesse caso não reverte pra 'ativo' — só porque
 * a cobertura acabou não significa que ele voltou a trabalhar. Espelha a mesma
 * checagem de lib/processar-retornos.ts.
 */
async function temAusenciaAindaVigente(admin: AnyClient, funcionarioId: string, hoje: string): Promise<boolean> {
  const [{ data: atestados }, { data: faltas }, { data: afastamentos }] = await Promise.all([
    admin.from('atestados').select('id').eq('funcionario_id', funcionarioId).gte('data_fim', hoje),
    admin.from('faltas').select('id').eq('funcionario_id', funcionarioId).gte('data_fim', hoje),
    admin.from('afastamentos').select('id').eq('funcionario_id', funcionarioId)
      .or(`data_fim_prevista.is.null,data_fim_prevista.gte.${hoje}`),
  ])
  return (atestados?.length ?? 0) > 0 || (faltas?.length ?? 0) > 0 || (afastamentos?.length ?? 0) > 0
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
  const guard = await assertEscrita()
  if (!guard.success) return guard

  const supabase      = createClient()
  const adminSupabase = createAdminClient()

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

  if (dataPrevRetorno && dataPrevRetorno < dataInicio) {
    return { success: false, error: 'A data fim não pode ser anterior à data início' }
  }

  if (guard.role === 'supervisor') {
    if (!dataPrevRetorno) {
      return { success: false, error: 'Informe a data fim: a cobertura precisa ter prazo para o funcionário retornar ao posto de origem' }
    }
    const dias = Math.round(
      (new Date(dataPrevRetorno + 'T12:00:00').getTime() - new Date(dataInicio + 'T12:00:00').getTime()) / 86_400_000,
    ) + 1
    if (dias > MAX_DIAS_COBERTURA_SUPERVISOR) {
      return {
        success: false,
        error: `Cobertura temporária não pode passar de ${MAX_DIAS_COBERTURA_SUPERVISOR} dias (informado: ${dias}). Registre um período menor e, se precisar estender, faça uma nova cobertura.`,
      }
    }
  }

  const { data: substituto } = await supabase
    .from('funcionarios')
    .select('posto_id')
    .eq('id', substitutoId)
    .single()

  // Sem posto de origem o funcionário não teria para onde voltar ao fim da cobertura
  // (e, para supervisor, o RLS só devolve funcionários dos seus próprios postos).
  if (!substituto?.posto_id) {
    return { success: false, error: 'Funcionário não encontrado ou sem posto de origem — não é possível cobrir sem ter para onde retornar' }
  }

  // Já coberto em outro posto: o "posto de origem" seria o de uma cobertura anterior
  // e o retorno automático levaria o funcionário ao lugar errado.
  const { count: coberturasAtivas } = await (adminSupabase as unknown as AnyClient)
    .from('coberturas_temporarias')
    .select('id', { count: 'exact', head: true })
    .eq('funcionario_id', substitutoId)
    .eq('status', 'ativa')
  if ((coberturasAtivas ?? 0) > 0) {
    return { success: false, error: 'Este funcionário já está em uma cobertura ativa. Encerre-a antes de criar outra.' }
  }

  const postoOrigemId = substituto.posto_id
  const urgencia      = calcUrgencia(dataPrevRetorno)

  const { data: cobData, error } = await (adminSupabase as unknown as AnyClient)
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

  // Client admin: RLS de funcionarios não permite update de supervisor
  // (só admin/coordenador têm policy de UPDATE — ver nota em efetivo/actions.ts).
  const { error: errSubstituto } = await adminSupabase
    .from('funcionarios')
    .update({ posto_id: postoDestinoId })
    .eq('id', substitutoId)
  if (errSubstituto) console.error('[coberturas] registrarCobertura: atualizar posto do substituto:', errSubstituto.message)

  const { error: errMovCob } = await adminSupabase.from('movimentacoes').insert({
    funcionario_id: substitutoId,
    tipo: 'cobertura',
    campo_alterado: 'posto_id',
    valor_antes: postoOrigemId,
    valor_depois: postoDestinoId,
    executado_por: guard.userId,
  })
  if (errMovCob) console.error('[coberturas] registrarCobertura: registrar movimentacao:', errMovCob.message)

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
    const { data: escalaDestino } = await supabase
      .from('config_escalas_postos')
      .select('regime')
      .eq('posto_id', postoDestinoId)
      .maybeSingle()
    const regimeDestino = (escalaDestino as { regime: string } | null)?.regime ?? '5x2'
    const feriados = feriadosDoAno(new Date(dataInicio).getFullYear())
    const dias = dataPrevRetorno
      ? diasUteisNoPeriodo(toDate(dataInicio), toDate(dataPrevRetorno), regimeDestino, feriados)
      : 1

    if (isAtestado && registrarAtestado) {
      // Check existing afastamento overlapping this period
      const { data: existingAfast } = await supabase
        .from('afastamentos')
        .select('id')
        .eq('funcionario_id', ausenteId)
        .lte('data_inicio', dataPrevRetorno ?? dataInicio)
        .or(`data_fim_prevista.is.null,data_fim_prevista.gte.${dataInicio}`)
        .limit(1)

      // Atestado duplicado/sobreposto nunca entra: nada é gravado (nem afastamento, nem baixa de faltas).
      const atestadoSobreposto = await buscarAtestadoSobreposto(adminSupabase, ausenteId, atestadoDataInicio, atestadoDataFim)

      // Máximo 1 afastamento aberto por funcionário: se já há um aberto (ou sobreposto), não cria outro.
      if (atestadoSobreposto) {
        atestadoMsg = `⚠ Atestado de ${ausenteNome} não foi salvo: ${mensagemSobreposicao(atestadoSobreposto)}`
      } else if ((existingAfast?.length ?? 0) > 0 || await existeAfastamentoAberto(adminSupabase, ausenteId)) {
        atestadoMsg = `Atestado de ${ausenteNome} já estava registrado.`
      } else {
        const { error: errAfast } = await adminSupabase.from('afastamentos').insert({
          funcionario_id:    ausenteId,
          data_inicio:       atestadoDataInicio,
          data_fim_prevista: atestadoDataFim,
          motivo:            atestadoMotivo,
        } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        if (errAfast) {
          console.error('[coberturas] registrarCobertura: inserir afastamento:', errAfast.message)
        } else {
          // Falta e atestado nunca coexistem pro mesmo dia (é um ou é outro) — remove
          // qualquer falta do ausente totalmente coberta pelo período do atestado. Sem
          // UI de escolha aqui (diferente do modal de Atestados), então remove direto as
          // totalmente cobertas; parciais ficam como estão pra revisão manual.
          await removerFaltasCobertas(
            adminSupabase,
            ausenteId,
            atestadoDataInicio,
            atestadoDataFim,
            `atestado ${atestadoDataInicio} → ${atestadoDataFim}`,
            guard.userId,
          )

          // Inserir também em atestados (posto_id e registrado_por são obrigatórios)
          const { error: errAtest } = await adminSupabase.from('atestados').insert({
            funcionario_id: ausenteId,
            posto_id:       postoDestinoId,
            data_inicio:    atestadoDataInicio,
            data_fim:       atestadoDataFim,
            motivo:         atestadoMotivo || motivo || null,
            cid_codigo:     atestadoCidCodigo,
            registrado_por: guard.userId,
          } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
          if (errAtest) {
            // Não marca como afastado se o atestado não foi gravado — evita status
            // 'afastado' sem lançamento correspondente em atestados (ex.: FK de
            // cid_codigo rejeitando um CID ainda não cadastrado em cid_referencia).
            console.error('[coberturas] registrarCobertura: inserir atestado:', errAtest.message)
            atestadoMsg = `⚠ Atestado de ${ausenteNome} não foi salvo (${errAtest.message}) — registre manualmente em Atestados.`
          } else {
            const { error: errAfastar } = await adminSupabase.from('funcionarios').update({ status: 'afastado' }).eq('id', ausenteId)
            if (errAfastar) {
              console.error('[coberturas] registrarCobertura: marcar ausente como afastado:', errAfastar.message)
              atestadoMsg = `⚠ Atestado de ${ausenteNome} registrado mas status não foi atualizado — revise em Efetivo. (${errAfastar.message})`
            } else {
              atestadoMsg = `Atestado de ${ausenteNome} registrado.`
            }
          }
        }
      }
    } else if (isFalta) {
      if (dias >= 3) {
        const { error: errAusente } = await adminSupabase
          .from('funcionarios')
          .update({ status: 'faltante', motivo_afastamento: 'ausencia_temporaria' })
          .eq('id', ausenteId)
          .eq('status', 'ativo')
        if (errAusente) console.error('[coberturas] registrarCobertura: marcar ausente como faltante:', errAusente.message)
      }

      if (lancarFalta && coberturaId) {
        const { data: existingFalta } = await (supabase as unknown as AnyClient)
          .from('faltas')
          .select('id')
          .eq('cobertura_id', coberturaId)
          .maybeSingle()

        const fimEfetivoFalta = dataPrevRetorno ?? dataInicio

        if (existingFalta) {
          faltaMsg = `Falta de ${ausenteNome} já estava registrada.`
        } else if (await existeAtestadoNoPeriodo(supabase, ausenteId, dataInicio, fimEfetivoFalta)) {
          faltaMsg = `⚠ Falta de ${ausenteNome} não registrada: já existe atestado cobrindo esse período — falta e atestado não coexistem.`
        } else if (await existeAfastamentoNoPeriodo(supabase, ausenteId, dataInicio, fimEfetivoFalta)) {
          faltaMsg = `⚠ Falta de ${ausenteNome} não registrada: ela já está afastada nesse período — falta e afastamento não coexistem.`
        } else {
          const { error: errFalta } = await (adminSupabase as unknown as AnyClient)
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

  const authUser = await getUser()
  if (authUser?.perfil.role === 'supervisor') {
    await logSupervisorAcao({
      supervisorId:    authUser.user.id,
      tipo:            'cobertura',
      acao:            'criou',
      funcionarioNome: ausenteNome,
      detalhes:        tipoMotivo ?? null,
    })
  }

  revalidatePath('/coberturas')
  revalidatePath('/efetivo')
  revalidatePath('/dashboard')
  return { success: true, faltaMsg, atestadoMsg, ultrapassaMes }
}

export async function encerrarCobertura(id: string): Promise<ActionResult> {
  const guard = await assertEscrita()
  if (!guard.success) return guard

  const supabase = createClient()
  const hoje = hojeBR()

  const { data: cob, error: fetchError } = await (supabase as unknown as AnyClient)
    .from('coberturas_temporarias')
    .select('funcionario_id, posto_origem_id, posto_destino_id, funcionario_ausente_id')
    .eq('id', id)
    .single()

  if (fetchError || !cob) return { success: false, error: 'Cobertura não encontrada' }

  const adminSupabase = createAdminClient()

  const { error } = await adminSupabase
    .from('coberturas_temporarias')
    .update({ status: 'encerrada', data_retorno_real: hoje })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  if (cob.posto_origem_id && cob.funcionario_id) {
    const { error: errRestore } = await adminSupabase
      .from('funcionarios')
      .update({ posto_id: cob.posto_origem_id })
      .eq('id', cob.funcionario_id)
    if (errRestore) console.error('[coberturas] encerrarCobertura: restaurar posto do substituto:', errRestore.message)

    const { error: errMovCob } = await adminSupabase.from('movimentacoes').insert({
      funcionario_id: cob.funcionario_id,
      tipo: 'cobertura',
      campo_alterado: 'posto_id',
      valor_antes: cob.posto_destino_id ?? null,
      valor_depois: cob.posto_origem_id,
      executado_por: guard.userId,
    })
    if (errMovCob) console.error('[coberturas] encerrarCobertura: registrar movimentacao:', errMovCob.message)
  }

  if (cob.funcionario_ausente_id) {
    const { count } = await (supabase as unknown as AnyClient)
      .from('coberturas_temporarias')
      .select('id', { count: 'exact', head: true })
      .eq('funcionario_ausente_id', cob.funcionario_ausente_id)
      .eq('status', 'ativa')
    if (count === 0 && !(await temAusenciaAindaVigente(adminSupabase as unknown as AnyClient, cob.funcionario_ausente_id, hoje))) {
      await fecharAfastamentosVencidos(adminSupabase, cob.funcionario_ausente_id, hoje)
      const { error: errRev } = await adminSupabase.from('funcionarios')
        .update({ status: 'ativo', motivo_afastamento: null })
        .eq('id', cob.funcionario_ausente_id)
        .in('status', ['afastado', 'atestado', 'faltante'])
      if (errRev) console.error('[coberturas] encerrarCobertura: reverter status do ausente', cob.funcionario_ausente_id, ':', errRev.message)
    }
  }

  revalidatePath('/coberturas')
  revalidatePath('/efetivo')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function encerrarCoberturasVencidas(): Promise<{ encerradas: number }> {
  const supabase = createAdminClient()
  const hoje = hojeBR()

  const { data: vencidas } = await (supabase as unknown as AnyClient)
    .from('coberturas_temporarias')
    .select('id, funcionario_id, posto_origem_id, posto_destino_id, funcionario_ausente_id')
    .eq('status', 'ativa')
    .lt('data_prev_retorno', hoje)

  if (!vencidas || vencidas.length === 0) return { encerradas: 0 }

  const ausentesParaVerificar = new Set<string>()

  for (const cob of vencidas) {
    // Devolve o funcionário ao posto de origem ANTES de encerrar: se falhar, a cobertura
    // continua 'ativa' e a próxima execução (cron diário ou abertura de /coberturas, /efetivo) tenta de novo.
    if (cob.posto_origem_id && cob.funcionario_id) {
      const { error: errPosto } = await supabase
        .from('funcionarios')
        .update({ posto_id: cob.posto_origem_id })
        .eq('id', cob.funcionario_id)
      if (errPosto) {
        console.error('[coberturas] encerrarCoberturasVencidas: restaurar posto', cob.funcionario_id, ':', errPosto.message)
        continue
      }
    }

    const { error: errEnc } = await supabase
      .from('coberturas_temporarias')
      .update({ status: 'encerrada', data_retorno_real: hoje })
      .eq('id', cob.id)
    if (errEnc) {
      console.error('[coberturas] encerrarCoberturasVencidas: encerrar cobertura', cob.id, ':', errEnc.message)
      continue
    }

    if (cob.posto_origem_id && cob.funcionario_id) {

      const { error: errHist } = await supabase.from('historico_funcionarios').insert({
        funcionario_id:   cob.funcionario_id,
        tipo:             'cobertura_encerrada_automatico',
        dados_anteriores: { posto_id: cob.posto_destino_id },
        dados_novos:      { posto_id: cob.posto_origem_id },
      } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      if (errHist) console.error('[coberturas] encerrarCoberturasVencidas: registrar historico', cob.funcionario_id, ':', errHist.message)

      const { error: errMovCob } = await supabase.from('movimentacoes').insert({
        funcionario_id: cob.funcionario_id,
        tipo: 'cobertura',
        campo_alterado: 'posto_id',
        valor_antes: cob.posto_destino_id ?? null,
        valor_depois: cob.posto_origem_id,
        executado_por: null,
      })
      if (errMovCob) console.error('[coberturas] encerrarCoberturasVencidas: registrar movimentacao', cob.funcionario_id, ':', errMovCob.message)
    }

    if (cob.funcionario_ausente_id) ausentesParaVerificar.add(cob.funcionario_ausente_id)
  }

  for (const ausenteId of Array.from(ausentesParaVerificar)) {
    const { count } = await (supabase as unknown as AnyClient)
      .from('coberturas_temporarias')
      .select('id', { count: 'exact', head: true })
      .eq('funcionario_ausente_id', ausenteId)
      .eq('status', 'ativa')
    if (count === 0 && !(await temAusenciaAindaVigente(supabase as unknown as AnyClient, ausenteId, hoje))) {
      await fecharAfastamentosVencidos(supabase, ausenteId, hoje)
      const { error: errRev } = await supabase.from('funcionarios')
        .update({ status: 'ativo', motivo_afastamento: null })
        .eq('id', ausenteId)
        .in('status', ['afastado', 'atestado', 'faltante'])
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

/** Postos ativos de cada supervisor (id do supervisor → postos). Admin client pelo mesmo motivo de buscarTodosSupervisores. */
export async function buscarPostosPorSupervisor(): Promise<
  Record<string, { id: string; nome: string; secretaria: string | null }[]>
> {
  const guard = await assertEscrita()
  if (!guard.success) return {}
  const { data } = await (createAdminClient() as unknown as AnyClient)
    .from('config_supervisores_postos')
    .select('supervisor_id, postos(id, nome, secretaria, ativo)')
    .eq('ativo', true)
  type Row = { supervisor_id: string; postos: { id: string; nome: string; secretaria: string | null; ativo: boolean | null } | null }
  const out: Record<string, { id: string; nome: string; secretaria: string | null }[]> = {}
  for (const r of (data ?? []) as Row[]) {
    if (!r.postos || r.postos.ativo === false) continue
    ;(out[r.supervisor_id] ??= []).push({ id: r.postos.id, nome: r.postos.nome, secretaria: r.postos.secretaria })
  }
  for (const k of Object.keys(out)) out[k].sort((a, b) => a.nome.localeCompare(b.nome))
  return out
}

export async function buscarTodosSupervisores(): Promise<{ id: string; nome: string }[]> {
  // Admin client: o RLS de perfis só deixa o supervisor ler o próprio perfil, e ele precisa
  // enxergar os demais supervisores para emprestar funcionário a outro.
  const auth = await getUser()
  if (!auth) return []
  const { data } = await createAdminClient()
    .from('perfis')
    .select('id, nome')
    .eq('role', 'supervisor')
    .eq('ativo', true)
    .order('nome')
  return (data ?? []).map(s => ({ id: s.id, nome: s.nome ?? '' }))
}
