import { describe, it, expect } from 'vitest'
import { aplicarExtracao, casarPosto, dataValida, horaValida, mencionaPagamento, motivoDoCatalogo, type ContextoIA } from './normalizar'
import { lerExtracao, type PedidoExtraido } from './schema'

const ctx: ContextoIA = {
  postos: [
    { id: 'p1', nome: 'CASARÃO' },
    { id: 'p2', nome: 'CAPS II' },
    { id: 'p3', nome: 'CAPS INFANTIL' },
    { id: 'p4', nome: 'CEMPRE BENEDITO' },
  ],
  pessoas: [
    { id: 'f1', nome: 'ANA', posto_id: 'p1' },
    { id: 'f2', nome: 'BIA', posto_id: 'p1' },
  ],
  mapa: { FUNC_1: 'f1', FUNC_2: 'f2' },
  hoje: '2026-09-21',
}

const vazio: PedidoExtraido = {
  situacao: null, posto: null, funcionarios: [], todos_do_posto: false, nome_evento: null, data_evento: null,
  datas_evento_extras: [], periodo_inicio: null, periodo_fim: null, horas_trabalhadas: null, hora_dispensa: null,
  data_folga: null, folga_horas: null, motivo: null, dias_compensacao: [], quantidade_dias: null, prazo_limite: null,
  revezamento: [], perguntas: [],
}
const ex = (p: Partial<PedidoExtraido>): PedidoExtraido => ({ ...vazio, ...p })

describe('datas e horas', () => {
  it('aceita só datas reais num intervalo plausível', () => {
    expect(dataValida('2026-09-14', '2026-09-21')).toBe('2026-09-14')
    expect(dataValida('2026-02-30', '2026-09-21')).toBeNull()
    expect(dataValida('2019-01-01', '2026-09-21')).toBeNull()
    expect(dataValida('14/09/2026', '2026-09-21')).toBeNull()
  })

  it('normaliza hora', () => {
    expect(horaValida('9:05')).toBe('09:05')
    expect(horaValida('12:00')).toBe('12:00')
    expect(horaValida('25:00')).toBeNull()
    expect(horaValida('12h')).toBeNull()
  })
})

describe('casarPosto', () => {
  it('acha o posto sem acento e em minúsculas', () => {
    expect(casarPosto('casarao', ctx.postos).id).toBe('p1')
    expect(casarPosto('Cempre', ctx.postos).id).toBe('p4')
  })

  it('nome que serve a mais de um posto vira pergunta, não escolha', () => {
    const r = casarPosto('caps', ctx.postos)
    expect(r.id).toBeNull()
    expect(r.candidatos).toEqual(['CAPS II', 'CAPS INFANTIL'])
  })

  it('posto que não existe', () => {
    expect(casarPosto('Biblioteca', ctx.postos)).toEqual({ id: null, candidatos: [] })
  })
})

describe('motivoDoCatalogo', () => {
  it('troca por frase do catálogo (com o conector certo) e mantém texto livre curto', () => {
    expect(motivoDoCatalogo('chuva forte')).toBe('alagamento ou chuva forte')
    expect(motivoDoCatalogo('sem luz')).toBe('falta de energia elétrica')
    expect(motivoDoCatalogo('ponto facultativo')).toBe('ponto facultativo municipal')
    expect(motivoDoCatalogo('reunião do conselho')).toBe('reunião do conselho')
    expect(motivoDoCatalogo(null)).toBeNull()
  })
})

describe('aplicarExtracao', () => {
  it('T2 completo: preenche o formulário e não pergunta nada', () => {
    const r = aplicarExtracao(ex({
      situacao: 'T2', posto: 'Casarão', todos_do_posto: true, data_evento: '2026-09-14', nome_evento: 'Chuva forte',
      hora_dispensa: '12:00', motivo: 'chuva forte', quantidade_dias: 6,
    }), ctx)
    expect(r.template).toBe('T2')
    expect(r.postoId).toBe('p1')
    expect(r.form).toMatchObject({ dataEvento: '2026-09-14', nomeEvento: 'Chuva forte', horaDispensa: '12:00', motivo: 'alagamento ou chuva forte' })
    expect(r.quantidadeDias).toBe(6)
    expect(r.perguntas).toEqual([])
  })

  it('pedido incompleto vira pergunta, com as mesmas exigências do formulário', () => {
    const r = aplicarExtracao(ex({ situacao: 'T2', posto: 'Casarão', data_evento: '2026-09-14' }), ctx)
    expect(r.perguntas).toEqual(['Qual foi o evento ou o motivo do dia?', 'A que horas foram liberados?'])
  })

  it('sem situação pergunta o que aconteceu', () => {
    const r = aplicarExtracao(ex({ posto: 'Casarão' }), ctx)
    expect(r.template).toBeNull()
    expect(r.perguntas[0]).toContain('O que aconteceu?')
  })

  it('data inválida é descartada com aviso e vira pergunta', () => {
    const r = aplicarExtracao(ex({ situacao: 'T3', posto: 'Casarão', data_folga: '2026-02-31', motivo: 'ponto facultativo' }), ctx)
    expect(r.form.dataFolga).toBeUndefined()
    expect(r.avisos[0]).toContain('Ignorei a data')
    expect(r.perguntas).toContain('Em que dia é a folga?')
  })

  it('T5 com dois dias e horas; revezamento por funcionário', () => {
    const r = aplicarExtracao(ex({
      situacao: 'T5', posto: 'Casarão', nome_evento: 'Mutirão', data_evento: '2026-06-20', datas_evento_extras: ['2026-06-21'],
      horas_trabalhadas: '04:00', funcionarios: ['FUNC_1', 'FUNC_2'],
      revezamento: [{ funcionario: 'FUNC_1', data: '2026-06-26' }, { funcionario: 'FUNC_2', data: '2026-06-29' }],
    }), ctx)
    expect(r.form).toMatchObject({
      dataEvento: '2026-06-20', datasEventoExtras: ['2026-06-21'], duracao: '04:00', revezamento: true,
      folgas: { f1: '2026-06-26', f2: '2026-06-29' }, dataFolga: '2026-06-26',
    })
    expect(r.funcionarioIds).toEqual(['f1', 'f2'])
    expect(r.perguntas).toEqual([])
  })

  it('deduz o posto pelos funcionários citados', () => {
    const r = aplicarExtracao(ex({ situacao: 'T3', funcionarios: ['FUNC_1'], data_folga: '2026-10-30', motivo: 'ponto facultativo' }), ctx)
    expect(r.postoId).toBe('p1')
  })

  it('posto ambíguo vira pergunta', () => {
    const r = aplicarExtracao(ex({ situacao: 'T3', posto: 'caps', data_folga: '2026-10-30', motivo: 'ponto facultativo' }), ctx)
    expect(r.postoId).toBeNull()
    expect(r.perguntas[0]).toBe('Qual posto? (CAPS II ou CAPS INFANTIL)')
  })

  it('T4 pede o prazo e aceita folga de só algumas horas', () => {
    const r = aplicarExtracao(ex({ situacao: 'T4', posto: 'Casarão', data_folga: '2026-10-30', motivo: 'ponto facultativo', folga_horas: '04:00' }), ctx)
    expect(r.form).toMatchObject({ folgaParcial: true, duracaoFolga: '04:00' })
    expect(r.perguntas).toEqual(['Até quando podem compensar (prazo máximo, até 6 meses)?'])
  })
})

describe('data no campo vizinho', () => {
  it('T3 sem data_folga usa data_evento; T2 sem data_evento usa data_folga', () => {
    const t3 = aplicarExtracao(ex({ situacao: 'T3', posto: 'Casarão', data_evento: '2026-06-05', motivo: 'ponto facultativo' }), ctx)
    expect(t3.form.dataFolga).toBe('2026-06-05')
    expect(t3.perguntas).toEqual([])
    const t2 = aplicarExtracao(ex({ situacao: 'T2', posto: 'Casarão', data_folga: '2026-09-14', nome_evento: 'Chuva', hora_dispensa: '12:00' }), ctx)
    expect(t2.form.dataEvento).toBe('2026-09-14')
  })
})

describe('mencionaPagamento', () => {
  it('detecta pedido que fala em pagar horas', () => {
    expect(mencionaPagamento('essas horas serão pagas nos dias 23 e 24')).toBe(true)
    expect(mencionaPagamento('vão receber em dinheiro')).toBe(true)
    expect(mencionaPagamento('pagar como hora extra')).toBe(true)
  })

  it('não confunde com compensação em tempo', () => {
    expect(mencionaPagamento('Liberamos às 12h e repõem em 6 dias')).toBe(false)
    expect(mencionaPagamento('folga dia 26 do banco de horas')).toBe(false)
  })
})

describe('lerExtracao', () => {
  it('descarta o que não tem o formato esperado', () => {
    expect(lerExtracao(null)).toBeNull()
    expect(lerExtracao('texto')).toBeNull()
    const r = lerExtracao({ situacao: 'T9', posto: 5, funcionarios: ['FUNC_1', 3], quantidade_dias: 'seis', perguntas: ['a', 'b', 'c', 'd'] })!
    expect(r.situacao).toBeNull()
    expect(r.posto).toBeNull()
    expect(r.funcionarios).toEqual(['FUNC_1'])
    expect(r.quantidade_dias).toBeNull()
    expect(r.perguntas).toEqual(['a', 'b', 'c'])
  })
})
