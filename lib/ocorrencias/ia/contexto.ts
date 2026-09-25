// Monta a mensagem que vai à API. Recebe CAMPOS EXPLÍCITOS (nunca um registro inteiro de funcionário):
// nome, RE, CPF, posto, salário, PCD, CID etc. não têm por onde entrar.

export type DadosContexto = {
  funcao: string | null
  dataOcorrencia: string | null // AAAA-MM-DD
  gravidade: string | null // já com rótulo
  textoAnonimo: string
  historico: { advertencias: number; diasAtestado12m: number; faltas: number }
}

function fmtData(iso: string | null): string {
  if (!iso) return 'não informada'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

export function montarContexto(d: DadosContexto): string {
  return [
    'Ocorrência registrada por um supervisor.',
    `Função do colaborador: ${d.funcao ?? 'não informada'}`,
    `Data: ${fmtData(d.dataOcorrencia)}`,
    `Gravidade informada: ${d.gravidade ?? 'não informada'}`,
    `Histórico resumido: ${d.historico.advertencias} advertência(s), ${d.historico.diasAtestado12m} dia(s) de atestado nos últimos 12 meses, ${d.historico.faltas} falta(s).`,
    '',
    'Relato do supervisor:',
    d.textoAnonimo,
  ].join('\n')
}

export function montarContextoRetorno(p: { contexto: string; respostaRhAnonima: string }): string {
  return [p.contexto, '', 'Resposta do RH:', p.respostaRhAnonima].join('\n')
}
