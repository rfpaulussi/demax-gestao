export type FaltaTipo = 'sem_justificativa' | 'declaracao' | 'justificada' | 'atraso' | 'suspensao'

// 'suspensao' mantido no tipo mas não exibido como opção manual — gerado automaticamente via advertência
export const FALTA_TIPO_LABELS: Record<FaltaTipo, string> = {
  sem_justificativa: 'Sem Justificativa',
  declaracao:        'Declaração',
  justificada:       'Justificada',
  atraso:            'Atraso',
  suspensao:         'Suspensão',
}

export const FALTA_TIPO_COLORS: Record<FaltaTipo, string> = {
  sem_justificativa: 'bg-red-100 text-red-700',
  declaracao:        'bg-blue-100 text-blue-700',
  justificada:       'bg-green-100 text-green-700',
  atraso:            'bg-orange-100 text-orange-700',
  suspensao:         'bg-purple-100 text-purple-700',
}

export const FALTA_TIPOS_MANUAIS: FaltaTipo[] = [
  'sem_justificativa', 'declaracao', 'justificada', 'atraso',
]
