import { describe, it, expect } from 'vitest'
import {
  agruparAchados, combinarNomesEvento, dataMaximaPrazo, fmtDuracao, fmtHM, identificarMotivo, montarChecklist, montarMotivoDecreto,
  motivoDoCalendario, nomesRecentesDistintos, precisaPrazo, proximasDatasCalendario, rotuloAtalhoCalendario, rotuloDiaChip,
  textoConta, tituloSugerido,
} from './resumo'
import type { Achado, CamposAcordo } from './tipos'
import type { CalendarioLinha } from '../calendario/mapa'

const achado = (codigo: string, mensagem: string, nivel: Achado['nivel'] = 'aviso', funcionarioId?: string): Achado =>
  ({ codigo, mensagem, nivel, funcionarioId })

const base = (extra: Partial<CamposAcordo> = {}): CamposAcordo => ({ template: 'T3', datasAjuste: [], ...extra })

describe('precisaPrazo', () => {
  it('T4 sempre exige prazo', () => {
    expect(precisaPrazo('T4', [], '')).toBe(true)
  })

  it('outros templates só quando há achado de prazo', () => {
    expect(precisaPrazo('T3', [], undefined)).toBe(false)
    expect(precisaPrazo('T3', [achado('PRAZO_OBRIGATORIO', 'x', 'erro')], '')).toBe(true)
    expect(precisaPrazo('T1', [achado('PRAZO_LONGO', 'x', 'erro')], '2027-12-01')).toBe(true)
    expect(precisaPrazo('T2', [achado('PRAZO_ANTES', 'x', 'erro')], '2026-01-01')).toBe(true)
  })

  it('quando já preenchido continua visível', () => {
    expect(precisaPrazo('T3', [], '2026-08-01')).toBe(true)
  })

  it('ignora achados de outros códigos', () => {
    expect(precisaPrazo('T3', [achado('FERIADO', 'x')], '')).toBe(false)
  })
})

describe('dataMaximaPrazo', () => {
  it('soma 6 meses à menor data entre evento, folga e dias de ajuste', () => {
    expect(dataMaximaPrazo(base({ dataEvento: '2026-06-10', dataFolga: '2026-06-20', datasAjuste: ['2026-06-12'] }))).toBe('2026-12-10')
    expect(dataMaximaPrazo(base({ dataFolga: '2026-06-30', datasAjuste: ['2026-06-01', '2026-06-02'] }))).toBe('2026-12-01')
  })

  it('ajusta ao último dia do mês', () => {
    expect(dataMaximaPrazo(base({ dataEvento: '2026-08-31' }))).toBe('2027-02-28')
  })

  it('devolve null sem nenhuma data', () => {
    expect(dataMaximaPrazo(base())).toBeNull()
  })
})

describe('agruparAchados', () => {
  it('agrupa por código mantendo a ordem de aparição', () => {
    const g = agruparAchados([
      achado('STATUS', 'A está com status "afastado".', 'aviso', 'a'),
      achado('FERIADO', '05/06 cai em X (facultativo).'),
      achado('STATUS', 'B está com status "atestado".', 'aviso', 'b'),
    ])
    expect(g.map(x => x.codigo)).toEqual(['STATUS', 'FERIADO'])
    expect(g[0].itens).toHaveLength(2)
  })

  it('coloca erros antes de avisos, com ordem estável', () => {
    const g = agruparAchados([
      achado('STATUS', 's'),
      achado('DIA_DE_FOLGA', 'd', 'erro'),
      achado('FERIADO', 'f'),
      achado('DIVISAO', 'v', 'erro'),
    ])
    expect(g.map(x => x.codigo)).toEqual(['DIA_DE_FOLGA', 'DIVISAO', 'STATUS', 'FERIADO'])
    expect(g.map(x => x.nivel)).toEqual(['erro', 'erro', 'aviso', 'aviso'])
  })

  it('usa títulos amigáveis com a contagem nos códigos conhecidos', () => {
    const g = agruparAchados([
      achado('STATUS', 'a', 'aviso', '1'), achado('STATUS', 'b', 'aviso', '2'), achado('STATUS', 'c', 'aviso', '3'),
    ])
    expect(g[0].titulo).toBe('3 funcionários com status diferente de ativo')
    const um = agruparAchados([achado('SEM_TURNO', 'a')])
    expect(um[0].titulo).toBe('1 funcionário sem horário cadastrado (usando 5x2 de 44h)')
  })

  it('cobre todos os códigos amigáveis', () => {
    for (const codigo of ['STATUS', 'SEM_TURNO', 'TURNO_FORA_44H', 'FERIADO', 'DIA_DE_FOLGA', 'SEM_HORAS_A_COMPENSAR']) {
      const [g] = agruparAchados([achado(codigo, 'msg original'), achado(codigo, 'outra')])
      expect(g.titulo).not.toBe('msg original')
      expect(g.titulo).toMatch(/^2 /)
    }
  })

  it('demais códigos usam a primeira mensagem', () => {
    const [g] = agruparAchados([achado('DIVISAO', 'As 100 min não dividem.', 'erro'), achado('DIVISAO', 'outra', 'erro')])
    expect(g.titulo).toBe('As 100 min não dividem.')
    expect(g.itens).toEqual(['As 100 min não dividem.', 'outra'])
  })

  it('lista vazia devolve vazio', () => {
    expect(agruparAchados([])).toEqual([])
  })
})

describe('textoConta', () => {
  it('redação por template', () => {
    expect(textoConta('T3', 8, 66, 528, false)).toBe('8 dias × 66 min = 8h48 a repor')
    expect(textoConta('T1', 4, 60, 240, false)).toBe('4 dias × 60 min = 4h a reduzir')
    expect(textoConta('T4', 1, 60, 60, false)).toBe('1 dia × 60 min = 1h a trabalhar a mais')
  })

  it('acrescenta "varia por turno"', () => {
    expect(textoConta('T2', 2, 60, 120, true)).toBe('2 dias × 60 min = 2h a repor (varia por turno)')
  })

  it('devolve null sem dias ou sem horas', () => {
    expect(textoConta('T3', 0, 0, 0, false)).toBeNull()
    expect(textoConta('T3', 3, 0, 0, false)).toBeNull()
    expect(textoConta('T5', 0, 0, 240, false)).toBeNull()
  })
})

describe('fmtDuracao / fmtHM', () => {
  it('formata minutos', () => {
    expect(fmtDuracao(480)).toBe('8h')
    expect(fmtDuracao(528)).toBe('8h48')
    expect(fmtDuracao(50)).toBe('0h50')
    expect(fmtHM(480)).toBe('8h00')
    expect(fmtHM(65)).toBe('1h05')
  })
})

describe('rotuloDiaChip', () => {
  it('dia da semana abreviado, número do dia e sem mês quando é o mesmo do primeiro', () => {
    expect(rotuloDiaChip('2026-06-08', '2026-06-08')).toEqual({ semana: 'seg', dia: '8', mes: null })
    expect(rotuloDiaChip('2026-06-13', '2026-06-08')).toEqual({ semana: 'sáb', dia: '13', mes: null })
  })

  it('mostra o mês abreviado quando difere do primeiro', () => {
    expect(rotuloDiaChip('2026-07-01', '2026-06-30')).toEqual({ semana: 'qua', dia: '1', mes: 'jul' })
  })

  it('funciona sem referência', () => {
    expect(rotuloDiaChip('2026-06-09', undefined)).toEqual({ semana: 'ter', dia: '9', mes: null })
  })
})

describe('motivo: decreto e identificação', () => {
  it('monta o motivo do decreto', () => {
    expect(montarMotivoDecreto('')).toBe('decreto municipal')
    expect(montarMotivoDecreto('  ')).toBe('decreto municipal')
    expect(montarMotivoDecreto('12.345/2026')).toBe('decreto municipal nº 12.345/2026')
    expect(montarMotivoDecreto('nº 99')).toBe('decreto municipal nº 99')
  })

  it('identifica chips do catálogo', () => {
    expect(identificarMotivo('')).toEqual({ id: null, decreto: '' })
    expect(identificarMotivo('falta de água')).toEqual({ id: 'falta-agua', decreto: '' })
    expect(identificarMotivo('Falta de água')).toEqual({ id: 'falta-agua', decreto: '' })
    expect(identificarMotivo('decreto municipal')).toEqual({ id: 'decreto-municipal', decreto: '' })
    expect(identificarMotivo('decreto municipal nº 77')).toEqual({ id: 'decreto-municipal', decreto: '77' })
  })

  it('texto fora do catálogo é "outro"', () => {
    expect(identificarMotivo('Reunião especial do prefeito')).toEqual({ id: 'outro', decreto: '' })
  })
})

describe('motivoDoCalendario', () => {
  it('facultativo vira ponto facultativo municipal', () => {
    expect(motivoDoCalendario({ nome: 'Ponto facultativo', tipo: 'facultativo' })).toBe('ponto facultativo municipal')
  })

  it('feriado usa o nome', () => {
    expect(motivoDoCalendario({ nome: 'Corpus Christi', tipo: 'nacional' })).toBe('feriado Corpus Christi')
  })
})

describe('montarChecklist', () => {
  const entrada = (extra = {}) => ({
    situacaoEscolhida: true, titulo: 'Emenda', postosSel: 1, funcionarios: 3,
    campos: base({ dataFolga: '2026-06-05', motivo: 'decreto municipal', datasAjuste: ['2026-06-08'] }),
    achados: [] as Achado[], prazoObrigatorio: false, ...extra,
  })
  const ok = (itens: ReturnType<typeof montarChecklist>, id: string) => itens.find(i => i.id === id)?.ok

  it('tudo pronto', () => {
    const itens = montarChecklist(entrada())
    expect(itens.map(i => i.id)).toEqual(['titulo', 'situacao', 'funcionarios', 'datas', 'motivo'])
    expect(itens.every(i => i.ok)).toBe(true)
    expect(itens.find(i => i.id === 'funcionarios')?.label).toBe('Posto e funcionários (3)')
  })

  it('sem situação só mostra os itens comuns', () => {
    const itens = montarChecklist(entrada({ situacaoEscolhida: false }))
    expect(itens.map(i => i.id)).toEqual(['titulo', 'situacao', 'funcionarios'])
    expect(ok(itens, 'situacao')).toBe(false)
  })

  it('título, posto e funcionários pendentes', () => {
    const itens = montarChecklist(entrada({ titulo: ' ', postosSel: 0, funcionarios: 0 }))
    expect(ok(itens, 'titulo')).toBe(false)
    expect(ok(itens, 'funcionarios')).toBe(false)
  })

  it('campos faltando separam datas, motivo e prazo', () => {
    const campos = base({ template: 'T4' })
    const itens = montarChecklist(entrada({ campos, prazoObrigatorio: true }))
    expect(ok(itens, 'datas')).toBe(false)
    expect(ok(itens, 'motivo')).toBe(false)
    expect(ok(itens, 'prazo')).toBe(false)
    const soPrazo = montarChecklist(entrada({
      campos: base({ template: 'T4', dataFolga: '2026-06-12', motivo: 'decreto municipal', datasAjuste: ['2026-06-10'] }),
      prazoObrigatorio: true,
    }))
    expect(ok(soPrazo, 'datas')).toBe(true)
    expect(ok(soPrazo, 'motivo')).toBe(true)
    expect(ok(soPrazo, 'prazo')).toBe(false)
  })

  it('erro de validação de datas pendura em "datas"', () => {
    const itens = montarChecklist(entrada({ achados: [achado('DIVISAO', 'x', 'erro')] }))
    expect(ok(itens, 'datas')).toBe(false)
  })

  it('erros de prazo e de funcionários vão para os itens certos', () => {
    const p = montarChecklist(entrada({ prazoObrigatorio: true, achados: [achado('PRAZO_OBRIGATORIO', 'x', 'erro')] }))
    expect(ok(p, 'prazo')).toBe(false)
    expect(ok(p, 'datas')).toBe(true)
    const f = montarChecklist(entrada({ achados: [achado('REGIME_NAO_ELEGIVEL', 'x', 'erro', 'a')] }))
    expect(ok(f, 'funcionarios')).toBe(false)
    expect(ok(f, 'datas')).toBe(true)
  })

  it('avisos não geram pendência', () => {
    const itens = montarChecklist(entrada({ achados: [achado('FERIADO', 'x'), achado('STATUS', 'y')] }))
    expect(itens.every(i => i.ok)).toBe(true)
  })

  it('T2 tem motivo opcional; T1 e T5 não têm motivo', () => {
    const t2 = montarChecklist(entrada({ campos: base({ template: 'T2' }) }))
    expect(t2.find(i => i.id === 'motivo')?.label).toBe('Motivo (opcional)')
    expect(ok(t2, 'motivo')).toBe(true)
    expect(montarChecklist(entrada({ campos: base({ template: 'T1' }) })).some(i => i.id === 'motivo')).toBe(false)
    expect(montarChecklist(entrada({ campos: base({ template: 'T5' }) })).some(i => i.id === 'motivo')).toBe(false)
  })

  it('item de prazo só existe quando exigido', () => {
    expect(montarChecklist(entrada()).some(i => i.id === 'prazo')).toBe(false)
    expect(montarChecklist(entrada({ prazoObrigatorio: true })).some(i => i.id === 'prazo')).toBe(true)
  })
})

describe('tituloSugerido', () => {
  it('T1: evento com nome e data', () => {
    expect(tituloSugerido('T1', base({ template: 'T1', nomeEvento: 'Festa Junina', dataEvento: '2026-09-14' }))).toBe('Evento Festa Junina (14/09)')
  })

  it('T2: dispensa com data e nome', () => {
    expect(tituloSugerido('T2', base({ template: 'T2', nomeEvento: 'Chuva forte', dataEvento: '2026-09-14' }))).toBe('Dispensa 14/09 — Chuva forte')
  })

  it('T3: folga com data e posto', () => {
    expect(tituloSugerido('T3', base({ dataFolga: '2026-06-05' }), 'EMEF Centro')).toBe('Folga 05/06 — EMEF Centro')
  })

  it('T4: banco de horas com a data da folga', () => {
    expect(tituloSugerido('T4', base({ template: 'T4', dataFolga: '2026-06-12' }))).toBe('Banco de horas — folga 12/06')
  })

  it('T5: descanso trabalhado com nome e data', () => {
    expect(tituloSugerido('T5', base({ template: 'T5', nomeEvento: 'Mutirão', dataEvento: '2026-06-20' }))).toBe('Descanso trabalhado: Mutirão (20/06)')
  })

  it('omite partes ausentes sem deixar traços soltos', () => {
    expect(tituloSugerido('T1', base({ template: 'T1', nomeEvento: 'Festa Junina' }))).toBe('Evento Festa Junina')
    expect(tituloSugerido('T1', base({ template: 'T1', dataEvento: '2026-09-14' }))).toBe('Evento (14/09)')
    expect(tituloSugerido('T2', base({ template: 'T2', dataEvento: '2026-09-14' }))).toBe('Dispensa 14/09')
    expect(tituloSugerido('T2', base({ template: 'T2', nomeEvento: 'Chuva' }))).toBe('Dispensa — Chuva')
    expect(tituloSugerido('T3', base({ dataFolga: '2026-06-05' }))).toBe('Folga 05/06')
    expect(tituloSugerido('T3', base(), 'EMEF Centro')).toBe('Folga — EMEF Centro')
    expect(tituloSugerido('T5', base({ template: 'T5', nomeEvento: 'Mutirão' }))).toBe('Descanso trabalhado: Mutirão')
    expect(tituloSugerido('T5', base({ template: 'T5', dataEvento: '2026-06-20' }))).toBe('Descanso trabalhado (20/06)')
  })

  it('sem nenhuma informação devolve vazio', () => {
    for (const t of ['T1', 'T2', 'T3', 'T4', 'T5'] as const) expect(tituloSugerido(t, base({ template: t }))).toBe('')
    expect(tituloSugerido('T3', base(), '   ')).toBe('')
  })

  it('limita a 80 caracteres e normaliza espaços', () => {
    const longo = tituloSugerido('T1', base({ template: 'T1', nomeEvento: 'A'.repeat(120), dataEvento: '2026-09-14' }))
    expect(longo.length).toBeLessThanOrEqual(80)
    expect(tituloSugerido('T1', base({ template: 'T1', nomeEvento: '  Festa   Junina ' }))).toBe('Evento Festa Junina')
  })
})

describe('proximasDatasCalendario', () => {
  const l = (data: string, nome = 'X', tipo: CalendarioLinha['tipo'] = 'facultativo', ate_hora: string | null = null): CalendarioLinha =>
    ({ data, nome, tipo, ate_hora })

  it('mantém datas entre hoje-7 e hoje+90, ordenadas', () => {
    const r = proximasDatasCalendario(
      [l('2026-09-30'), l('2026-06-01'), l('2026-09-14'), l('2026-09-10'), l('2026-12-31'), l('2026-09-24')],
      '2026-09-17',
    )
    expect(r.map(x => x.data)).toEqual(['2026-09-10', '2026-09-14', '2026-09-24', '2026-09-30'])
  })

  it('bordas inclusivas', () => {
    const r = proximasDatasCalendario([l('2026-09-10'), l('2026-09-09'), l('2026-12-16'), l('2026-12-17')], '2026-09-17')
    expect(r.map(x => x.data)).toEqual(['2026-09-10', '2026-12-16'])
  })

  it('respeita limite e opções', () => {
    const cal = Array.from({ length: 10 }, (_, i) => l(`2026-09-${String(18 + i).padStart(2, '0')}`))
    expect(proximasDatasCalendario(cal, '2026-09-17')).toHaveLength(6)
    expect(proximasDatasCalendario(cal, '2026-09-17', { limite: 2 })).toHaveLength(2)
    expect(proximasDatasCalendario(cal, '2026-09-17', { depois: 3 }).map(x => x.data)).toEqual(['2026-09-18', '2026-09-19', '2026-09-20'])
    expect(proximasDatasCalendario([l('2026-09-01')], '2026-09-17', { antes: 30 })).toHaveLength(1)
  })

  it('não altera o array de entrada e aceita vazio', () => {
    const cal = [l('2026-09-20'), l('2026-09-18')]
    proximasDatasCalendario(cal, '2026-09-17')
    expect(cal[0].data).toBe('2026-09-20')
    expect(proximasDatasCalendario([], '2026-09-17')).toEqual([])
  })
})

describe('rotuloAtalhoCalendario', () => {
  it('semana, dia/mês e nome', () => {
    expect(rotuloAtalhoCalendario({ data: '2026-06-05', nome: 'ponto facultativo', tipo: 'facultativo', ate_hora: null })).toBe('sex 05/06 · ponto facultativo')
  })

  it('meio período mostra "até 13h"', () => {
    expect(rotuloAtalhoCalendario({ data: '2026-06-05', nome: 'ponto facultativo', tipo: 'facultativo', ate_hora: '13:00:00' })).toBe('sex 05/06 · ponto facultativo · até 13h')
    expect(rotuloAtalhoCalendario({ data: '2026-06-05', nome: 'X', tipo: 'facultativo', ate_hora: '12:30' })).toBe('sex 05/06 · X · até 12h30')
  })
})

describe('nomes de evento', () => {
  it('nomesRecentesDistintos: distintos sem diferenciar maiúsculas, ordem preservada, até o máximo', () => {
    const r = nomesRecentesDistintos(['Festa Junina', null, 'festa junina', ' Reunião ', '', 'Mutirão'], 2)
    expect(r).toEqual(['Festa Junina', 'Reunião'])
    expect(nomesRecentesDistintos([])).toEqual([])
    expect(nomesRecentesDistintos(Array.from({ length: 20 }, (_, i) => `N${i}`))).toHaveLength(8)
  })

  it('combinarNomesEvento: recentes primeiro, sem duplicar, no máximo 12', () => {
    expect(combinarNomesEvento(['Sarau', 'festa junina'], ['Festa Junina', 'Formatura'])).toEqual(['Sarau', 'festa junina', 'Formatura'])
    const muitos = combinarNomesEvento(['a', 'b'], Array.from({ length: 20 }, (_, i) => `S${i}`))
    expect(muitos).toHaveLength(12)
    expect(muitos.slice(0, 2)).toEqual(['a', 'b'])
  })
})
