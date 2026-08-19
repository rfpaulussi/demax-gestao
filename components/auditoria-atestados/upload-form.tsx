// components/auditoria-atestados/upload-form.tsx
'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx-js-style'
import { auditarSesmt } from '@/app/(admin)/auditoria-atestados/actions'
import { dataBrParaIso } from '@/lib/auditoria-atestados/parse'
import { TabelaResultado } from './tabela-resultado'
import type { LinhaSesmt } from '@/lib/auditoria-atestados/tipos'
import type { ResultadoAuditoria } from '@/lib/auditoria-atestados/tipos'

const COLUNAS_ESPERADAS = ['Data', 'Matrícula', 'Empregado', 'Afastamento', 'Motivo', 'CID Abonado', 'Data Retorno']

function celulaParaDataIso(valor: unknown): string | null {
  if (valor == null || valor === '') return null
  if (valor instanceof Date) {
    const y = valor.getFullYear()
    const m = String(valor.getMonth() + 1).padStart(2, '0')
    const d = String(valor.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return dataBrParaIso(String(valor))
}

function parseArquivoSesmt(file: File): Promise<{ linhas: LinhaSesmt[]; linhasIgnoradas: number; erro?: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const buffer = e.target?.result as ArrayBuffer
        const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
        const ws = wb.Sheets[wb.SheetNames[0]]
        if (!ws) {
          resolve({ linhas: [], linhasIgnoradas: 0, erro: 'Planilha vazia ou sem abas.' })
          return
        }
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as unknown[][]
        const header = (raw[0] ?? []).map(h => String(h ?? '').trim())
        const indices = COLUNAS_ESPERADAS.map(c => header.indexOf(c))
        if (indices.some(i => i === -1)) {
          resolve({
            linhas: [],
            linhasIgnoradas: 0,
            erro: `Cabeçalho inesperado. Colunas obrigatórias: ${COLUNAS_ESPERADAS.join(', ')}.`,
          })
          return
        }
        const [iData, iMatricula, iEmpregado, iAfastamento, iMotivo, iCid, iRetorno] = indices

        const linhas: LinhaSesmt[] = []
        let linhasIgnoradas = 0
        for (const row of raw.slice(1)) {
          const matriculaRaw = row[iMatricula]
          if (matriculaRaw == null || String(matriculaRaw).trim() === '') { linhasIgnoradas++; continue }
          const dataInicio = celulaParaDataIso(row[iData])
          const dataRetorno = celulaParaDataIso(row[iRetorno])
          if (!dataInicio || !dataRetorno) { linhasIgnoradas++; continue }
          linhas.push({
            matriculaRaw: String(matriculaRaw).trim(),
            nome: String(row[iEmpregado] ?? '').trim(),
            dataInicio,
            diasTexto: String(row[iAfastamento] ?? '').trim(),
            motivo: String(row[iMotivo] ?? '').trim(),
            cidTexto: String(row[iCid] ?? '').trim(),
            dataRetorno,
          })
        }
        resolve({ linhas, linhasIgnoradas })
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

export function UploadForm() {
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoAuditoria | null>(null)
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null)
  const [linhasIgnoradas, setLinhasIgnoradas] = useState(0)

  async function onFile(file: File) {
    setCarregando(true)
    setErro(null)
    setResultado(null)
    setNomeArquivo(file.name)
    setLinhasIgnoradas(0)
    try {
      const { linhas, linhasIgnoradas: ignoradas, erro: erroParse } = await parseArquivoSesmt(file)
      setLinhasIgnoradas(ignoradas)
      if (erroParse) { setErro(erroParse); return }
      if (linhas.length === 0) { setErro('Nenhuma linha válida encontrada na planilha.'); return }

      const res = await auditarSesmt(linhas)
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
          Planilha do SESMT (.xlsx)
        </label>
        <input
          type="file"
          accept=".xlsx"
          onChange={e => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) onFile(f)
          }}
          className="text-sm"
        />
        {nomeArquivo && <p className="mt-2 text-xs text-gray-400">Arquivo: {nomeArquivo}</p>}
        {carregando && <p className="mt-2 text-xs text-gray-500">Comparando...</p>}
        {erro && <p className="mt-2 text-xs font-medium text-red-600">{erro}</p>}
      </div>

      {linhasIgnoradas > 0 && (
        <p className="text-xs text-gray-400">{linhasIgnoradas} linha(s) da planilha ignorada(s) por matrícula ausente ou data inválida.</p>
      )}

      {resultado && <TabelaResultado resultado={resultado} />}
    </div>
  )
}
