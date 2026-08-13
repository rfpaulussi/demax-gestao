'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx-js-style'
import { compararConferenciaRH } from '@/app/(admin)/conferencia-rh/actions'
import { ResumoAgregado } from './resumo-agregado'
import { TabelaDivergencias } from './tabela-divergencias'
import type { LinhaRH, ResultadoComparacao } from '@/lib/conferencia-rh/tipos'

function excelDataParaISO(valor: unknown): string | null {
  if (valor == null || valor === '') return null
  if (valor instanceof Date) return valor.toISOString().slice(0, 10)
  return null
}

function parseListagem(file: File): Promise<{ linhas: LinhaRH[]; erro?: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer
        const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
        const ws = wb.Sheets['LISTAGEM']
        if (!ws) {
          resolve({ linhas: [], erro: 'Aba "LISTAGEM" não encontrada no arquivo.' })
          return
        }
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as unknown[][]
        // linha 0 = cabeçalho: RE, NOME DO FUNCIONARIO, FUNCAO, ADMISSAO, AFASTADO, CONTRATO, ..., NUM
        const linhas: LinhaRH[] = []
        for (const row of raw.slice(1)) {
          const re = row[0]
          const nome = row[1]
          if (re == null || nome == null || String(nome).trim() === '') continue
          linhas.push({
            re: String(re).trim(),
            nome: String(nome).trim(),
            funcao: String(row[2] ?? '').trim(),
            admissao: excelDataParaISO(row[3]),
            afastadoEm: excelDataParaISO(row[4]),
            codigoSupervisor: Number(row[5]) || 0,
          })
        }
        resolve({ linhas })
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

export function UploadForm({ supervisoresApelidos }: { supervisoresApelidos: string[] }) {
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoComparacao | null>(null)
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null)

  async function onFile(file: File) {
    setCarregando(true)
    setErro(null)
    setResultado(null)
    setNomeArquivo(file.name)
    try {
      const { linhas, erro: erroParse } = await parseListagem(file)
      if (erroParse) { setErro(erroParse); return }
      if (linhas.length === 0) { setErro('Nenhuma linha válida encontrada na aba LISTAGEM.'); return }

      const res = await compararConferenciaRH(linhas)
      if ('erro' in res) { setErro(res.erro); return }
      setResultado(res)
    } catch {
      setErro('Falha ao ler o arquivo. Confirme que é um .xlsx válido.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-gray-500">
          Planilha do RH (.xlsx, aba LISTAGEM)
        </label>
        <input
          type="file"
          accept=".xlsx"
          onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }}
          className="text-sm"
        />
        {nomeArquivo && <p className="mt-2 text-xs text-gray-400">Arquivo: {nomeArquivo}</p>}
        {carregando && <p className="mt-2 text-xs text-gray-500">Comparando...</p>}
        {erro && <p className="mt-2 text-xs font-medium text-red-600">{erro}</p>}
      </div>

      {resultado && (
        <>
          {resultado.codigosSemSupervisorVinculado.length > 0 && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Códigos do RH sem supervisor vinculado na configuração: {resultado.codigosSemSupervisorVinculado.join(', ')}.
              A comparação seguiu, mas vincule-os na seção "Configuração de Códigos" abaixo pra conferir o supervisor corretamente.
            </p>
          )}
          {resultado.linhasIgnoradas > 0 && (
            <p className="text-xs text-gray-400">{resultado.linhasIgnoradas} linha(s) da planilha ignorada(s) por falta de RE ou nome.</p>
          )}
          <ResumoAgregado linhas={resultado.resumo} totalGeral={resultado.totalGeral} supervisores={supervisoresApelidos} />
          <TabelaDivergencias divergencias={resultado.divergencias} />
        </>
      )}
    </div>
  )
}
