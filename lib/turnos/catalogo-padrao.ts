// lib/turnos/catalogo-padrao.ts

export interface TurnoCatalogoItem {
  nome: string
  hora_entrada: string
  hora_inicio_almoco: string | null
  hora_fim_almoco: string | null
  hora_saida_seg_qui: string
  hora_saida_sex: string | null
}

export const CATALOGO_5X2: TurnoCatalogoItem[] = [
  { nome: 'Turno 6h (a)',     hora_entrada: '06:00', hora_inicio_almoco: '12:00', hora_fim_almoco: '13:12', hora_saida_seg_qui: '16:00', hora_saida_sex: '16:00' },
  { nome: 'Turno 6h (b)',     hora_entrada: '06:00', hora_inicio_almoco: '12:30', hora_fim_almoco: '13:30', hora_saida_seg_qui: '16:00', hora_saida_sex: '15:30' },
  { nome: 'Turno 6h (c)',     hora_entrada: '06:00', hora_inicio_almoco: '12:00', hora_fim_almoco: '13:00', hora_saida_seg_qui: '16:00', hora_saida_sex: '15:00' },
  { nome: 'Turno 6h 30m (a)', hora_entrada: '06:30', hora_inicio_almoco: '12:00', hora_fim_almoco: '13:00', hora_saida_seg_qui: '16:18', hora_saida_sex: '16:18' },
  { nome: 'Turno 6h 30m (b)', hora_entrada: '06:30', hora_inicio_almoco: '13:00', hora_fim_almoco: '14:00', hora_saida_seg_qui: '16:18', hora_saida_sex: '16:18' },
  { nome: 'Turno 6h 30m (c)', hora_entrada: '06:30', hora_inicio_almoco: '12:30', hora_fim_almoco: '13:30', hora_saida_seg_qui: '16:18', hora_saida_sex: '16:18' },
  { nome: 'Turno 6h 30m (d)', hora_entrada: '06:30', hora_inicio_almoco: '11:30', hora_fim_almoco: '13:00', hora_saida_seg_qui: '16:30', hora_saida_sex: '15:30' },
  { nome: 'Turno 6h 30m (e)', hora_entrada: '06:30', hora_inicio_almoco: '12:00', hora_fim_almoco: '13:00', hora_saida_seg_qui: '16:30', hora_saida_sex: '15:30' },
  { nome: 'Turno 6h 30m (f)', hora_entrada: '06:30', hora_inicio_almoco: '10:30', hora_fim_almoco: '11:30', hora_saida_seg_qui: '16:30', hora_saida_sex: '15:30' },
  { nome: 'Turno 6h 30m (g)', hora_entrada: '06:30', hora_inicio_almoco: '12:00', hora_fim_almoco: '13:12', hora_saida_seg_qui: '16:30', hora_saida_sex: '16:30' },
  { nome: 'Turno 6h 30m (h)', hora_entrada: '06:30', hora_inicio_almoco: '11:30', hora_fim_almoco: '13:12', hora_saida_seg_qui: '17:00', hora_saida_sex: '17:00' },
  { nome: 'Turno 6h 30m (i)', hora_entrada: '06:30', hora_inicio_almoco: '10:30', hora_fim_almoco: '11:42', hora_saida_seg_qui: '16:30', hora_saida_sex: '16:30' },
  { nome: 'Turno 6h 30m (j)', hora_entrada: '06:30', hora_inicio_almoco: '12:30', hora_fim_almoco: '13:42', hora_saida_seg_qui: '16:30', hora_saida_sex: '16:30' },
  { nome: 'Turno 6h 30m (k)', hora_entrada: '06:30', hora_inicio_almoco: '12:30', hora_fim_almoco: '13:30', hora_saida_seg_qui: '16:30', hora_saida_sex: '15:30' },
  { nome: 'Turno 6h 30m (l)', hora_entrada: '06:30', hora_inicio_almoco: '13:00', hora_fim_almoco: '14:00', hora_saida_seg_qui: '16:30', hora_saida_sex: '15:30' },
  { nome: 'Turno 6h 30m (m)', hora_entrada: '06:30', hora_inicio_almoco: '13:00', hora_fim_almoco: '14:12', hora_saida_seg_qui: '16:30', hora_saida_sex: '16:30' },
  { nome: 'Turno 6h 30m (n)', hora_entrada: '06:30', hora_inicio_almoco: '11:20', hora_fim_almoco: '12:20', hora_saida_seg_qui: '16:18', hora_saida_sex: '16:18' },
  { nome: 'Turno 6h 30m (o)', hora_entrada: '06:30', hora_inicio_almoco: '10:20', hora_fim_almoco: '11:20', hora_saida_seg_qui: '16:18', hora_saida_sex: '16:18' },
  { nome: 'Turno 7h (a)',     hora_entrada: '07:00', hora_inicio_almoco: '12:00', hora_fim_almoco: '13:00', hora_saida_seg_qui: '17:00', hora_saida_sex: '16:00' },
  { nome: 'Turno 7h (b)',     hora_entrada: '07:00', hora_inicio_almoco: '13:00', hora_fim_almoco: '14:00', hora_saida_seg_qui: '17:00', hora_saida_sex: '16:00' },
  { nome: 'Turno 7h (c)',     hora_entrada: '07:00', hora_inicio_almoco: '12:00', hora_fim_almoco: '13:12', hora_saida_seg_qui: '17:00', hora_saida_sex: '17:00' },
  { nome: 'Turno 7h (d)',     hora_entrada: '07:00', hora_inicio_almoco: '13:00', hora_fim_almoco: '14:12', hora_saida_seg_qui: '17:00', hora_saida_sex: '17:00' },
  { nome: 'Turno 7h (e)',     hora_entrada: '07:00', hora_inicio_almoco: '11:48', hora_fim_almoco: '13:00', hora_saida_seg_qui: '17:00', hora_saida_sex: '17:00' },
  { nome: 'Turno 7h (f)',     hora_entrada: '07:00', hora_inicio_almoco: '10:30', hora_fim_almoco: '11:30', hora_saida_seg_qui: '17:00', hora_saida_sex: '16:00' },
  { nome: 'Turno 7h (g)',     hora_entrada: '07:00', hora_inicio_almoco: '13:00', hora_fim_almoco: '14:00', hora_saida_seg_qui: '18:00', hora_saida_sex: '17:00' },
  { nome: 'Turno 7h (h)',     hora_entrada: '07:00', hora_inicio_almoco: '11:00', hora_fim_almoco: '12:12', hora_saida_seg_qui: '17:00', hora_saida_sex: '17:00' },
  { nome: 'Turno 7h (i)',     hora_entrada: '07:00', hora_inicio_almoco: '12:30', hora_fim_almoco: '14:30', hora_saida_seg_qui: '18:00', hora_saida_sex: '17:00' },
  { nome: 'Turno 7h (j)',     hora_entrada: '07:00', hora_inicio_almoco: '12:30', hora_fim_almoco: '13:42', hora_saida_seg_qui: '17:00', hora_saida_sex: '17:00' },
  { nome: 'Turno 7h (k)',     hora_entrada: '07:00', hora_inicio_almoco: '12:30', hora_fim_almoco: '13:30', hora_saida_seg_qui: '17:30', hora_saida_sex: '16:30' },
  { nome: 'Turno 7h (l)',     hora_entrada: '07:00', hora_inicio_almoco: '12:00', hora_fim_almoco: '13:00', hora_saida_seg_qui: '16:48', hora_saida_sex: '16:48' },
  { nome: 'Turno 7h 12m (a)', hora_entrada: '07:12', hora_inicio_almoco: '12:00', hora_fim_almoco: '13:00', hora_saida_seg_qui: '17:00', hora_saida_sex: '17:00' },
  { nome: 'Turno 7h 12m (b)', hora_entrada: '07:12', hora_inicio_almoco: '13:00', hora_fim_almoco: '14:00', hora_saida_seg_qui: '17:00', hora_saida_sex: '17:00' },
  { nome: 'Turno 7h 12m (c)', hora_entrada: '07:12', hora_inicio_almoco: '12:30', hora_fim_almoco: '13:30', hora_saida_seg_qui: '17:00', hora_saida_sex: '17:00' },
  { nome: 'Turno 7h 30m (a)', hora_entrada: '07:30', hora_inicio_almoco: '11:48', hora_fim_almoco: '13:00', hora_saida_seg_qui: '17:30', hora_saida_sex: '17:30' },
  { nome: 'Turno 7h 30m (b)', hora_entrada: '07:30', hora_inicio_almoco: '13:00', hora_fim_almoco: '14:00', hora_saida_seg_qui: '17:30', hora_saida_sex: '17:00' },
  { nome: 'Turno 7h 30m (c)', hora_entrada: '07:30', hora_inicio_almoco: '13:00', hora_fim_almoco: '14:00', hora_saida_seg_qui: '17:30', hora_saida_sex: '16:30' },
  { nome: 'Turno 7h 30m (d)', hora_entrada: '07:30', hora_inicio_almoco: '12:00', hora_fim_almoco: '13:12', hora_saida_seg_qui: '17:30', hora_saida_sex: '17:30' },
  { nome: 'Turno 7h 30m (e)', hora_entrada: '07:30', hora_inicio_almoco: '12:30', hora_fim_almoco: '13:30', hora_saida_seg_qui: '17:48', hora_saida_sex: '17:48' },
  { nome: 'Turno 7h 30m (f)', hora_entrada: '07:30', hora_inicio_almoco: '12:30', hora_fim_almoco: '13:30', hora_saida_seg_qui: '17:30', hora_saida_sex: '17:30' },
  { nome: 'Turno 7h 30m (g)', hora_entrada: '07:30', hora_inicio_almoco: '12:00', hora_fim_almoco: '13:00', hora_saida_seg_qui: '17:00', hora_saida_sex: '17:00' },
  { nome: 'Turno 7h 45m (a)', hora_entrada: '07:45', hora_inicio_almoco: '11:48', hora_fim_almoco: '13:00', hora_saida_seg_qui: '17:45', hora_saida_sex: '17:45' },
  { nome: 'Turno 8h (a)',     hora_entrada: '08:00', hora_inicio_almoco: '11:00', hora_fim_almoco: '12:00', hora_saida_seg_qui: '18:00', hora_saida_sex: '18:00' },
  { nome: 'Turno 8h (b)',     hora_entrada: '08:00', hora_inicio_almoco: '12:15', hora_fim_almoco: '13:15', hora_saida_seg_qui: '18:00', hora_saida_sex: '17:00' },
  { nome: 'Turno 8h (c)',     hora_entrada: '08:00', hora_inicio_almoco: '12:30', hora_fim_almoco: '13:30', hora_saida_seg_qui: '18:00', hora_saida_sex: '18:00' },
  { nome: 'Turno 8h (d)',     hora_entrada: '08:00', hora_inicio_almoco: '12:00', hora_fim_almoco: '13:00', hora_saida_seg_qui: '18:00', hora_saida_sex: '17:00' },
  { nome: 'Turno 8h (e)',     hora_entrada: '08:00', hora_inicio_almoco: '13:00', hora_fim_almoco: '14:00', hora_saida_seg_qui: '18:00', hora_saida_sex: '17:00' },
  { nome: 'Turno 8h (f)',     hora_entrada: '08:00', hora_inicio_almoco: '13:12', hora_fim_almoco: '14:24', hora_saida_seg_qui: '18:00', hora_saida_sex: '18:00' },
  { nome: 'Turno 8h (g)',     hora_entrada: '08:00', hora_inicio_almoco: '12:00', hora_fim_almoco: '13:12', hora_saida_seg_qui: '18:00', hora_saida_sex: '18:00' },
  { nome: 'Turno 8h (h)',     hora_entrada: '08:00', hora_inicio_almoco: '13:00', hora_fim_almoco: '14:12', hora_saida_seg_qui: '18:00', hora_saida_sex: '18:00' },
  { nome: 'Turno 8h (i)',     hora_entrada: '08:00', hora_inicio_almoco: '13:30', hora_fim_almoco: '14:30', hora_saida_seg_qui: '18:00', hora_saida_sex: '17:00' },
  { nome: 'Turno 8h (j)',     hora_entrada: '08:00', hora_inicio_almoco: '13:00', hora_fim_almoco: '14:00', hora_saida_seg_qui: '17:48', hora_saida_sex: '17:48' },
  { nome: 'Turno 8h 12m (a)', hora_entrada: '08:12', hora_inicio_almoco: '14:00', hora_fim_almoco: '15:00', hora_saida_seg_qui: '18:00', hora_saida_sex: '18:00' },
  { nome: 'Turno 8h 12m (b)', hora_entrada: '08:12', hora_inicio_almoco: '13:00', hora_fim_almoco: '14:00', hora_saida_seg_qui: '18:00', hora_saida_sex: '18:00' },
  { nome: 'Turno 9h 12m (a)', hora_entrada: '09:12', hora_inicio_almoco: '13:00', hora_fim_almoco: '14:00', hora_saida_seg_qui: '19:00', hora_saida_sex: '19:00' },
  { nome: 'Turno 9h 12m (b)', hora_entrada: '09:12', hora_inicio_almoco: '14:00', hora_fim_almoco: '15:00', hora_saida_seg_qui: '19:00', hora_saida_sex: '19:00' },
]

export const CATALOGO_5X1: TurnoCatalogoItem[] = [
  { nome: 'Turno 6h (a)',     hora_entrada: '06:00', hora_inicio_almoco: '12:00', hora_fim_almoco: '13:00', hora_saida_seg_qui: '14:20', hora_saida_sex: null },
  { nome: 'Turno 6h (b)',     hora_entrada: '06:00', hora_inicio_almoco: '11:00', hora_fim_almoco: '12:00', hora_saida_seg_qui: '14:20', hora_saida_sex: null },
  { nome: 'Turno 9h 40m (a)', hora_entrada: '09:40', hora_inicio_almoco: '13:00', hora_fim_almoco: '14:00', hora_saida_seg_qui: '18:00', hora_saida_sex: null },
  { nome: 'Turno 9h 40m (b)', hora_entrada: '09:40', hora_inicio_almoco: '12:00', hora_fim_almoco: '13:00', hora_saida_seg_qui: '18:00', hora_saida_sex: null },
  { nome: 'Turno 13h 40m',    hora_entrada: '13:40', hora_inicio_almoco: '18:00', hora_fim_almoco: '19:00', hora_saida_seg_qui: '22:00', hora_saida_sex: null },
  { nome: 'Turno 14h 40m',    hora_entrada: '14:40', hora_inicio_almoco: '19:00', hora_fim_almoco: '20:00', hora_saida_seg_qui: '23:00', hora_saida_sex: null },
]

/** Catálogo de turnos-padrão por regime. Só existe para 5x2 e 5x1 — 12x36 e jovem_aprendiz continuam com preenchimento livre. */
export const CATALOGO_POR_REGIME: Partial<Record<string, TurnoCatalogoItem[]>> = {
  '5x2': CATALOGO_5X2,
  '5x1': CATALOGO_5X1,
}
