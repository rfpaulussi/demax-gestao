import Link from 'next/link'
import { AlertTriangle, Clock, CheckCircle2, ChevronRight, MapPin } from 'lucide-react'
import { getUser } from '@/lib/auth/get-user'
import { redirect } from 'next/navigation'
import { buscarMeusPostos } from './actions'
import type { PostoStatus, FuncionarioPostoInfo, CoberturaInfo } from './actions'

function fmtData(d: string | null) {
  if (!d) return null
  const [y, m, dd] = d.split('-')
  return `${dd}/${m}/${y}`
}

function StatusChip({ f }: { f: FuncionarioPostoInfo }) {
  if (f.status === 'ativo') {
    return (
      <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700 ring-1 ring-inset ring-green-200">
        Ativo
      </span>
    )
  }
  if (f.status === 'ferias') {
    return (
      <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-200">
        Férias
      </span>
    )
  }
  if (f.status === 'afastado') {
    return (
      <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200">
        Afastado (INSS)
      </span>
    )
  }
  // atestado
  return (
    <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
      Atestado{f.data_fim_atestado ? ` até ${fmtData(f.data_fim_atestado)}` : ''}
    </span>
  )
}

function PostoCard({ posto }: { posto: PostoStatus }) {
  const ausentes = posto.funcionarios.filter(f => f.status !== 'ativo')
  const ativos   = posto.funcionarios.filter(f => f.status === 'ativo')

  const isVermelho = posto.descoberto

  const borderColor  = isVermelho ? 'border-l-red-500'   : 'border-l-amber-400'
  const bgColor      = isVermelho ? 'bg-red-50'           : 'bg-amber-50'
  const iconBg       = isVermelho ? 'bg-red-100'          : 'bg-amber-100'
  const iconColor    = isVermelho ? 'text-red-600'        : 'text-amber-600'
  const badgeBg      = isVermelho ? 'bg-red-100 text-red-800 ring-red-200'   : 'bg-amber-100 text-amber-800 ring-amber-200'
  const badgeLabel   = isVermelho ? 'Sem cobertura'       : 'Cobertura vence em breve'
  const btnStyle     = isVermelho
    ? 'border-red-300 text-red-700 hover:bg-red-100'
    : 'border-amber-300 text-amber-700 hover:bg-amber-100'

  return (
    <div className={`overflow-hidden rounded-xl border border-gray-100 border-l-4 ${borderColor} ${bgColor} shadow-sm`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3.5">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
            {isVermelho
              ? <AlertTriangle className={`h-4 w-4 ${iconColor}`} />
              : <Clock className={`h-4 w-4 ${iconColor}`} />
            }
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">{posto.nome}</p>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${badgeBg}`}>
              {badgeLabel}
            </span>
          </div>
        </div>
        <Link
          href="/coberturas"
          className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${btnStyle}`}
        >
          {isVermelho ? 'Criar cobertura' : 'Renovar'}
        </Link>
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-gray-200" />

      {/* Funcionários */}
      <div className="flex flex-col gap-2 px-4 py-3">
        {ausentes.map(f => {
          const cobs: CoberturaInfo[] = f.coberturas ?? []
          const temCobertura = cobs.length > 0
          const cobVenceHoje = cobs.some(c => c.venceHoje)
          const cobVenceAmanha = cobs.some(c => c.venceAmanha)
          return (
            <div key={f.id} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${isVermelho ? 'bg-red-200 text-red-800' : 'bg-amber-200 text-amber-800'}`}>
                  {f.nome.split(' ').filter(Boolean).slice(0,2).map(p => p[0]).join('').toUpperCase()}
                </div>
                <span className="truncate text-sm text-gray-800">{f.nome}</span>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <StatusChip f={f} />
                {temCobertura && (
                  <span className={`text-[11px] font-medium ${cobVenceHoje ? 'text-red-600' : cobVenceAmanha ? 'text-amber-600' : 'text-teal-600'}`}>
                    {cobs[0].substituto_nome.split(' ')[0]} cobre
                    {cobVenceHoje ? ' — vence hoje' : cobVenceAmanha ? ' — vence amanhã' : ''}
                  </span>
                )}
              </div>
            </div>
          )
        })}
        {ativos.slice(0, 2).map(f => (
          <div key={f.id} className="flex items-center justify-between gap-2 opacity-60">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-semibold text-gray-500">
                {f.nome.split(' ').filter(Boolean).slice(0,2).map(p => p[0]).join('').toUpperCase()}
              </div>
              <span className="truncate text-sm text-gray-600">{f.nome}</span>
            </div>
            <StatusChip f={f} />
          </div>
        ))}
        {ativos.length > 2 && (
          <p className="text-xs text-gray-400 pl-9">+{ativos.length - 2} ativos</p>
        )}
      </div>
    </div>
  )
}

export default async function MeusPostosPage() {
  const auth = await getUser()
  if (!auth) redirect('/login')

  if (auth.perfil.role === 'admin' || auth.perfil.role === 'coordenador') {
    redirect('/efetivo')
  }

  const postos = await buscarMeusPostos()

  const comProblema = postos.filter(p => p.descoberto || p.coberturaVencendo)
    .sort((a, b) => {
      if (a.descoberto && !b.descoberto) return -1
      if (!a.descoberto && b.descoberto) return 1
      return 0
    })
  const semProblema = postos.filter(p => !p.descoberto && !p.coberturaVencendo)

  const nDescobertos    = postos.filter(p => p.descoberto).length
  const nVencendo       = postos.filter(p => !p.descoberto && p.coberturaVencendo).length
  const nOk             = semProblema.length

  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-medium text-gray-900">Meus postos</h1>
        <p className="mt-0.5 text-sm capitalize text-gray-500">{hoje}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-100 border-t-4 border-t-red-500 bg-white p-3 shadow-sm">
          <p className="text-2xl font-black text-gray-900">{nDescobertos}</p>
          <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Descobertos</p>
        </div>
        <div className="rounded-xl border border-gray-100 border-t-4 border-t-amber-400 bg-white p-3 shadow-sm">
          <p className="text-2xl font-black text-gray-900">{nVencendo}</p>
          <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Cobertura vence</p>
        </div>
        <div className="rounded-xl border border-gray-100 border-t-4 border-t-green-500 bg-white p-3 shadow-sm">
          <p className="text-2xl font-black text-gray-900">{nOk}</p>
          <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Postos ok</p>
        </div>
      </div>

      {/* Postos com problema */}
      {comProblema.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
            Requer atenção
          </p>
          {comProblema.map(p => (
            <PostoCard key={p.id} posto={p} />
          ))}
        </div>
      )}

      {/* Postos ok */}
      {semProblema.length > 0 && (
        <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium text-gray-700">
                {nOk} posto{nOk !== 1 ? 's' : ''} sem ocorrências
              </span>
            </div>
            <Link
              href="/efetivo"
              className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              Ver todos <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {semProblema.map(p => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2.5 py-0.5 text-xs text-gray-500 ring-1 ring-inset ring-gray-200"
              >
                <MapPin className="h-2.5 w-2.5" />
                {p.nome}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Estado vazio */}
      {postos.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-100 bg-white py-16 text-center shadow-sm">
          <CheckCircle2 className="mb-3 h-10 w-10 text-green-400" />
          <p className="text-sm font-semibold text-gray-700">Nenhum posto vinculado</p>
          <p className="mt-1 text-xs text-gray-400">Solicite ao administrador que vincule seus postos.</p>
        </div>
      )}

      {/* Tudo ok */}
      {postos.length > 0 && comProblema.length === 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-green-100 bg-green-50 px-4 py-3.5">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
          <div>
            <p className="text-sm font-semibold text-green-800">Todos os postos em ordem</p>
            <p className="text-xs text-green-700">Nenhuma cobertura pendente ou vencendo hoje.</p>
          </div>
        </div>
      )}
    </div>
  )
}
