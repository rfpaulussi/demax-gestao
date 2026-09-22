import type { ClassificacaoLegado } from './legado'

export interface CasoLegado {
  /** id real em `acordos_compensacao` (texto lido ao vivo, não copiado aqui — evita duplicar dado sensível). */
  id: string
  titulo: string
  /** Só os campos que o caso testa; o resto fica livre. */
  esperado: Partial<Pick<ClassificacaoLegado, 'situacao' | 'direcao_texto' | 'trabalhou_a_mais' | 'tem_campos_em_branco'>>
  /** Por que o caso é difícil, quando for. */
  nota?: string
}

/**
 * Amostra de 19 acordos REAIS (emitidos antes do novo fluxo), escolhidos para cobrir T1–T5, textos com
 * campos em branco, textos ambíguos e um caso já visto classificado errado em produção (regressão).
 * `esperado` foi definido por leitura humana do texto, não pela IA — serve para travar o prompt contra
 * piora. Rodar em "4. Teste de regressão" no laboratório sempre que o prompt de classificação mudar.
 */
export const CASOS_LEGADO: CasoLegado[] = [
  {
    id: 'dba06d9c-32ec-4840-995e-28b6dea1fb9e', titulo: 'Festa Cultural (17/09)',
    esperado: { direcao_texto: 'reposicao', trabalhou_a_mais: true, tem_campos_em_branco: true },
    nota: 'Trabalharam no evento e o texto manda repor com ACRÉSCIMO (deveria ser redução/folga) — candidato real a inversão.',
  },
  {
    id: '42afaab7-275c-4aed-bb55-b7003b8e188a', titulo: 'Eleição (14/09)',
    esperado: { situacao: 'T5', direcao_texto: 'descanso', trabalhou_a_mais: true, tem_campos_em_branco: false },
  },
  {
    id: '5693a3bf-7f98-4e12-bde3-ec6b9d692376', titulo: 'Compensação do dia 31/08/26',
    esperado: { direcao_texto: 'reposicao', trabalhou_a_mais: false, tem_campos_em_branco: false },
    nota: 'Não trabalharam em 31/08 e repõem em 12/09 — falso positivo de inversão corrigido nesta rodada. O texto não diz por que não trabalharam (emenda? folga?), então não força situacao — só a direção importa para o alerta de inversão.',
  },
  {
    id: '13c19318-a4e3-4bf2-bab9-638285cf77c0', titulo: 'RUA +MAIS FELIZ',
    esperado: { situacao: 'T4', direcao_texto: 'reposicao', trabalhou_a_mais: true, tem_campos_em_branco: false },
    nota: 'Banco de horas legítimo: acréscimo em 15/08 (ANTES) para a emenda de 31/08 (DEPOIS). Não é inversão. Fácil de confundir com T3 pela palavra "emenda".',
  },
  {
    id: '1ed9f9db-5756-48a7-93a5-426a11c253b4', titulo: 'Aniversário EM Antônio Nacif',
    esperado: { situacao: 'T1', direcao_texto: 'descanso', trabalhou_a_mais: true, tem_campos_em_branco: false },
  },
  {
    id: '64798436-315c-4543-9d25-7937252b5b74', titulo: 'Jogo da copa (13/07)',
    esperado: { situacao: 'T2', direcao_texto: 'reposicao', trabalhou_a_mais: false, tem_campos_em_branco: true },
  },
  {
    id: '918cb382-16a3-480a-ad40-04fe2a09808a', titulo: 'Jogo da Copa - Saída antecipada (01/07)',
    esperado: { situacao: 'T2', direcao_texto: 'reposicao', trabalhou_a_mais: false, tem_campos_em_branco: false },
  },
  {
    id: '90130216-fedd-432e-a418-4649f65c8a48', titulo: 'JOGO DO BRASIL (22/06) #1',
    esperado: { situacao: 'T2', direcao_texto: 'reposicao', trabalhou_a_mais: false, tem_campos_em_branco: false },
  },
  {
    id: '905d9a3f-4d4d-4eb8-bc08-30fdf68289df', titulo: 'JOGO DO BRASIL (22/06) #2',
    esperado: { situacao: 'T2', direcao_texto: 'reposicao', trabalhou_a_mais: false, tem_campos_em_branco: false },
    nota: 'Regressão: já foi visto classificado como T3 em produção. "trabalharam até as 12h" é T2 (trabalharam parte do dia), não T3 (não trabalharam nada).',
  },
  {
    id: 'aca3090b-6aa1-4afb-ab86-58a262fd4cd1', titulo: 'JOGO DO BRASIL (22/06) #3',
    esperado: { situacao: 'T2', direcao_texto: 'reposicao', trabalhou_a_mais: false, tem_campos_em_branco: false },
  },
  {
    id: 'd834d853-af25-4e58-9653-770f0e2c5165', titulo: 'Festa Junina (01/06) #1',
    esperado: { situacao: 'T5', direcao_texto: 'descanso', trabalhou_a_mais: true },
    nota: 'Texto ambíguo (duas datas: "trabalharam em 20/06 ... em compensação do dia 05/06"); leitura mais provável é trabalharam no evento e 05/06 é o dia de folga concedido.',
  },
  {
    id: '4d47266f-9292-47b7-83ee-67dc6bed1bc2', titulo: 'FESTA JUNINA (01/06) #2',
    esperado: { situacao: 'T5' },
    nota: 'Mesma ambiguidade do caso #1, redigida por outra pessoa ("trabalhei", 1ª pessoa) — o modelo não leu igual às duas vezes; '
      + 'só o rótulo da situação é checado, a direção fica de fora por genuína ambiguidade do texto original.',
  },
  {
    id: '0e7524e4-338b-4552-8e98-467959eb8771', titulo: 'Festa Junina (01/06) #3',
    esperado: { situacao: null },
    nota: 'Texto terso demais ("Compensação do dia 05/06, 8h laboradas") para saber a direção — a IA não deve forçar um rótulo.',
  },
  {
    id: '90575297-5e43-467a-8693-8cf7d450a84e', titulo: 'Festa junina - 20/06',
    esperado: { situacao: 'T5', direcao_texto: 'descanso', trabalhou_a_mais: true, tem_campos_em_branco: false },
    nota: 'O texto tem "20/06/2016" (ano errado, é 2026) — erro de digitação do original, não do sistema.',
  },
  {
    id: '4bae2ca8-c761-4651-8b8f-953814c9691f', titulo: 'Festa Junina - 04/07',
    esperado: { situacao: 'T5', direcao_texto: 'descanso', trabalhou_a_mais: true, tem_campos_em_branco: false },
  },
  {
    id: '16822432-f80f-4536-ac02-36015387aca6', titulo: 'Reforma UBS',
    esperado: { situacao: 'T5', direcao_texto: 'descanso', trabalhou_a_mais: true, tem_campos_em_branco: false },
  },
  {
    id: 'b7a49b26-964a-4af0-b25b-58c42671e404', titulo: 'Feriado 01/09 e 07/09',
    esperado: { situacao: 'T5', direcao_texto: 'descanso', trabalhou_a_mais: true, tem_campos_em_branco: false },
  },
  {
    id: '669e4dfa-ffd8-4bb5-b5c7-4739d90fc475', titulo: 'Festa Família / Folga (revezamento)',
    esperado: { situacao: 'T5', direcao_texto: 'descanso', trabalhou_a_mais: true, tem_campos_em_branco: false },
  },
  {
    id: '60f3bf5f-1eb8-4496-abad-5762837c4b04', titulo: 'TRABALHAR NO SÁBADO CAIC',
    esperado: { tem_campos_em_branco: false },
    nota: 'Texto genuinamente ambíguo (a leitura mais provável mudou entre duas rodadas de teste, inclusive para mim): '
      + '"redução de 1h nos dias 04-07/08... compensando as 4h não laboradas no dia 15/08" pode ser lido como '
      + 'redução-antes-do-sábado-trabalhado OU sábado-repõe-a-redução-anterior. Só checa o fato objetivo (sem colchetes).',
  },
]

export interface ConferenciaLegado {
  campo: string
  esperado: string
  obtido: string
  ok: boolean
}

const fmt = (v: unknown): string => (v === null || v === undefined ? '—' : String(v))

export function conferirLegado(caso: CasoLegado, obtido: ClassificacaoLegado): { ok: boolean; campos: ConferenciaLegado[] } {
  const campos: ConferenciaLegado[] = []
  for (const [campo, esperado] of Object.entries(caso.esperado)) {
    const valor = (obtido as unknown as Record<string, unknown>)[campo]
    campos.push({ campo, esperado: fmt(esperado), obtido: fmt(valor), ok: valor === esperado })
  }
  return { ok: campos.every(c => c.ok), campos }
}
