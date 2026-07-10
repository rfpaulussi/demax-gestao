import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Clock, Send } from 'lucide-react'
import { getUser } from '@/lib/auth/get-user'
import { buscarConvencao, buscarFuncoesComCustos } from '../actions'
import { ConvencaoClient } from './convencao-client'
import { cn } from '@/lib/utils'

const STATUS_CFG = {
  rascunho:  { label: 'Rascunho',  cls: 'bg-slate-100 text-slate-600 ring-slate-200', icon: Clock        },
  publicada: { label: 'Publicada', cls: 'bg-blue-50 text-blue-700 ring-blue-200',     icon: Send         },
  aplicada:  { label: 'Aplicada',  cls: 'bg-green-50 text-green-700 ring-green-200',  icon: CheckCircle2 },
}

function fmt(iso: string | null) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

function fmtMes(iso: string) {
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  const [y, m] = iso.split('-')
  return `${meses[parseInt(m) - 1]}/${y}`
}

export default async function ConvencaoDetalhePage({
  params,
}: {
  params: { id: string }
}) {
  const auth = await getUser()
  if (!auth) redirect('/login')
  if (!['admin', 'coordenador'].includes(auth.perfil.role ?? '')) redirect('/dashboard')

  const [conv, funcoesRaw] = await Promise.all([
    buscarConvencao(params.id),
    buscarFuncoesComCustos(),
  ])

  if (!conv) notFound()

  type RawConv = {
    id: string
    descricao: string
    data_vigencia_inicio: string
    data_vigencia_fim: string
    percentual_reajuste: number | null
    observacoes: string | null
    status: 'rascunho' | 'publicada' | 'aplicada'
    created_at: string | null
    aplicada_em: string | null
    perfis: { nome: string | null } | null
    aplicador: { nome: string | null } | null
    convencao_valores_funcoes: {
      funcao_id: string; salario_base: number; total_por_func: number | null
      va: number | null; vr: number | null; vt: number | null
      enc_inss: number | null; fgts: number | null
      assid_asseio: number | null; bss: number | null; aux_saude: number | null
      plr: number | null; insalubridade_perc: number | null; insalubridade_valor: number | null
      periculosidade_perc: number | null; periculosidade_valor: number | null
      um_doze_decimo_terceiro: number | null; um_terceiro_ferias: number | null
      enc_provisorio: number | null; um_doze_lei_12506: number | null; multa_40_pct: number | null
    }[]
  }

  const c = conv as unknown as RawConv
  const cfg = STATUS_CFG[c.status]
  const StatusIcon = cfg.icon

  type RawCustos = {
    va: number | null; vr: number | null; vt: number | null
    enc_inss: number | null; fgts: number | null
    assid_asseio: number | null; bss: number | null; aux_saude: number | null
    plr: number | null; um_doze_decimo_terceiro: number | null
    um_terceiro_ferias: number | null; enc_provisorio: number | null
    um_doze_lei_12506: number | null; multa_40_pct: number | null
    total_por_func: number | null
  }

  type RawFuncao = {
    id: string; nome: string; salario_base: number | null
    insalubridade_perc: number | null; insalubridade_valor: number | null
    periculosidade_perc: number | null; periculosidade_valor: number | null
    custos_funcoes: RawCustos | RawCustos[] | null
  }

  const funcoes = (funcoesRaw as unknown as RawFuncao[]).map(f => ({
    id:                   f.id,
    nome:                 f.nome,
    salario_base:         f.salario_base,
    insalubridade_perc:   f.insalubridade_perc,
    insalubridade_valor:  f.insalubridade_valor,
    periculosidade_perc:  f.periculosidade_perc,
    periculosidade_valor: f.periculosidade_valor,
    custos:               Array.isArray(f.custos_funcoes)
      ? (f.custos_funcoes[0] ?? null)
      : (f.custos_funcoes ?? null),
  }))

  return (
    <div className="space-y-6">
      <Link href="/convencoes" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" /> Convenções Coletivas
      </Link>

      {/* Header card */}
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900">{c.descricao}</h1>
              <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset', cfg.cls)}>
                <StatusIcon className="h-3.5 w-3.5" />
                {cfg.label}
              </span>
            </div>
            {c.observacoes && (
              <p className="mt-2 text-sm text-gray-500">{c.observacoes}</p>
            )}
          </div>
          {c.percentual_reajuste != null && (
            <div className="rounded-xl bg-green-50 px-5 py-3 text-center ring-1 ring-green-200">
              <p className="text-3xl font-black text-green-600">+{c.percentual_reajuste}%</p>
              <p className="text-xs font-semibold uppercase tracking-widest text-green-500">Reajuste</p>
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Vigência</p>
            <p className="text-gray-800 font-medium">{fmtMes(c.data_vigencia_inicio)} – {fmtMes(c.data_vigencia_fim)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Criada em</p>
            <p className="text-gray-800">{fmt(c.created_at)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Criada por</p>
            <p className="text-gray-800">{(c.perfis as { nome: string | null } | null)?.nome ?? '—'}</p>
          </div>
          {c.status === 'aplicada' && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Aplicada em</p>
              <p className="font-semibold text-green-700">{fmt(c.aplicada_em)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Conteúdo interativo */}
      <ConvencaoClient
        convencaoId={c.id}
        status={c.status}
        percentual={c.percentual_reajuste}
        funcoes={funcoes}
        valoresExistentes={c.convencao_valores_funcoes}
        isAdmin={auth.perfil.role === 'admin'}
      />
    </div>
  )
}
