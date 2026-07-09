export type NavItem = {
  href: string
  label: string
  badge?: boolean
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
      { href: '/fechamento',       label: 'Fechamento'        },
      { href: '/relatorios',       label: 'Relatórios'        },
      { href: '/importacao',       label: 'Importação'        },
      { href: '/supervisores',      label: 'Supervisores'      },
      { href: '/usuarios',         label: 'Usuários'          },
      { href: '/auditoria',        label: 'Auditoria'         },
      { href: '/convencoes',       label: 'Conv. Coletivas'   },
    ],
  },
]
