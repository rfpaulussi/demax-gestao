import { describe, it, expect } from 'vitest'
import { gerarObjeto, contemPlaceholder, normalizaMotivo, TEMPLATES } from './templates'
import type { CamposAcordo } from './tipos'

const r = (horasTotalMin: number, minutosPorDia: number, jornadaFolgaMin = 0, horaNormal = '') => ({
  horasTotalMin, minutosPorDia, jornadaFolgaMin, horaNormal,
})

describe('gerarObjeto', () => {
  it('T1', () => {
    const c: CamposAcordo = {
      template: 'T1', dataEvento: '2026-06-27', nomeEvento: 'Festa Junina',
      periodoInicio: '08:00', periodoFim: '10:00', datasAjuste: ['2026-06-30', '2026-07-01'],
    }
    expect(gerarObjeto(c, r(120, 60))).toEqual({
      ok: true,
      texto: 'trabalharem no dia 27/06/2026 (Festa Junina), das 08h às 10h, com redução de 01:00h diária no horário normal nos dias 30/06/2026 e 01/07/2026, compensando assim 02 hora(s) laborada(s) no referido evento.',
    })
  })

  it('T2 usa "decreto municipal" quando não há motivo', () => {
    const c: CamposAcordo = {
      template: 'T2', dataEvento: '2026-06-05', nomeEvento: 'Corpus Christi', horaDispensa: '12:00',
      datasAjuste: ['2026-06-08', '2026-06-09', '2026-06-10'],
    }
    expect(gerarObjeto(c, r(180, 60, 0, '15:00'))).toEqual({
      ok: true,
      texto: 'trabalharem normalmente até as 15h no dia 05/06/2026 (Corpus Christi), sendo dispensados às 12h conforme decreto municipal, compensando as 03 hora(s) não laboradas com acréscimo de 01:00h diária no horário normal nos dias 08/06/2026, 09/06/2026 e 10/06/2026.',
    })
  })

  it('T2 usa "em razão de" para motivos de infraestrutura/funcionamento', () => {
    const c: CamposAcordo = {
      template: 'T2', dataEvento: '2026-06-05', nomeEvento: 'Falta de água', horaDispensa: '12:00', motivo: 'falta de água',
      datasAjuste: ['2026-06-08', '2026-06-09', '2026-06-10'],
    }
    const t = gerarObjeto(c, r(180, 60, 0, '15:00'))
    expect(t.ok && t.texto).toContain('sendo dispensados às 12h em razão de falta de água, compensando as 03 hora(s)')
  })

  it('T2 com "em razão de" digitado no motivo não duplica o conector', () => {
    const c: CamposAcordo = {
      template: 'T2', dataEvento: '2026-06-05', nomeEvento: 'Falta de água', horaDispensa: '12:00', motivo: 'em razão de falta de água',
      datasAjuste: ['2026-06-08', '2026-06-09', '2026-06-10'],
    }
    const t = gerarObjeto(c, r(180, 60, 0, '15:00'))
    expect(t.ok && t.texto).toContain('às 12h em razão de falta de água, compensando')
    expect(t.ok && t.texto).not.toContain('conforme')
  })

  it('T3', () => {
    const c: CamposAcordo = {
      template: 'T3', dataFolga: '2026-06-05', motivo: 'ponto facultativo municipal',
      datasAjuste: ['2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11'],
    }
    expect(gerarObjeto(c, r(528, 132))).toEqual({
      ok: true,
      texto: 'serem dispensados do trabalho no dia 05/06/2026 (ponto facultativo municipal), compensando as 08h48min não laboradas com acréscimo de 02:12h diária no horário normal nos dias 08/06/2026, 09/06/2026, 10/06/2026 e 11/06/2026.',
    })
  })

  it('T4 sempre traz o prazo', () => {
    const c: CamposAcordo = {
      template: 'T4', dataFolga: '2026-06-12', motivo: 'ponto facultativo', prazoLimite: '2026-11-30',
      datasAjuste: ['2026-06-08', '2026-06-09'],
    }
    const res = gerarObjeto(c, r(480, 240))
    expect(res).toEqual({
      ok: true,
      texto: 'trabalharem com acréscimo de 04:00h diária no horário normal nos dias 08/06/2026 e 09/06/2026, formando um saldo de 08 hora(s) a ser compensado com a dispensa do trabalho no dia 12/06/2026 (ponto facultativo), com prazo máximo de compensação até 30/11/2026.',
    })
  })

  it('T5 diferencia folga de dia inteiro e parcial', () => {
    const base: CamposAcordo = { template: 'T5', dataEvento: '2026-06-27', nomeEvento: 'Mutirão', dataFolga: '2026-06-29', datasAjuste: [] }
    const cheia = gerarObjeto(base, r(528, 0, 528))
    const parcial = gerarObjeto(base, r(240, 0, 528))
    expect(cheia.ok && cheia.texto).toBe('trabalharem no dia 27/06/2026 (Mutirão), compensando as 08h48min laboradas com a dispensa do trabalho no dia 29/06/2026.')
    expect(parcial.ok && parcial.texto).toBe('trabalharem no dia 27/06/2026 (Mutirão), compensando as 04 hora(s) laboradas com a dispensa de 04 hora(s) do horário de trabalho no dia 29/06/2026.')
  })

  it('acrescenta cláusula de prazo nos templates T1–T3 quando informado', () => {
    const c: CamposAcordo = {
      template: 'T3', dataFolga: '2026-06-26', motivo: 'ponto facultativo', prazoLimite: '2026-12-20',
      datasAjuste: ['2026-06-29', '2026-06-30'],
    }
    const res = gerarObjeto(c, r(480, 240))
    expect(res.ok && res.texto.endsWith(' O prazo máximo para a compensação é 20/12/2026.')).toBe(true)
  })

  it('rejeita campo faltando e colchetes no texto', () => {
    expect(gerarObjeto({ template: 'T3', datasAjuste: [] }, r(0, 0)).ok).toBe(false)
    const c: CamposAcordo = { template: 'T1', dataEvento: '2026-06-27', nomeEvento: 'Festa [X]', datasAjuste: ['2026-06-30'] }
    expect(gerarObjeto(c, r(60, 60))).toEqual({ ok: false, erro: 'O texto gerado contém colchetes ou campo em branco.' })
  })

  it('detecta placeholder e expõe catálogo', () => {
    expect(contemPlaceholder('dia [DATA DO EVENTO]')).toBe(true)
    expect(contemPlaceholder('dia 27/06/2026')).toBe(false)
    expect(Object.keys(TEMPLATES)).toEqual(['T1', 'T2', 'T3', 'T4', 'T5'])
    expect(TEMPLATES.T4.subtipo).toBe('antecipado')
  })

  it('T2 sem horário normal derivado do turno falha', () => {
    const c: CamposAcordo = {
      template: 'T2', dataEvento: '2026-06-05', nomeEvento: 'Emenda', horaDispensa: '12:00', datasAjuste: ['2026-06-08'],
    }
    expect(gerarObjeto(c, r(180, 60)).ok).toBe(false)
  })

  it('T2, T3 e T4 normalizam o motivo', () => {
    const t2: CamposAcordo = {
      template: 'T2', dataEvento: '2026-06-05', nomeEvento: 'Emenda', horaDispensa: '12:00',
      motivo: 'Acordado com a Diretora da Unidade.', datasAjuste: ['2026-06-08'],
    }
    const a = gerarObjeto(t2, r(180, 180, 0, '15:00'))
    expect(a.ok && a.texto).toContain('conforme acordado com a Diretora da Unidade,')
    const t3: CamposAcordo = { template: 'T3', dataFolga: '2026-06-05', motivo: 'Ponto facultativo municipal.', datasAjuste: ['2026-06-08'] }
    const b = gerarObjeto(t3, r(60, 60))
    expect(b.ok && b.texto).toContain('(ponto facultativo municipal)')
    const t4: CamposAcordo = { template: 'T4', dataFolga: '2026-06-12', motivo: 'SMS autorizou;', prazoLimite: '2026-11-30', datasAjuste: ['2026-06-08'] }
    const c4 = gerarObjeto(t4, r(60, 60))
    expect(c4.ok && c4.texto).toContain('(SMS autorizou)')
  })
})

describe('normalizaMotivo', () => {
  it('minúscula na primeira letra, sem pontuação final', () => {
    expect(normalizaMotivo('Acordado com a Diretora da Unidade.')).toBe('acordado com a Diretora da Unidade')
    expect(normalizaMotivo('decreto municipal,')).toBe('decreto municipal')
    expect(normalizaMotivo('  ponto   facultativo  ;: ')).toBe('ponto facultativo')
  })

  it('preserva nomes próprios, siglas e palavras que não estão na lista', () => {
    expect(normalizaMotivo('SMS autorizou')).toBe('SMS autorizou')
    expect(normalizaMotivo('A pedido do prefeito')).toBe('A pedido do prefeito')
    expect(normalizaMotivo('Corpus Christi')).toBe('Corpus Christi')
    expect(normalizaMotivo('Dia do Servidor')).toBe('Dia do Servidor')
  })

  it('minusculiza a 1ª letra só das palavras iniciais conhecidas (ignora acento)', () => {
    expect(normalizaMotivo('Decreto 123/2026')).toBe('decreto 123/2026')
    expect(normalizaMotivo('Autorização da Secretária')).toBe('autorização da Secretária')
    expect(normalizaMotivo('Determinação superior')).toBe('determinação superior')
  })

  it('remove "em razão de" inicial (ignora acento e caixa)', () => {
    expect(normalizaMotivo('em razão de falta de água')).toBe('falta de água')
    expect(normalizaMotivo('Em Razao De obra na unidade.')).toBe('obra na unidade')
  })

  it('remove "conforme" inicial', () => {
    expect(normalizaMotivo('conforme decreto municipal')).toBe('decreto municipal')
    expect(normalizaMotivo('Conforme Decreto municipal.')).toBe('decreto municipal')
  })
})
