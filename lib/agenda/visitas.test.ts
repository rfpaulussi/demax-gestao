import { describe, it, expect } from 'vitest'
import { piorStatus, montarVisitas, type CheckinRaw, type PostoGeo, type BlocoPlan } from './visitas'

describe('piorStatus', () => {
  it('falta é o pior status; agendado, o melhor', () => {
    expect(piorStatus(['ok', 'falta'])).toBe('falta')
    expect(piorStatus(['ok', 'agendado'])).toBe('ok')
    expect(piorStatus(['sem_foto', 'alerta'])).toBe('sem_foto')
    expect(piorStatus(['reposta', 'ok'])).toBe('ok')
  })

  it('lista vazia devolve null', () => {
    expect(piorStatus([])).toBeNull()
  })
})

describe('motivo_extra propaga pra VisitaView', () => {
  it('visita extra carrega o motivo e a observação informados no check-in', () => {
    const postos = new Map<string, PostoGeo>([
      ['p1', { id: 'p1', nome: 'Posto 1', latitude: -23.5, longitude: -46.6, raio_m: 150 }],
    ])
    const checkins: CheckinRaw[] = [{
      id: 'c1', supervisor_id: 's1', posto_id: 'p1', tipo: 'entrada',
      latitude: -23.5, longitude: -46.6, precisao_m: 10, distancia_m: 5, dentro_raio: true, baixa_precisao: false,
      justificativa: null, created_at: '2026-11-03T12:00:00-03:00',
      motivo_extra: 'emergencia', atividade_obs: 'Cobri o colega',
    }]
    const { visitas } = montarVisitas({ planos: [], checkins, postos, hoje: '2026-11-06', publicada: true })
    expect(visitas).toHaveLength(1)
    expect(visitas[0].status).toBe('extra')
    expect(visitas[0].motivo_extra).toBe('emergencia')
    expect(visitas[0].atividade_obs).toBe('Cobri o colega')
  })

  it('reposição (falta cobrida por visita extra) preserva motivo_extra e atividade_obs da visita extra', () => {
    const postos = new Map<string, PostoGeo>([
      ['p1', { id: 'p1', nome: 'Posto 1', latitude: -23.5, longitude: -46.6, raio_m: 150 }],
    ])
    const planos: BlocoPlan[] = [
      { data: '2026-11-02', periodo: 'manha', foco: 'Varrição', posto_id: 'p1' },
    ]
    const checkins: CheckinRaw[] = [{
      id: 'c1', supervisor_id: 's1', posto_id: 'p1', tipo: 'entrada',
      latitude: -23.5, longitude: -46.6, precisao_m: 10, distancia_m: 5, dentro_raio: true, baixa_precisao: false,
      justificativa: null, created_at: '2026-11-03T12:00:00-03:00',
      motivo_extra: 'outro', atividade_obs: 'Troquei com o colega do posto vizinho',
    }]
    const { visitas } = montarVisitas({ planos, checkins, postos, hoje: '2026-11-06', publicada: true })
    expect(visitas).toHaveLength(1)
    expect(visitas[0].status).toBe('reposta')
    expect(visitas[0].motivo_extra).toBe('outro')
    expect(visitas[0].atividade_obs).toBe('Troquei com o colega do posto vizinho')
  })

  it('reposição limpa motivo_falta/motivo_texto herdados do "Fechar o dia", já que a visita acabou acontecendo', () => {
    const postos = new Map<string, PostoGeo>([
      ['p1', { id: 'p1', nome: 'Posto 1', latitude: -23.5, longitude: -46.6, raio_m: 150 }],
    ])
    const planos: BlocoPlan[] = [
      { data: '2026-11-02', periodo: 'manha', foco: 'Varrição', posto_id: 'p1' },
    ]
    const checkins: CheckinRaw[] = [{
      id: 'c1', supervisor_id: 's1', posto_id: 'p1', tipo: 'entrada',
      latitude: -23.5, longitude: -46.6, precisao_m: 10, distancia_m: 5, dentro_raio: true, baixa_precisao: false,
      justificativa: null, created_at: '2026-11-03T12:00:00-03:00',
      motivo_extra: 'outro', atividade_obs: 'Troquei com o colega do posto vizinho',
    }]
    const justificativas = new Map([['2026-11-02|p1', { tipo: 'atestado', texto: 'Atestado médico' }]])
    const { visitas } = montarVisitas({ planos, checkins, postos, hoje: '2026-11-06', publicada: true, justificativas })
    expect(visitas).toHaveLength(1)
    expect(visitas[0].status).toBe('reposta')
    expect(visitas[0].motivo_falta).toBeNull()
    expect(visitas[0].motivo_texto).toBeNull()
  })
})
