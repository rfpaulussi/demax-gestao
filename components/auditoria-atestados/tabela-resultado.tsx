// components/auditoria-atestados/tabela-resultado.tsx
'use client'

import { cn } from '@/lib/utils'
import type { ResultadoAuditoria, LinhaResultado, CampoDivergente } from '@/lib/auditoria-atestados/tipos'

const LABEL_CAMPO: Record<CampoDivergente, string> = {
  data_inicio: 'Data início',
  data_fim: 'Data fim',
  cid: 'CID',
  origem_ocupacional: 'Origem ocupacional',
}

function CardContador({ label, valor, cor }: { label: string; valor: number; cor: string }) {
  return (
    <div className={cn('rounded-xl border border-t-4 border-gray-100 bg-white p-4 shadow-sm', cor)}>
      <p className="text-xl font-black tracking-tight text-gray-900">{valor}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
    </div>
  )
}

function LinhaConfereOuDivergencia({ l }: { l: Extract<LinhaResultado, { status: 'confere' | 'divergencia' }> }) {
  const divergentes = l.status === 'divergencia' ? l.camposDivergentes : []
  return (
    <tr className="border-t border-gray-100">
      <td className="px-3 py-2 text-sm text-gray-700">{l.sesmt.nome}</td>
      <td className={cn('px-3 py-2 text-sm', divergentes.includes('data_inicio') ? 'bg-red-50 font-medium text-red-700' : 'text-gray-600')}>
        {l.sesmt.dataInicio} / {l.sistema.dataInicio}
      </td>
      <td className={cn('px-3 py-2 text-sm', divergentes.includes('data_fim') ? 'bg-red-50 font-medium text-red-700' : 'text-gray-600')}>
        {l.sesmt.dataRetorno} / {l.sistema.dataFim}
      </td>
      <td className={cn('px-3 py-2 text-sm', divergentes.includes('cid') ? 'bg-red-50 font-medium text-red-700' : 'text-gray-600')}>
        {l.sesmt.cidTexto} / {l.sistema.cidCodigo ?? 'Sem CID'}
      </td>
      <td className={cn('px-3 py-2 text-sm', divergentes.includes('origem_ocupacional') ? 'bg-red-50 font-medium text-red-700' : 'text-gray-600')}>
        {l.sesmt.motivo}
      </td>
    </tr>
  )
}

export function TabelaResultado({ resultado }: { resultado: ResultadoAuditoria }) {
  const { linhas, contadores } = resultado

  const divergencias = linhas.filter((l): l is Extract<LinhaResultado, { status: 'divergencia' }> => l.status === 'divergencia')
  const conferem = linhas.filter((l): l is Extract<LinhaResultado, { status: 'confere' }> => l.status === 'confere')
  const naoLancados = linhas.filter((l): l is Extract<LinhaResultado, { status: 'nao_lancado' | 'matricula_nao_encontrada' }> =>
    l.status === 'nao_lancado' || l.status === 'matricula_nao_encontrada',
  )
  const ambiguosOuSemSesmt = linhas.filter(
    (l): l is Extract<LinhaResultado, { status: 'ambiguo' | 'sem_sesmt' }> => l.status === 'ambiguo' || l.status === 'sem_sesmt',
  )

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CardContador label="Conferem" valor={contadores.confere} cor="border-t-green-500" />
        <CardContador label="Divergências" valor={contadores.divergencia} cor="border-t-red-500" />
        <CardContador label="Não lançados" valor={contadores.naoLancado + contadores.matriculaNaoEncontrada} cor="border-t-amber-500" />
        <CardContador label="Ambíguos / Sem SESMT" valor={contadores.ambiguo + contadores.semSesmt} cor="border-t-indigo-500" />
      </div>

      {divergencias.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-bold text-gray-900">⚠️ Divergências ({divergencias.length})</h2>
            <p className="text-xs text-gray-400">Cada célula mostra SESMT / Sistema — em vermelho quando diferem</p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-widest text-gray-500">
                <th className="px-3 py-2">Funcionário</th>
                <th className="px-3 py-2">Início</th>
                <th className="px-3 py-2">Fim</th>
                <th className="px-3 py-2">CID</th>
                <th className="px-3 py-2">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {divergencias.map((l, i) => (
                <LinhaConfereOuDivergencia key={i} l={l} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {naoLancados.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-bold text-gray-900">❌ Não lançados no sistema ({naoLancados.length})</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-widest text-gray-500">
                <th className="px-3 py-2">Funcionário</th>
                <th className="px-3 py-2">Matrícula</th>
                <th className="px-3 py-2">Início</th>
                <th className="px-3 py-2">Retorno</th>
                <th className="px-3 py-2">CID</th>
                <th className="px-3 py-2">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {naoLancados.map((l, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-3 py-2 text-sm text-gray-700">{l.sesmt.nome}</td>
                  <td className="px-3 py-2 text-sm text-gray-600">{l.sesmt.matriculaRaw}</td>
                  <td className="px-3 py-2 text-sm text-gray-600">{l.sesmt.dataInicio}</td>
                  <td className="px-3 py-2 text-sm text-gray-600">{l.sesmt.dataRetorno}</td>
                  <td className="px-3 py-2 text-sm text-gray-600">{l.sesmt.cidTexto}</td>
                  <td className="px-3 py-2 text-sm text-gray-600">{l.sesmt.motivo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ambiguosOuSemSesmt.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-bold text-gray-900">ℹ️ Ambíguos / Sem registro no SESMT ({ambiguosOuSemSesmt.length})</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-widest text-gray-500">
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Funcionário</th>
                <th className="px-3 py-2">Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {ambiguosOuSemSesmt.map((l, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-3 py-2 text-sm text-gray-600">{l.status === 'ambiguo' ? 'Ambíguo' : 'Sem SESMT'}</td>
                  <td className="px-3 py-2 text-sm text-gray-700">
                    {l.status === 'ambiguo' ? l.sesmt.nome : l.sistema.funcionarioNome}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-600">
                    {l.status === 'ambiguo'
                      ? `${l.candidatos.length} atestados candidatos no sistema (${l.candidatos.map(c => `${c.dataInicio}→${c.dataFim}`).join(', ')})`
                      : `${l.sistema.dataInicio} → ${l.sistema.dataFim}${l.sistema.cidCodigo ? ` (${l.sistema.cidCodigo})` : ''}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {conferem.length > 0 && (
        <details className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <summary className="cursor-pointer border-b border-gray-100 px-4 py-3 text-sm font-bold text-gray-900">
            ✅ Conferem ({conferem.length}) — clique para expandir
          </summary>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-widest text-gray-500">
                <th className="px-3 py-2">Funcionário</th>
                <th className="px-3 py-2">Início</th>
                <th className="px-3 py-2">Fim</th>
                <th className="px-3 py-2">CID</th>
              </tr>
            </thead>
            <tbody>
              {conferem.map((l, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-3 py-2 text-sm text-gray-700">{l.sesmt.nome}</td>
                  <td className="px-3 py-2 text-sm text-gray-600">{l.sistema.dataInicio}</td>
                  <td className="px-3 py-2 text-sm text-gray-600">{l.sistema.dataFim}</td>
                  <td className="px-3 py-2 text-sm text-gray-600">{l.sistema.cidCodigo ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  )
}
