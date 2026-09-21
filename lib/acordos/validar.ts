import type { Achado, CamposAcordo, FuncionarioCalc, NivelAchado } from './tipos'
import { addMeses, diaSemanaDe, fmtDataBR, hhmmParaMin, mesDe } from './tempo'
import { MAX_ACRESCIMO_DIA_MIN, MAX_JORNADA_DIA_MIN, PRAZO_MAXIMO_MESES, regimeElegivel } from './regras'
import { agruparPorJornada, construirMovimentos, jornadaDoDia, resumoCalculo, saldoMin } from './movimentos'

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
  if ((t === 'T1' || t === 'T5') && !(c.minutosOrigem && c.minutosOrigem > 0)) faltas.push('horas trabalhadas no evento')
  if (t === 'T2') {
    if (!c.horaNormal) faltas.push('horário normal de saída')
    if (!c.horaDispensa) faltas.push('horário de dispensa')
  }
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
  }

  const faltando = camposFaltando(c)
  if (faltando.length) {
    add('erro', 'CAMPO_OBRIGATORIO', `Preencha: ${faltando.join(', ')}.`)
    return out
  }
  if (funcs.length === 0) return out

  const ajuste = c.datasAjuste
  if (new Set(ajuste).size !== ajuste.length) add('erro', 'DATAS_REPETIDAS', 'Há datas repetidas nos dias de compensação.')
  if (c.template === 'T2' && hhmmParaMin(c.horaDispensa!) >= hhmmParaMin(c.horaNormal!)) {
    add('erro', 'HORARIO_INVALIDO', 'O horário de dispensa deve ser anterior ao horário normal de saída.')
  }

  if (agruparPorJornada(c, funcs).length > 1) {
    add('erro', 'JORNADAS_DIFERENTES', 'Os funcionários têm jornadas diferentes no dia da folga. Gere um acordo por grupo de jornada.')
  }

  const r = resumoCalculo(c, funcs)
  const n = ajuste.length
  const dividiu = n === 0 || c.template === 'T5' || r.horasTotalMin % n === 0
  if (!dividiu) {
    add('erro', 'DIVISAO', `As ${r.horasTotalMin} min a compensar não dividem igualmente por ${n} dias. Ajuste a quantidade de dias.`)
  }

  const acrescimo = c.template === 'T2' || c.template === 'T3' || c.template === 'T4'
  if (acrescimo && r.minutosPorDia > MAX_ACRESCIMO_DIA_MIN) {
    add('erro', 'LIMITE_ACRESCIMO', `Acréscimo de ${r.minutosPorDia} min por dia excede o limite de ${MAX_ACRESCIMO_DIA_MIN} min (2h).`)
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
    for (const d of ajuste) {
      const jd = jornadaDoDia(f, d)
      if (jd === 0) {
        add('erro', 'DIA_DE_FOLGA', `${f.nome}: ${fmtDataBR(d)} é dia de folga na escala dele.`, f.id)
      } else if (acrescimo && jd + r.minutosPorDia > MAX_JORNADA_DIA_MIN) {
        add('erro', 'LIMITE_JORNADA', `${f.nome}: em ${fmtDataBR(d)} a jornada passaria de 10h (${jd} + ${r.minutosPorDia} min).`, f.id)
      } else if (c.template === 'T1' && r.minutosPorDia > jd) {
        add('erro', 'REDUCAO_MAIOR', `${f.nome}: a redução de ${r.minutosPorDia} min é maior que a jornada de ${fmtDataBR(d)}.`, f.id)
      }
    }
    if (c.dataFolga && (c.template === 'T3' || c.template === 'T4' || c.template === 'T5')) {
      const jf = jornadaDoDia(f, c.dataFolga)
      if (jf === 0) {
        add('erro', 'DIA_DE_FOLGA', `${f.nome}: ${fmtDataBR(c.dataFolga)} já é dia de folga na escala dele.`, f.id)
      } else if (c.template === 'T5' && r.horasTotalMin > jf) {
        add('erro', 'FOLGA_MAIOR', `${f.nome}: as horas trabalhadas superam a jornada do dia da folga.`, f.id)
      }
    }
    if (c.template === 'T2' && c.dataEvento) {
      const dia = f.semana[diaSemanaDe(c.dataEvento)]
      const saida = dia.s2 || dia.s1
      if (saida && saida !== c.horaNormal) {
        add('aviso', 'SAIDA_DIFERENTE', `${f.nome}: a saída normal em ${fmtDataBR(c.dataEvento)} é ${saida}, diferente de ${c.horaNormal}.`, f.id)
      }
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
