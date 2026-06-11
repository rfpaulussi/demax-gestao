import Link from 'next/link'
import { Users, ArrowLeftRight, RefreshCw, CalendarX, AlertTriangle, UserX } from 'lucide-react'

const RELATORIOS = [
  {
    href: '/relatorios/coberturas-insalubres',
    icon: ArrowLeftRight,
    label: 'Coberturas Insalubres',
    desc: 'Registros de cobertura de insalubridade agrupados por supervisor',
    color: 'border-t-purple-500',
    iconColor: 'text-purple-500',
  },
  {
    href: '/relatorios/postos-mes',
    icon: Users,
    label: 'Efetivo por Posto/Mês',
    desc: 'Snapshot do efetivo em cada posto no mês selecionado',
    color: 'border-t-blue-500',
    iconColor: 'text-blue-500',
  },
  {
    href: '/relatorios/mudancas-funcao',
    icon: RefreshCw,
    label: 'Mudanças de Função',
    desc: 'Alterações de função ocorridas no mês',
    color: 'border-t-indigo-500',
    iconColor: 'text-indigo-500',
  },
  {
    href: '/relatorios/absenteismo',
    icon: CalendarX,
    label: 'Absenteísmo',
    desc: 'Faltas, atestados e férias consolidados com KPIs de absenteísmo',
    color: 'border-t-amber-500',
    iconColor: 'text-amber-500',
  },
  {
    href: '/relatorios/advertencias-mes',
    icon: AlertTriangle,
    label: 'Advertências do Mês',
    desc: 'Advertências e suspensões registradas no mês',
    color: 'border-t-red-500',
    iconColor: 'text-red-500',
  },
  {
    href: '/relatorios/faltas-mes',
    icon: UserX,
    label: 'Faltas do Mês',
    desc: 'Faltas registradas no mês com KPIs de frequência',
    color: 'border-t-orange-500',
    iconColor: 'text-orange-500',
  },
]

export default function RelatoriosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Relatórios</h1>
        <p className="text-sm text-gray-400">Relatórios mensais por categoria</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {RELATORIOS.map(({ href, icon: Icon, label, desc, color, iconColor }) => (
          <Link
            key={href}
            href={href}
            className={`group flex flex-col gap-3 rounded-xl border border-gray-100 border-t-4 bg-white p-5 shadow-sm transition-shadow hover:shadow-md ${color}`}
          >
            <div className="flex items-center gap-3">
              <Icon className={`h-5 w-5 shrink-0 ${iconColor}`} />
              <span className="font-semibold text-gray-900 group-hover:text-slate-700">{label}</span>
            </div>
            <p className="text-sm text-gray-400">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
