import { describe, it, expect } from 'vitest'
import { formatarResumoTurno, temSextaDistinta } from './escala'

describe('formatarResumoTurno — regime 6x1 com sexta e sábado próprios (CRESCER CENTRO)', () => {
  const tarde = {
    tipo_escala: '5x1', hora_entrada: '13:00:00', hora_saida_seg_qui: '22:00:00', hora_saida_sex: '17:00:00',
    hora_inicio_almoco: '18:00:00', hora_fim_almoco: '19:00:00',
    hora_entrada_sex: '09:00:00', hora_inicio_almoco_sex: '12:00:00', hora_fim_almoco_sex: '13:00:00',
    hora_entrada_sabado: '12:00:00', hora_saida_sabado: '17:00:00',
    hora_inicio_almoco_sabado: null, hora_fim_almoco_sabado: null,
  }

  it('mostra entrada, saída e pausa da sexta e o sábado', () => {
    expect(formatarResumoTurno(tarde)).toBe(
      'Seg–Qui 13:00–22:00 (almoço 18:00–19:00) · Sex 09:00–17:00 (almoço 12:00–13:00) · Sáb 12:00–17:00',
    )
  })

  it('sem a entrada de sexta na consulta o texto sai errado (Sex 13:00–17:00) — por isso as consultas precisam trazer os campos', () => {
    const { hora_entrada_sex: _e, hora_inicio_almoco_sex: _i, hora_fim_almoco_sex: _f, ...semCampos } = tarde
    void _e; void _i; void _f
    expect(formatarResumoTurno(semCampos)).toContain('Sex 13:00–17:00')
  })

  it('só a pausa própria já conta como sexta distinta', () => {
    expect(temSextaDistinta({ hora_entrada_sex: null, hora_saida_sex: null, hora_inicio_almoco_sex: '12:00', hora_fim_almoco_sex: '13:00' })).toBe(true)
    expect(temSextaDistinta({ hora_entrada_sex: null, hora_saida_sex: null })).toBe(false)
  })
})
