export const CONTRATO_COMUNICADO = 'Pref. de Mogi - Limpeza - 706'

export type CausaComunicado =
  | 'pedido_demissao'
  | 'reprova_experiencia'
  | 'sem_justa_causa_indenizado'
  | 'com_justa_causa'
  | 'sem_justa_causa_trabalhado'
  | 'falecimento'

/** As seis caixas de "CAUSA" do comunicado, na ordem do papel. `emoji`/`grupo` só organizam o seletor da tela. */
export const CAUSAS_COMUNICADO: { value: CausaComunicado; label: string; emoji: string; grupo: string }[] = [
  { value: 'pedido_demissao',            label: 'Pedido de Demissão',                   emoji: '🙋', grupo: 'Iniciativa do funcionário' },
  { value: 'reprova_experiencia',        label: 'Reprova na Experiência',               emoji: '📋', grupo: 'Iniciativa da empresa' },
  { value: 'sem_justa_causa_indenizado', label: 'Dispensa sem Justa Causa Indenizado',  emoji: '💰', grupo: 'Iniciativa da empresa' },
  { value: 'sem_justa_causa_trabalhado', label: 'Dispensa sem Justa Causa Trabalhado',  emoji: '🛠️', grupo: 'Iniciativa da empresa' },
  { value: 'com_justa_causa',            label: 'Dispensa com Justa Causa',             emoji: '⚖️', grupo: 'Iniciativa da empresa' },
  { value: 'falecimento',                label: 'Falecimento',                          emoji: '🕊️', grupo: 'Outros' },
]
