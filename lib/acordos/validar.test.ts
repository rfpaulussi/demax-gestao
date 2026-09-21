import { describe, it, expect } from 'vitest'
import { validarAcordo, camposFaltando, temErro, type MapaFeriados } from './validar'
import { func, T_5X2_540 } from './__fixtures__'
import type { Achado, CamposAcordo } from './tipos'

const codigos = (a: Achado[]) => a.map(x => x.codigo)

// Folga na sexta 05/06 (528 min) compensada em 8 dias úteis seguidos (66 min/dia), tudo em junho.
const OITO_DIAS = ['2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11', '2026-06-12', '2026-06-15', '2026-06-16', '2026-06-17']
const t3: CamposAcordo = { template: 'T3', dataFolga: '2026-06-05', motivo: 'ponto facultativo municipal', datasAjuste: OITO_DIAS }
const f1 = func('a')

describe('validarAcordo', () => {
  it('avisa (sem bloquear) quando o turno cadastrado não soma 44h semanais', () => {
    // seg–sex 08:00–11:00 + 12:00–18:00 = 9h/dia = 45h/semana
    const t45 = {
      tipo_escala: '5x2', hora_entrada: '08:00', hora_saida_seg_qui: '18:00', hora_saida_sex: '18:00',
      hora_inicio_almoco: '11:00', hora_fim_almoco: '12:00',
    }
    const a = validarAcordo(t3, [func('z', t45)], new Map())
    const aviso = a.find(x => x.codigo === 'TURNO_FORA_44H')
    expect(aviso?.nivel).toBe('aviso')
    expect(aviso?.funcionarioId).toBe('z')
    expect(aviso?.mensagem).toBe('Func z: o turno cadastrado soma 45:00h por semana (esperado 44:00h).')
    expect(codigos(validarAcordo(t3, [f1], new Map()))).not.toContain('TURNO_FORA_44H')
  })

  it('não emite TURNO_FORA_44H para funcionário sem turno (padrão) nem para regime não elegível', () => {
    const t45 = {
      tipo_escala: '5x2', hora_entrada: '08:00', hora_saida_seg_qui: '18:00', hora_saida_sex: '18:00',
      hora_inicio_almoco: '11:00', hora_fim_almoco: '12:00',
    }
    expect(codigos(validarAcordo(t3, [func('s', t45, { semTurno: true })], new Map()))).not.toContain('TURNO_FORA_44H')
    expect(codigos(validarAcordo(t3, [func('r', t45, { regime: '12x36' })], new Map()))).not.toContain('TURNO_FORA_44H')
  })

  it('T3 válido não gera achados', () => {
    expect(validarAcordo(t3, [f1], new Map())).toEqual([])
  })

  it('T1 válido não gera achados', () => {
    const c: CamposAcordo = {
      template: 'T1', dataEvento: '2026-06-13', nomeEvento: 'Festa', minutosOrigem: 120,
      datasAjuste: ['2026-06-15', '2026-06-16'],
    }
    expect(validarAcordo(c, [f1], new Map())).toEqual([])
  })

  it('exige funcionário', () => {
    expect(codigos(validarAcordo(t3, [], new Map()))).toContain('SEM_FUNCIONARIOS')
  })

  it('bloqueia escala não elegível (12x36) e avisa status/sem turno', () => {
    const a = validarAcordo(t3, [func('x', undefined, { regime: '12x36', status: 'afastado', semTurno: true })], new Map())
    expect(codigos(a)).toEqual(expect.arrayContaining(['REGIME_NAO_ELEGIVEL', 'STATUS', 'SEM_TURNO']))
    expect(a.find(x => x.codigo === 'REGIME_NAO_ELEGIVEL')?.nivel).toBe('erro')
    expect(a.find(x => x.codigo === 'STATUS')?.nivel).toBe('aviso')
  })

  it('bloqueia dia de ajuste em folga da escala', () => {
    const c = { ...t3, datasAjuste: [...OITO_DIAS.slice(0, 7), '2026-06-13'] } // 13/06 = sábado
    expect(codigos(validarAcordo(c, [f1], new Map()))).toContain('DIA_DE_FOLGA')
  })

  it('bloqueia acréscimo diário acima de 2h e jornada acima de 10h', () => {
    const c = { ...t3, datasAjuste: ['2026-06-08', '2026-06-09'] } // 264 min/dia
    expect(codigos(validarAcordo(c, [f1], new Map()))).toEqual(expect.arrayContaining(['LIMITE_ACRESCIMO', 'LIMITE_JORNADA']))
  })

  it('bloqueia quando as horas não dividem igualmente pelos dias', () => {
    const c = { ...t3, datasAjuste: [...OITO_DIAS.slice(0, 4), '2026-06-15'] } // 528 / 5
    expect(codigos(validarAcordo(c, [f1], new Map()))).toContain('DIVISAO')
  })

  it('exige campos por template', () => {
    expect(camposFaltando({ template: 'T2', datasAjuste: ['2026-06-08'] })).toEqual(['data do evento', 'nome do evento', 'horário de dispensa'])
    expect(camposFaltando({ template: 'T1', dataEvento: '2026-06-13', nomeEvento: 'x', datasAjuste: ['2026-06-15'] })).toEqual(['horas trabalhadas no evento'])
    expect(camposFaltando({ template: 'T1', dataEvento: '2026-06-13', nomeEvento: 'x', periodoInicio: '08:00', periodoFim: '10:00', datasAjuste: ['2026-06-15'] })).toEqual([])
    expect(camposFaltando({ template: 'T4', datasAjuste: [] })).toEqual(['data da folga', 'motivo', 'dias de acréscimo', 'prazo limite'])
    const a = validarAcordo({ template: 'T4', datasAjuste: [] }, [f1], new Map())
    expect(a.find(x => x.codigo === 'CAMPO_OBRIGATORIO')?.mensagem).toContain('prazo limite')
  })

  it('T2 válido (dispensa às 14:00, saída 17:00) não gera achados', () => {
    const c: CamposAcordo = {
      template: 'T2', dataEvento: '2026-06-05', nomeEvento: 'Emenda', horaDispensa: '14:00',
      datasAjuste: ['2026-06-08', '2026-06-09', '2026-06-10'],
    }
    expect(validarAcordo(c, [f1], new Map())).toEqual([])
  })

  it('T2 com dispensa depois da saída normal do turno: nada a compensar', () => {
    const c: CamposAcordo = {
      template: 'T2', dataEvento: '2026-06-05', nomeEvento: 'Emenda', horaDispensa: '17:30',
      datasAjuste: ['2026-06-08', '2026-06-09'],
    }
    const a = validarAcordo(c, [f1], new Map())
    const ach = a.find(x => x.codigo === 'SEM_HORAS_A_COMPENSAR')
    expect(ach).toMatchObject({ nivel: 'erro', funcionarioId: 'a' })
    expect(ach?.mensagem).toBe('Func a: já sai antes das 17:30 nesse dia (saída às 17:00).')
  })

  it('T2 aponta só o funcionário cujo turno já sai antes da dispensa', () => {
    const c: CamposAcordo = {
      template: 'T2', dataEvento: '2026-06-05', nomeEvento: 'Emenda', horaDispensa: '16:00',
      datasAjuste: ['2026-06-08', '2026-06-09'],
    }
    const a = validarAcordo(c, [f1, func('b', T_5X2_540)], new Map())
    expect(a.filter(x => x.codigo === 'SEM_HORAS_A_COMPENSAR').map(x => x.funcionarioId)).toEqual(['b'])
  })

  it('T1 com período dentro do horário normal não tem o que compensar', () => {
    const c: CamposAcordo = {
      template: 'T1', dataEvento: '2026-06-08', nomeEvento: 'Festa', periodoInicio: '08:00', periodoFim: '10:00',
      datasAjuste: ['2026-06-09', '2026-06-10'],
    }
    const ach = validarAcordo(c, [f1], new Map()).find(x => x.codigo === 'SEM_HORAS_A_COMPENSAR')
    expect(ach).toMatchObject({ nivel: 'erro', funcionarioId: 'a' })
    expect(ach?.mensagem).toBe('Func a: as horas do evento estão dentro do horário normal dele; não há o que compensar.')
  })

  it('T1 com período que passa do horário em dia útil conta só o excedente (252 min)', () => {
    const c: CamposAcordo = {
      template: 'T1', dataEvento: '2026-06-08', nomeEvento: 'Festa', periodoInicio: '08:00', periodoFim: '20:00',
      datasAjuste: ['2026-06-09', '2026-06-10', '2026-06-11'],
    }
    expect(validarAcordo(c, [f1], new Map())).toEqual([])
  })

  it('separa jornadas diferentes no dia da folga', () => {
    const c: CamposAcordo = {
      template: 'T3', dataFolga: '2026-06-08', motivo: 'x',
      datasAjuste: ['2026-06-09', '2026-06-10', '2026-06-11', '2026-06-12', '2026-06-15', '2026-06-16', '2026-06-17', '2026-06-18'],
    }
    expect(codigos(validarAcordo(c, [f1, func('b', T_5X2_540)], new Map()))).toContain('JORNADAS_DIFERENTES')
  })

  it('avisa feriado e ponto facultativo nos dias de ajuste', () => {
    const feriados: MapaFeriados = new Map([['2026-06-09', { nome: 'Ponto facultativo', tipo: 'facultativo' }]])
    const a = validarAcordo(t3, [f1], feriados)
    expect(codigos(a)).toContain('FERIADO')
    expect(temErro(a)).toBe(false)
  })

  describe('ordem das datas', () => {
    it('T1: redução antes do evento é inválida', () => {
      const c: CamposAcordo = {
        template: 'T1', dataEvento: '2026-06-13', nomeEvento: 'Festa', minutosOrigem: 120,
        datasAjuste: ['2026-06-10', '2026-06-11'],
      }
      expect(codigos(validarAcordo(c, [f1], new Map()))).toContain('ORDEM_DATAS')
    })

    it('T3: dia de compensação no mesmo dia da folga é inválido', () => {
      const c = { ...t3, datasAjuste: ['2026-06-05', ...OITO_DIAS.slice(0, 7)] }
      expect(codigos(validarAcordo(c, [f1], new Map()))).toContain('ORDEM_DATAS')
    })

    it('T4: folga no meio dos acréscimos é inválida', () => {
      const c: CamposAcordo = {
        template: 'T4', dataFolga: '2026-06-05', motivo: 'ponto facultativo', prazoLimite: '2026-11-30',
        datasAjuste: ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11'],
      }
      expect(codigos(validarAcordo(c, [f1], new Map()))).toContain('ORDEM_DATAS')
    })

    it('T5: folga antes do evento é inválida', () => {
      const c: CamposAcordo = {
        template: 'T5', dataEvento: '2026-06-13', nomeEvento: 'Mutirão', minutosOrigem: 240,
        dataFolga: '2026-06-09', datasAjuste: [],
      }
      expect(codigos(validarAcordo(c, [f1], new Map()))).toContain('ORDEM_DATAS')
    })
  })

  describe('dia do evento e horas de origem', () => {
    it('T2 com evento em dia de folga da escala (sábado) bloqueia', () => {
      const c: CamposAcordo = {
        template: 'T2', dataEvento: '2026-06-13', nomeEvento: 'Emenda', horaDispensa: '12:00',
        datasAjuste: ['2026-06-15', '2026-06-16', '2026-06-17'],
      }
      const a = validarAcordo(c, [f1], new Map())
      expect(a.find(x => x.codigo === 'DIA_DE_FOLGA')?.nivel).toBe('erro')
    })

    it('T5 com evento em dia útil só avisa', () => {
      const c: CamposAcordo = {
        template: 'T5', dataEvento: '2026-06-09', nomeEvento: 'Mutirão', minutosOrigem: 240,
        dataFolga: '2026-06-15', datasAjuste: [],
      }
      const a = validarAcordo(c, [f1], new Map())
      expect(a.find(x => x.codigo === 'EVENTO_EM_DIA_UTIL')?.nivel).toBe('aviso')
      expect(temErro(a)).toBe(false)
    })

    it('T1 com mais de 10h trabalhadas no evento bloqueia', () => {
      const c: CamposAcordo = {
        template: 'T1', dataEvento: '2026-06-13', nomeEvento: 'Festa', minutosOrigem: 1200,
        datasAjuste: ['2026-06-15', '2026-06-16'],
      }
      expect(codigos(validarAcordo(c, [f1], new Map()))).toContain('ORIGEM_LIMITE')
    })

    it('T2 com dispensa antes da entrada dispensa a jornada inteira sem estourar', () => {
      const c: CamposAcordo = {
        template: 'T2', dataEvento: '2026-06-05', nomeEvento: 'Emenda', horaDispensa: '06:00',
        datasAjuste: ['2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11', '2026-06-12', '2026-06-15', '2026-06-16', '2026-06-17'],
      }
      expect(validarAcordo(c, [f1], new Map())).toEqual([])
    })

    it('T1 com mais de 10h por funcionário bloqueia apontando quem', () => {
      const c: CamposAcordo = {
        template: 'T1', dataEvento: '2026-06-13', nomeEvento: 'Festa', periodoInicio: '00:00', periodoFim: '11:00',
        datasAjuste: ['2026-06-15', '2026-06-16'],
      }
      const ach = validarAcordo(c, [f1], new Map()).find(x => x.codigo === 'ORIGEM_LIMITE')
      expect(ach).toMatchObject({ nivel: 'erro', funcionarioId: 'a' })
    })
  })

  describe('período e texto', () => {
    const t1: CamposAcordo = {
      template: 'T1', dataEvento: '2026-06-13', nomeEvento: 'Festa', minutosOrigem: 120,
      datasAjuste: ['2026-06-15', '2026-06-16'],
    }

    it('período com só um horário é incompleto', () => {
      expect(codigos(validarAcordo({ ...t1, periodoInicio: '08:00' }, [f1], new Map()))).toContain('PERIODO_INCOMPLETO')
      expect(codigos(validarAcordo({ ...t1, periodoFim: '10:00' }, [f1], new Map()))).toContain('PERIODO_INCOMPLETO')
    })

    it('período com fim antes do início é inválido', () => {
      const a = validarAcordo({ ...t1, periodoInicio: '10:00', periodoFim: '08:00' }, [f1], new Map())
      expect(codigos(a)).toContain('PERIODO_INVALIDO')
    })

    it('nome do evento ou motivo com mais de 80 caracteres bloqueia', () => {
      expect(codigos(validarAcordo({ ...t1, nomeEvento: 'x'.repeat(81) }, [f1], new Map()))).toContain('TEXTO_LONGO')
      expect(codigos(validarAcordo({ ...t3, motivo: 'y'.repeat(81) }, [f1], new Map()))).toContain('TEXTO_LONGO')
    })
  })

  describe('casos válidos adicionais', () => {
    it('T4 válido não gera achados', () => {
      const c: CamposAcordo = {
        template: 'T4', dataFolga: '2026-06-12', motivo: 'ponto facultativo', prazoLimite: '2026-11-30',
        datasAjuste: ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05', '2026-06-08', '2026-06-09', '2026-06-10'],
      }
      expect(validarAcordo(c, [f1], new Map())).toEqual([])
    })

    it('T5 válido (sábado trabalhado, folga na segunda) não gera achados', () => {
      const c: CamposAcordo = {
        template: 'T5', dataEvento: '2026-06-13', nomeEvento: 'Mutirão', minutosOrigem: 240,
        dataFolga: '2026-06-15', datasAjuste: [],
      }
      expect(validarAcordo(c, [f1], new Map())).toEqual([])
    })
  })

  describe('mês cruzado (banco de horas)', () => {
    const cruza: CamposAcordo = {
      template: 'T3', dataFolga: '2026-06-26', motivo: 'ponto facultativo',
      datasAjuste: ['2026-06-29', '2026-06-30', '2026-07-01', '2026-07-02', '2026-07-03', '2026-07-06', '2026-07-07', '2026-07-08'],
    }

    it('avisa e exige prazo', () => {
      const a = validarAcordo(cruza, [f1], new Map())
      expect(codigos(a)).toEqual(expect.arrayContaining(['BANCO_HORAS', 'PRAZO_OBRIGATORIO']))
    })

    it('aceita prazo dentro de 6 meses', () => {
      const a = validarAcordo({ ...cruza, prazoLimite: '2026-12-20' }, [f1], new Map())
      expect(temErro(a)).toBe(false)
      expect(codigos(a)).toContain('BANCO_HORAS')
    })

    it('recusa prazo além de 6 meses ou antes da última data', () => {
      expect(codigos(validarAcordo({ ...cruza, prazoLimite: '2027-01-20' }, [f1], new Map()))).toContain('PRAZO_LONGO')
      expect(codigos(validarAcordo({ ...cruza, prazoLimite: '2026-07-03' }, [f1], new Map()))).toContain('PRAZO_ANTES')
    })
  })
})
