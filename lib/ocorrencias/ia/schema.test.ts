import { describe, it, expect } from 'vitest'
import { lerAnalise, lerRetorno, CATEGORIAS, URGENCIAS } from './schema'

const valida = {
  categoria: 'saude',
  urgencia: 'alta',
  resumo: 'Colaboradora teve três crises em nove dias.',
  resolucao_sugerida: ['Contatar familiar', 'Agendar consulta no ambulatório'],
  encaminhar_rh: true,
  motivo_rh: 'Recorrência de episódios de saúde.',
  devolutiva_supervisor: 'Obrigado pelo registro. Vamos acompanhar.',
  email_rh: 'Solicito orientação sobre o acompanhamento.',
  alertas: ['Cita dado de saúde'],
}

describe('lerAnalise', () => {
  it('aceita uma análise válida', () => {
    const r = lerAnalise(valida)
    expect(r).not.toBeNull()
    expect(r?.categoria).toBe('saude')
    expect(r?.encaminhar_rh).toBe(true)
    expect(r?.resolucao_sugerida).toHaveLength(2)
  })

  it('recusa quando não é objeto', () => {
    expect(lerAnalise(null)).toBeNull()
    expect(lerAnalise('x')).toBeNull()
    expect(lerAnalise([])).toBeNull()
  })

  it('recusa categoria ou urgência fora da lista', () => {
    expect(lerAnalise({ ...valida, categoria: 'juridico' })).toBeNull()
    expect(lerAnalise({ ...valida, urgencia: 'urgentissima' })).toBeNull()
  })

  it('recusa resumo vazio', () => {
    expect(lerAnalise({ ...valida, resumo: '   ' })).toBeNull()
  })

  it('limita tamanhos e quantidade de itens', () => {
    const r = lerAnalise({
      ...valida,
      resumo: 'a'.repeat(5000),
      resolucao_sugerida: Array.from({ length: 20 }, (_, i) => `passo ${i}`),
      alertas: Array.from({ length: 20 }, (_, i) => `alerta ${i}`),
    })
    expect(r?.resumo.length).toBe(1500)
    expect(r?.resolucao_sugerida).toHaveLength(8)
    expect(r?.alertas).toHaveLength(6)
  })

  it('ignora itens que não são texto nas listas', () => {
    const r = lerAnalise({ ...valida, resolucao_sugerida: ['ok', 3, null, { a: 1 }, '  '] })
    expect(r?.resolucao_sugerida).toEqual(['ok'])
  })

  it('zera email_rh e motivo quando não é para encaminhar', () => {
    const r = lerAnalise({ ...valida, encaminhar_rh: false, email_rh: 'texto que não deveria ficar', motivo_rh: '' })
    expect(r?.encaminhar_rh).toBe(false)
    expect(r?.email_rh).toBe('')
    expect(r?.motivo_rh).toBeNull()
  })

  it('só considera encaminhar_rh verdadeiro quando é exatamente true', () => {
    expect(lerAnalise({ ...valida, encaminhar_rh: 'true' })?.encaminhar_rh).toBe(false)
  })

  it('as listas de categorias e urgências são as combinadas', () => {
    expect([...CATEGORIAS]).toEqual(['saude', 'conduta', 'desempenho', 'seguranca', 'relacionamento', 'outro'])
    expect([...URGENCIAS]).toEqual(['baixa', 'media', 'alta'])
  })
})

describe('lerRetorno', () => {
  it('aceita devolutiva com pontos de atenção', () => {
    const r = lerRetorno({ devolutiva_supervisor: 'Segue a orientação do RH.', pontos_de_atencao: ['Guardar registro'] })
    expect(r?.devolutiva_supervisor).toBe('Segue a orientação do RH.')
    expect(r?.pontos_de_atencao).toEqual(['Guardar registro'])
  })

  it('recusa devolutiva vazia ou entrada inválida', () => {
    expect(lerRetorno({ devolutiva_supervisor: '  ', pontos_de_atencao: [] })).toBeNull()
    expect(lerRetorno(null)).toBeNull()
  })
})
