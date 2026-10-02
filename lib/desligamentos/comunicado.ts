export const CONTRATO_COMUNICADO = 'Pref. de Mogi - Limpeza - 706'

export type CausaComunicado =
  | 'pedido_demissao'
  | 'reprova_experiencia'
  | 'sem_justa_causa_indenizado'
  | 'com_justa_causa'
  | 'sem_justa_causa_trabalhado'
  | 'falecimento'

/** As seis caixas de "CAUSA" do comunicado, na ordem do papel. */
export const CAUSAS_COMUNICADO: { value: CausaComunicado; label: string }[] = [
  { value: 'pedido_demissao',            label: 'Pedido de Demissão' },
  { value: 'reprova_experiencia',        label: 'Reprova na Experiência' },
  { value: 'sem_justa_causa_indenizado', label: 'Dispensa sem Justa Causa Indenizado' },
  { value: 'com_justa_causa',            label: 'Dispensa com Justa Causa' },
  { value: 'sem_justa_causa_trabalhado', label: 'Dispensa sem Justa Causa Trabalhado' },
  { value: 'falecimento',                label: 'Falecimento' },
]
