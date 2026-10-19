export type LadoAguardando = 'gestao' | 'supervisor'

// origem: 'registro' = ninguém escreveu ainda (espera desde o registro); 'mensagem' = o outro lado respondeu.
export type EstadoAguardando = { lado: LadoAguardando; desde: string; origem: 'registro' | 'mensagem' }

// De que lado está a bola numa ocorrência aberta.
// - sem mensagem: aguardando a gestão, desde o registro;
// - última mensagem do supervisor: aguardando a gestão; de qualquer outro papel: aguardando o supervisor;
// - última mensagem marcada "só informar" (requerResposta === false): ninguém deve nada a ninguém;
// - "ciente" da gestão: se a bola está com a gestão e a ciência é posterior à espera, não há pendência
//   (volta a pendente quando o supervisor escrever de novo).
// Só conta mensagem de verdade; nota interna e parecer não entram.
export function calcularAguardando(p: {
  ultimaMensagem: { autorRole: string | null; criadaEm: string; requerResposta?: boolean } | null
  ocorrenciaCriadaEm: string
  cienciaGestaoEm: string | null
}): EstadoAguardando | null {
  const { ultimaMensagem, ocorrenciaCriadaEm, cienciaGestaoEm } = p
  if (ultimaMensagem && ultimaMensagem.requerResposta === false) return null

  const lado: LadoAguardando = ultimaMensagem
    ? (ultimaMensagem.autorRole === 'supervisor' ? 'gestao' : 'supervisor')
    : 'gestao'
  const desde = ultimaMensagem?.criadaEm ?? ocorrenciaCriadaEm

  if (lado === 'gestao' && cienciaGestaoEm && Date.parse(cienciaGestaoEm) >= Date.parse(desde)) {
    return null
  }
  return { lado, desde, origem: ultimaMensagem ? 'mensagem' : 'registro' }
}
