import { describe, expect, it } from 'vitest'
import { planejarSincronizacao, type MovExistente, type MovNovo } from './sincronizar'

const ex = (id: string, data: string, minutos: number, papel = 'origem', status = 'previsto', func = 'a'): MovExistente =>
  ({ id, funcionario_id: func, data, minutos, papel, status })
const nv = (data: string, minutos: number, papel: 'origem' | 'quitacao' = 'origem', func = 'a'): MovNovo =>
  ({ funcionario_id: func, data, minutos, papel })

describe('planejarSincronizacao', () => {
  it('sem mudança: nada a fazer', () => {
    const p = planejarSincronizacao([ex('1', '2026-10-04', 528)], [nv('2026-10-04', 528)])
    expect(p).toEqual({ apagar: [], atualizar: [], inserir: [], travados: [] })
  })

  it('data trocada: apaga a antiga e insere a nova (previstos)', () => {
    const p = planejarSincronizacao([ex('1', '2026-12-28', -528, 'quitacao')], [nv('2026-12-29', -528, 'quitacao')])
    expect(p.apagar).toEqual(['1'])
    expect(p.inserir).toEqual([nv('2026-12-29', -528, 'quitacao')])
    expect(p.travados).toEqual([])
  })

  it('minutos diferentes no mesmo dia: atualiza; funcionário novo: insere; removido: apaga', () => {
    const p = planejarSincronizacao(
      [ex('1', '2026-10-04', 240), ex('2', '2026-10-04', 240, 'origem', 'previsto', 'b')],
      [nv('2026-10-04', 480), nv('2026-10-04', 240, 'origem', 'c')],
    )
    expect(p.atualizar).toEqual([{ id: '1', minutos: 480 }])
    expect(p.apagar).toEqual(['2'])
    expect(p.inserir).toEqual([nv('2026-10-04', 240, 'origem', 'c')])
  })

  it('movimento já cumprido que seria apagado ou alterado trava a edição', () => {
    const p = planejarSincronizacao(
      [ex('1', '2026-12-28', -528, 'quitacao', 'cumprido'), ex('2', '2026-12-29', -528, 'quitacao', 'nao_cumprido')],
      [nv('2026-12-29', -300, 'quitacao')],
    )
    expect(p.travados).toEqual(['2026-12-28 (cumprido)', '2026-12-29 (nao_cumprido)'])
    expect(p.apagar).toEqual([])
  })

  it('movimento cumprido que continua igual não trava', () => {
    const p = planejarSincronizacao([ex('1', '2026-12-28', -528, 'quitacao', 'cumprido')], [nv('2026-12-28', -528, 'quitacao')])
    expect(p.travados).toEqual([])
  })
})
