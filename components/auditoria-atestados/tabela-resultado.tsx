// components/auditoria-atestados/tabela-resultado.tsx
'use client'

import * as XLSX from 'xlsx-js-style'
import { cn } from '@/lib/utils'
import { extrairRegistroDeMatricula } from '@/lib/auditoria-atestados/parse'
import type { ResultadoAuditoria, LinhaResultado, CampoDivergente } from '@/lib/auditoria-atestados/tipos'

const LABEL_STATUS: Record<LinhaResultado['status'], string> = {
  confere: 'Confere',
  divergencia: 'Divergência',
  nao_lancado: 'Não lançado no sistema',
  matricula_nao_encontrada: 'Matrícula não encontrada',
  ambiguo: 'Ambíguo',
  sem_sesmt: 'Sem registro no SESMT',
}

function formatarDataBr(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

function registroDaMatricula(matriculaRaw: string): string {
  return extrairRegistroDeMatricula(matriculaRaw) ?? matriculaRaw
}

function CardContador({ label, valor, cor }: { label: string; valor: number; cor: string }) {
  return (
    <div className={cn('rounded-xl border border-t-4 border-gray-100 bg-white p-4 shadow-sm', cor)}>
      <p className="text-xl font-black tracking-tight text-gray-900">{valor}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
    </div>
  )
}

function CelulaComparada({ sesmt, sistema, divergente }: { sesmt: string; sistema: string; divergente: boolean }) {
  return (
    <td className={cn('px-3 py-2 text-sm', divergente ? 'bg-red-50' : '')}>
      <div className="text-gray-500">SESMT: {sesmt}</div>
      <div className={cn(divergente ? 'font-semibold text-red-700' : 'text-gray-700')}>Sistema: {sistema}</div>
    </td>
  )
}

function LinhaConfereOuDivergencia({ l }: { l: Extract<LinhaResultado, { status: 'confere' | 'divergencia' }> }) {
  const divergentes: CampoDivergente[] = l.status === 'divergencia' ? l.camposDivergentes : []
  return (
    <tr className="border-t border-gray-100">
      <td className="px-3 py-2 text-sm text-gray-700">{l.sesmt.nome}</td>
      <td className="px-3 py-2 text-sm text-gray-600">{registroDaMatricula(l.sesmt.matriculaRaw)}</td>
      <CelulaComparada
        sesmt={formatarDataBr(l.sesmt.dataInicio)}
        sistema={formatarDataBr(l.sistema.dataInicio)}
        divergente={divergentes.includes('data_inicio')}
      />
      <CelulaComparada
        sesmt={formatarDataBr(l.sesmt.dataRetorno)}
        sistema={formatarDataBr(l.sistema.dataFim)}
        divergente={divergentes.includes('data_fim')}
      />
      <CelulaComparada
        sesmt={l.sesmt.cidTexto}
        sistema={l.sistema.cidCodigo ?? 'Sem CID'}
        divergente={divergentes.includes('cid')}
      />
      <td className={cn('px-3 py-2 text-sm', divergentes.includes('origem_ocupacional') ? 'bg-red-50 font-medium text-red-700' : 'text-gray-600')}>
        {l.sesmt.motivo}
      </td>
    </tr>
  )
}

function exportarExcel(resultado: ResultadoAuditoria) {
  const header = [
    'Status', 'Funcionário', 'Matrícula',
    'Início SESMT', 'Início Sistema',
    'Retorno SESMT', 'Fim Sistema',
    'CID SESMT', 'CID Sistema',
    'Motivo SESMT', 'Origem ocupacional Sistema',
    'Detalhe',
  ]

  const linhas: (string | number)[][] = resultado.linhas.map(l => {
    const status = LABEL_STATUS[l.status]
    switch (l.status) {
      case 'confere':
      case 'divergencia':
        return [
          status, l.sesmt.nome, registroDaMatricula(l.sesmt.matriculaRaw),
          formatarDataBr(l.sesmt.dataInicio), formatarDataBr(l.sistema.dataInicio),
          formatarDataBr(l.sesmt.dataRetorno), formatarDataBr(l.sistema.dataFim),
          l.sesmt.cidTexto, l.sistema.cidCodigo ?? 'Sem CID',
          l.sesmt.motivo, l.sistema.origemOcupacional ?? '—',
          l.status === 'divergencia' ? `Campos divergentes: ${l.camposDivergentes.join(', ')}` : '',
        ]
      case 'nao_lancado':
      case 'matricula_nao_encontrada':
        return [
          status, l.sesmt.nome, registroDaMatricula(l.sesmt.matriculaRaw),
          formatarDataBr(l.sesmt.dataInicio), '—',
          formatarDataBr(l.sesmt.dataRetorno), '—',
          l.sesmt.cidTexto, '—',
          l.sesmt.motivo, '—',
          '',
        ]
      case 'ambiguo':
        return [
          status, l.sesmt.nome, registroDaMatricula(l.sesmt.matriculaRaw),
          formatarDataBr(l.sesmt.dataInicio), '—',
          formatarDataBr(l.sesmt.dataRetorno), '—',
          l.sesmt.cidTexto, '—',
          l.sesmt.motivo, '—',
          `${l.candidatos.length} atestados candidatos: ${l.candidatos.map(c => `${formatarDataBr(c.dataInicio)}→${formatarDataBr(c.dataFim)}`).join(' | ')}`,
        ]
      case 'sem_sesmt':
        return [
          status, l.sistema.funcionarioNome, l.sistema.registro,
          '—', formatarDataBr(l.sistema.dataInicio),
          '—', formatarDataBr(l.sistema.dataFim),
          '—', l.sistema.cidCodigo ?? 'Sem CID',
          '—', l.sistema.origemOcupacional ?? '—',
          '',
        ]
    }
  })

  const ws = XLSX.utils.aoa_to_sheet([header, ...linhas])
  ws['!cols'] = header.map((_, i) => ({ wch: i === 11 ? 50 : i === 1 ? 30 : 18 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Auditoria SESMT')
  const hoje = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `auditoria_sesmt_atestados_${hoje}.xlsx`)
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
      <div className="flex items-center justify-between gap-3">
        <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
          <CardContador label="Conferem" valor={contadores.confere} cor="border-t-green-500" />
          <CardContador label="Divergências" valor={contadores.divergencia} cor="border-t-red-500" />
          <CardContador label="Não lançados" valor={contadores.naoLancado + contadores.matriculaNaoEncontrada} cor="border-t-amber-500" />
          <CardContador label="Ambíguos / Sem SESMT" valor={contadores.ambiguo + contadores.semSesmt} cor="border-t-indigo-500" />
        </div>
        <button
          type="button"
          onClick={() => exportarExcel(resultado)}
          className="flex h-9 shrink-0 items-center justify-center rounded-lg bg-amber-500 px-4 text-sm font-medium text-slate-900 transition-colors hover:bg-amber-400"
        >
          Baixar Excel
        </button>
      </div>

      {divergencias.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-bold text-gray-900">⚠️ Divergências ({divergencias.length})</h2>
            <p className="text-xs text-gray-400">Cada célula mostra SESMT em cima, Sistema embaixo — em vermelho quando diferem</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-widest text-gray-500">
                  <th className="px-3 py-2">Funcionário</th>
                  <th className="px-3 py-2">Matrícula</th>
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
        </div>
      )}

      {naoLancados.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-bold text-gray-900">❌ Não lançados no sistema ({naoLancados.length})</h2>
            <p className="text-xs text-gray-400">Use o Excel pra conferir/lançar em lote — clique em &quot;Baixar Excel&quot; acima</p>
          </div>
          <div className="overflow-x-auto">
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
                    <td className="px-3 py-2 text-sm text-gray-600">{registroDaMatricula(l.sesmt.matriculaRaw)}</td>
                    <td className="px-3 py-2 text-sm text-gray-600">{formatarDataBr(l.sesmt.dataInicio)}</td>
                    <td className="px-3 py-2 text-sm text-gray-600">{formatarDataBr(l.sesmt.dataRetorno)}</td>
                    <td className="px-3 py-2 text-sm text-gray-600">{l.sesmt.cidTexto}</td>
                    <td className="px-3 py-2 text-sm text-gray-600">{l.sesmt.motivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {ambiguosOuSemSesmt.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-bold text-gray-900">ℹ️ Ambíguos / Sem registro no SESMT ({ambiguosOuSemSesmt.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-widest text-gray-500">
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Funcionário</th>
                  <th className="px-3 py-2">Matrícula</th>
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
                      {l.status === 'ambiguo' ? registroDaMatricula(l.sesmt.matriculaRaw) : l.sistema.registro}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600">
                      {l.status === 'ambiguo'
                        ? `${l.candidatos.length} atestados candidatos no sistema (${l.candidatos.map(c => `${formatarDataBr(c.dataInicio)}→${formatarDataBr(c.dataFim)}`).join(', ')})`
                        : `${formatarDataBr(l.sistema.dataInicio)} → ${formatarDataBr(l.sistema.dataFim)}${l.sistema.cidCodigo ? ` (${l.sistema.cidCodigo})` : ''}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {conferem.length > 0 && (
        <details className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <summary className="cursor-pointer border-b border-gray-100 px-4 py-3 text-sm font-bold text-gray-900">
            ✅ Conferem ({conferem.length}) — clique para expandir
          </summary>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-widest text-gray-500">
                  <th className="px-3 py-2">Funcionário</th>
                  <th className="px-3 py-2">Matrícula</th>
                  <th className="px-3 py-2">Início</th>
                  <th className="px-3 py-2">Fim</th>
                  <th className="px-3 py-2">CID</th>
                </tr>
              </thead>
              <tbody>
                {conferem.map((l, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-sm text-gray-700">{l.sesmt.nome}</td>
                    <td className="px-3 py-2 text-sm text-gray-600">{registroDaMatricula(l.sesmt.matriculaRaw)}</td>
                    <td className="px-3 py-2 text-sm text-gray-600">{formatarDataBr(l.sistema.dataInicio)}</td>
                    <td className="px-3 py-2 text-sm text-gray-600">{formatarDataBr(l.sistema.dataFim)}</td>
                    <td className="px-3 py-2 text-sm text-gray-600">{l.sistema.cidCodigo ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  )
}
