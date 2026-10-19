export type LadoAguardando = 'gestao' | 'supervisor'

export type EstadoAguardando = { lado: LadoAguardando; desde: string }

// De que lado está a bola numa ocorrência aberta.
// - sem mensagem: aguardando a gestão, desde o registro;
// - última mensagem do supervisor: aguardando a gestão; de qualquer outro papel: aguardando o supervisor;
// - "ciente" da gestão: se a bola está com a gestão e a ciência é posterior à espera, não há pendência
//   (volta a pendente quando o supervisor escrever de novo).
// Só conta mensagem de verdade; nota interna e parecer não entram.
export function calcularAguardando(p: {
  ultimaMensagem: { autorRole: string | null; criadaEm: string } | null
  ocorrenciaCriadaEm: string
  cienciaGestaoEm: string | null
}): EstadoAguardando | null {
  const { ultimaMensagem, ocorrenciaCriadaEm, cienciaGestaoEm } = p
  const lado: LadoAguardando = ultimaMensagem
    ? (ultimaMensagem.autorRole === 'supervisor' ? 'gestao' : 'supervisor')
    : 'gestao'
  const desde = ultimaMensagem?.criadaEm ?? ocorrenciaCriadaEm

  if (lado === 'gestao' && cienciaGestaoEm && Date.parse(cienciaGestaoEm) >= Date.parse(desde)) {
    return null
  }
  return { lado, desde }
}
