import type { Achado, CamposAcordo, FuncionarioCalc, NivelAchado } from './tipos'
import { addMeses, diaSemanaDe, fmtDataBR, hhmmParaMin, mesDe, minParaHHMM } from './tempo'
import { saidaDoDia, totalSemanalMin } from './horario-do-turno'
import { JORNADA_SEMANAL_MIN, MAX_ACRESCIMO_DIA_MIN, MAX_JORNADA_DIA_MIN, PRAZO_MAXIMO_MESES, regimeElegivel } from './regras'
import { agruparPorJornada, construirMovimentos, jornadaDoDia, saldoMin, totalOrigem } from './movimentos'

export type MapaFeriados = Map<string, { nome: string; tipo: string }>

export function temErro(achados: Achado[]): boolean {
  return achados.some(a => a.nivel === 'erro')
}

export function camposFaltando(c: CamposAcordo): string[] {
  const faltas: string[] = []
  const t = c.template
  if (t === 'T1' || t === 'T2' || t === 'T5') {
    if (!c.dataEvento) faltas.push('data do evento')
    if (!(c.nomeEvento ?? '').trim()) faltas.push('nome do evento')
  }
  if ((t === 'T1' || t === 'T5') && !(c.periodoInicio && c.periodoFim) && !(c.minutosOrigem && c.minutosOrigem > 0)) {
    faltas.push('horas trabalhadas no evento')
  }
  if (t === 'T2' && !c.horaDispensa) faltas.push('horário de dispensa')
  if (t === 'T3' || t === 'T4' || t === 'T5') {
    if (!c.dataFolga) faltas.push('data da folga')
  }
  if ((t === 'T3' || t === 'T4') && !(c.motivo ?? '').trim()) faltas.push('motivo')
  if (t !== 'T5' && c.datasAjuste.length === 0) faltas.push(t === 'T4' ? 'dias de acréscimo' : 'dias de compensação')
  if (t === 'T4' && !c.prazoLimite) faltas.push('prazo limite')
  return faltas
}

export function validarAcordo(c: CamposAcordo, funcs: FuncionarioCalc[], feriados: MapaFeriados = new Map()): Achado[] {
  const out: Achado[] = []
  const add = (nivel: NivelAchado, codigo: string, mensagem: string, funcionarioId?: string) =>
    out.push({ nivel, codigo, mensagem, funcionarioId })

  if (funcs.length === 0) add('erro', 'SEM_FUNCIONARIOS', 'Selecione ao menos um funcionário.')
  for (const f of funcs) {
    if (!regimeElegivel(f.regime)) {
      add('erro', 'REGIME_NAO_ELEGIVEL', `${f.nome}: a escala ${f.regime} não é elegível a acordo de compensação.`, f.id)
    }
    if (f.status !== 'ativo') add('aviso', 'STATUS', `${f.nome} está com status "${f.status}".`, f.id)
    if (f.semTurno) add('aviso', 'SEM_TURNO', `${f.nome}: sem horário cadastrado; usando o padrão 5x2 de 44h.`, f.id)
    if (regimeElegivel(f.regime) && !f.semTurno) {
      const semanal = totalSemanalMin(f.semana)
      if (semanal !== JORNADA_SEMANAL_MIN) {
        add('aviso', 'TURNO_FORA_44H', `${f.nome}: o turno cadastrado soma ${minParaHHMM(semanal)}h por semana (esperado ${minParaHHMM(JORNADA_SEMANAL_MIN)}h).`, f.id)
      }
    }
  }

  const faltando = camposFaltando(c)
  if (faltando.length) {
    add('erro', 'CAMPO_OBRIGATORIO', `Preencha: ${faltando.join(', ')}.`)
    return out
  }

  const ajuste = c.template === 'T5' ? [] : c.datasAjuste
  const t = c.template

  if ((c.nomeEvento ?? '').trim().length > 80 || (c.motivo ?? '').trim().length > 80) {
    add('erro', 'TEXTO_LONGO', 'Nome do evento/motivo passa de 80 caracteres.')
  }

  let periodoRuim = false
  if (t === 'T1' || t === 'T5') {
    if (!!c.periodoInicio !== !!c.periodoFim) {
      periodoRuim = true
      add('erro', 'PERIODO_INCOMPLETO', 'Informe o início e o fim do período trabalhado, ou deixe os dois em branco.')
    } else if (c.periodoInicio && c.periodoFim && hhmmParaMin(c.periodoFim) <= hhmmParaMin(c.periodoInicio)) {
      periodoRuim = true
      add('erro', 'PERIODO_INVALIDO', 'O fim do período trabalhado deve ser posterior ao início.')
    }
  }

  if ((t === 'T1' || t === 'T2') && c.dataEvento && ajuste.some(d => d <= c.dataEvento!)) {
    add('erro', 'ORDEM_DATAS', 'Os dias de compensação devem ser posteriores ao dia do evento.')
  } else if (t === 'T3' && c.dataFolga && ajuste.some(d => d <= c.dataFolga!)) {
    add('erro', 'ORDEM_DATAS', 'Os dias de compensação devem ser posteriores ao dia da folga.')
  } else if (t === 'T4' && c.dataFolga && ajuste.some(d => d >= c.dataFolga!)) {
    add('erro', 'ORDEM_DATAS', 'Os dias de acréscimo devem ser anteriores ao dia da folga.')
  } else if (t === 'T5' && c.dataEvento && c.dataFolga && c.dataFolga <= c.dataEvento) {
    add('erro', 'ORDEM_DATAS', 'O dia da folga deve ser posterior ao dia trabalhado.')
  }

  if (funcs.length === 0) return out

  if (new Set(ajuste).size !== ajuste.length) add('erro', 'DATAS_REPETIDAS', 'Há datas repetidas nos dias de compensação.')

  if (agruparPorJornada(c, funcs).length > 1) {
    add('erro', 'JORNADAS_DIFERENTES', 'Os funcionários têm turnos diferentes para este acordo (horário, saída ou jornada do dia). Gere um acordo por grupo.')
  }

  // origem (minutos a compensar) de cada funcionário, pelo turno dele
  const origem = new Map(funcs.map(f => [f.id, totalOrigem(c, f)]))
  const n = ajuste.length
  const naoDivide = c.template === 'T5' || n === 0 ? undefined : funcs.find(f => origem.get(f.id)! % n !== 0)
  const dividiu = !naoDivide
  if (naoDivide) {
    const total = origem.get(naoDivide.id)!
    const teto = c.template === 'T1' ? MAX_JORNADA_DIA_MIN : MAX_ACRESCIMO_DIA_MIN
    const opcoes: number[] = []
    for (let k = 1; k <= 31 && opcoes.length < 4; k++) if (total % k === 0 && total / k <= teto) opcoes.push(k)
    const dica = opcoes.length ? ` Com ${opcoes.join(', ')} dias divide certo.` : ''
    add('erro', 'DIVISAO', `As ${total} min a compensar não dividem igualmente por ${n} dias.${dica}`)
  }
  const porDiaDe = (f: FuncionarioCalc) => (n > 0 && c.template !== 'T5' ? Math.floor(origem.get(f.id)! / n) : 0)

  const acrescimo = c.template === 'T2' || c.template === 'T3' || c.template === 'T4'
  const maiorPorDia = Math.max(0, ...funcs.map(porDiaDe))
  if (acrescimo && maiorPorDia > MAX_ACRESCIMO_DIA_MIN) {
    add('erro', 'LIMITE_ACRESCIMO', `Acréscimo de ${maiorPorDia} min por dia excede o limite de ${MAX_ACRESCIMO_DIA_MIN} min (2h).`)
  }

  const feriadoAvisado = new Set<string>()
  for (const d of ajuste) {
    const fer = feriados.get(d)
    if (fer && !feriadoAvisado.has(d)) {
      feriadoAvisado.add(d)
      add('aviso', 'FERIADO', `${fmtDataBR(d)} cai em ${fer.nome} (${fer.tipo}).`)
    }
  }
  for (const f of funcs) {
    const orig = origem.get(f.id)!
    const porDia = porDiaDe(f)
    for (const d of ajuste) {
      const jd = jornadaDoDia(f, d)
      if (jd === 0) {
        add('erro', 'DIA_DE_FOLGA', `${f.nome}: ${fmtDataBR(d)} é dia de folga na escala dele.`, f.id)
      } else if (acrescimo && jd + porDia > MAX_JORNADA_DIA_MIN) {
        add('erro', 'LIMITE_JORNADA', `${f.nome}: em ${fmtDataBR(d)} a jornada passaria de 10h (${jd} + ${porDia} min).`, f.id)
      } else if (c.template === 'T1' && porDia > jd) {
        add('erro', 'REDUCAO_MAIOR', `${f.nome}: a redução de ${porDia} min é maior que a jornada de ${fmtDataBR(d)}.`, f.id)
      }
    }
    if (c.dataFolga && (c.template === 'T3' || c.template === 'T4' || c.template === 'T5')) {
      const jf = jornadaDoDia(f, c.dataFolga)
      if (jf === 0) {
        add('erro', 'DIA_DE_FOLGA', `${f.nome}: ${fmtDataBR(c.dataFolga)} já é dia de folga na escala dele.`, f.id)
      } else if (c.template === 'T5' && orig > jf) {
        add('erro', 'FOLGA_MAIOR', `${f.nome}: as horas trabalhadas superam a jornada do dia da folga.`, f.id)
      }
    }
    if (c.template === 'T2' && c.dataEvento) {
      const dia = f.semana[diaSemanaDe(c.dataEvento)]
      if (jornadaDoDia(f, c.dataEvento) === 0) {
        add('erro', 'DIA_DE_FOLGA', `${f.nome}: ${fmtDataBR(c.dataEvento)} é dia de folga na escala dele; não há horário a dispensar.`, f.id)
      } else if (orig <= 0) {
        add('erro', 'SEM_HORAS_A_COMPENSAR', `${f.nome}: já sai antes das ${c.horaDispensa} nesse dia (saída às ${saidaDoDia(dia)}).`, f.id)
      }
    }
    if ((c.template === 'T1' || c.template === 'T5') && !periodoRuim) {
      if (orig <= 0) {
        add('erro', 'SEM_HORAS_A_COMPENSAR', `${f.nome}: as horas do evento estão dentro do horário normal dele; não há o que compensar.`, f.id)
      } else if (orig > MAX_JORNADA_DIA_MIN) {
        add('erro', 'ORIGEM_LIMITE', `${f.nome}: as ${orig} min trabalhadas no evento passam do limite de ${MAX_JORNADA_DIA_MIN} min (10h).`, f.id)
      }
    }
    if (c.template === 'T5' && c.dataEvento && jornadaDoDia(f, c.dataEvento) > 0) {
      add('aviso', 'EVENTO_EM_DIA_UTIL', `${f.nome}: ${fmtDataBR(c.dataEvento)} é dia normal de trabalho na escala dele.`, f.id)
    }
  }
  if (c.dataFolga && (c.template === 'T3' || c.template === 'T4' || c.template === 'T5')) {
    const fer = feriados.get(c.dataFolga)
    if (fer && fer.tipo !== 'facultativo') {
      add('aviso', 'FERIADO', `${fmtDataBR(c.dataFolga)} já é feriado (${fer.nome}); a dispensa não gera compensação.`)
    }
  }

  if (dividiu) {
    for (const f of funcs) {
      const saldo = saldoMin(construirMovimentos(c, [f]))
      if (saldo !== 0) add('erro', 'SALDO', `${f.nome}: o saldo do acordo é ${saldo} min (deve ser zero).`, f.id)
    }
  }

  const datas = [c.dataEvento, c.dataFolga, ...ajuste].filter((d): d is string => !!d).sort()
  const cruza = new Set(datas.map(mesDe)).size > 1
  if (cruza && c.template !== 'T4') {
    add('aviso', 'BANCO_HORAS', 'Compensação em mês diferente do evento: tratada como banco de horas (prazo máximo de 6 meses). Confirmar com o RH.')
    if (!c.prazoLimite) add('erro', 'PRAZO_OBRIGATORIO', 'As datas cruzam o mês: informe o prazo limite (até 6 meses).')
  }
  if (c.prazoLimite && datas.length) {
    if (datas[datas.length - 1] > c.prazoLimite) add('erro', 'PRAZO_ANTES', 'O prazo limite é anterior à última data do acordo.')
    if (c.prazoLimite > addMeses(datas[0], PRAZO_MAXIMO_MESES)) {
      add('erro', 'PRAZO_LONGO', `O prazo limite passa de ${PRAZO_MAXIMO_MESES} meses da primeira data.`)
    }
  }
  return out
}
