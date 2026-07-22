import { ROLES_GESTAO } from '@/types'
import type { Role } from '@/types'

export type NavItem = {
  href: string
  label: string
  badge?: boolean
  alertBadge?: boolean
  // Quando presente, define exatamente quem vê o item, ignorando o adminOnly do grupo.
  // Ausente = herda o comportamento padrão do grupo (adminOnly).
  allowedRoles?: readonly Role[]
}

export type NavGroup = {
  label: string
  adminOnly?: boolean
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Operacional',
    items: [
      { href: '/dashboard',     label: 'Dashboard'     },
      { href: '/efetivo',       label: 'Efetivo'       },
      { href: '/postos',        label: 'Postos'        },
      { href: '/aprovacoes',    label: 'Aprovações',   badge: true },
      { href: '/coberturas',    label: 'Cobertura Temp.' },
      { href: '/ferias',        label: 'Férias'        },
      { href: '/advertencias',  label: 'Advertências'  },
      { href: '/faltas',        label: 'Faltas'        },
      { href: '/atestados',     label: 'Atestados'     },
      { href: '/insalubridade', label: 'Cobertura Insalubre' },
      { href: '/ocorrencias',   label: 'Ocorrências'   },
      { href: '/acordos',       label: 'Acordos'        },
      { href: '/ajuda',         label: 'Ajuda'          },
    ],
  },
  {
    label: 'Administração',
    adminOnly: true,
    items: [
      { href: '/pendencias',       label: 'Pendências'        },
      { href: '/desligamentos',    label: 'Desligamentos'     },
      { href: '/mudancas-funcao',  label: 'Mudanças de Função' },
      // Fechamento, Fechamento Financeiro, Funções e Salários e Convenções liberam
      // admin + coordenador nas próprias páginas/actions — o menu precisa refletir isso.
      { href: '/fechamento',            label: 'Fechamento',            allowedRoles: ROLES_GESTAO },
      { href: '/fechamento-financeiro', label: 'Fechamento Financeiro', allowedRoles: ROLES_GESTAO },
      { href: '/relatorios',       label: 'Relatórios'        },
      { href: '/importacao',       label: 'Importação'        },
      { href: '/supervisores',      label: 'Supervisores'      },
      { href: '/usuarios',         label: 'Usuários'          },
      { href: '/auditoria',        label: 'Auditoria'         },
      { href: '/funcoes',           label: 'Funções e Salários', alertBadge: true, allowedRoles: ROLES_GESTAO },
      { href: '/convencoes',       label: 'Conv. Coletivas', allowedRoles: ROLES_GESTAO },
      { href: '/revisor-operacional', label: 'Revisor Operacional', allowedRoles: ROLES_GESTAO },
    ],
  },
]
