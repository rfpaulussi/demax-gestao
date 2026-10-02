export const CONTRATO_COMUNICADO = 'Pref. de Mogi - Limpeza - 706'

export type CausaComunicado =
  | 'pedido_demissao'
  | 'reprova_experiencia'
  | 'sem_justa_causa_indenizado'
  | 'com_justa_causa'
  | 'sem_justa_causa_trabalhado'
  | 'falecimento'

export type AvisoDesligamento = 'trabalhado' | 'indenizado'

/** Demissão sem justa causa precisa saber se o aviso é trabalhado ou indenizado (são duas caixas diferentes no papel). */
export function exigeAviso(tipo: string | null | undefined, motivo: string | null | undefined): boolean {
  return tipo === 'demissao' && motivo !== 'justa_causa'
}

/** Caixa de "CAUSA" do comunicado que corresponde ao tipo/motivo do desligamento. `null` = nenhuma marcada (o RH marca à mão). */
export function causaDoDesligamento(
  tipo: string | null | undefined,
  motivo: string | null | undefined,
  aviso: string | null | undefined,
): CausaComunicado | null {
  if (tipo === 'voluntaria') return 'pedido_demissao'
  if (tipo === 'reprova_experiencia') return 'reprova_experiencia'
  if (tipo === 'outros' && motivo === 'fim_experiencia') return 'reprova_experiencia'
  if (tipo === 'outros' && motivo === 'falecimento') return 'falecimento'
  if (tipo === 'demissao') {
    if (motivo === 'justa_causa') return 'com_justa_causa'
    if (aviso === 'trabalhado') return 'sem_justa_causa_trabalhado'
    if (aviso === 'indenizado') return 'sem_justa_causa_indenizado'
  }
  return null
}
