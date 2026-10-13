'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx-js-style'
import { compararConferenciaRH } from '@/app/(admin)/conferencia-rh/actions'
import { gerarModeloListagemRH } from '@/lib/conferencia-rh/gerar-modelo'
import { ResumoAgregado } from './resumo-agregado'
import { TabelaDivergencias } from './tabela-divergencias'
import type { LinhaRH, ResultadoComparacao } from '@/lib/conferencia-rh/tipos'

function excelDataParaISO(valor: unknown): string | null {
  if (valor == null || valor === '') return null
  if (valor instanceof Date) return valor.toISOString().slice(0, 10)
  return null
}

/** Normaliza rótulo de cabeçalho: sem acento, maiúsculo, espaços colapsados.
 * Assim "FUNÇÃO", "Função" e "FUNCAO" caem no mesmo rótulo. */
function normalizarCabecalho(valor: unknown): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Rótulos aceitos por coluna (já normalizados). A ordem importa em `codigo`:
 * a planilha do RH traz o código do supervisor em "C. CUSTO", e "CONTRATO" = 706
 * (número do contrato, igual em todas as linhas) — por isso "C. CUSTO" vem primeiro.
 * O modelo antigo (gerar-modelo.ts) usa "CONTRATO" como código, então continua funcionando. */
const COLUNAS_LISTAGEM = {
  nome: ['NOME DO FUNCIONARIO', 'NOME'],
  funcao: ['FUNCAO'],
  admissao: ['ADMISSAO'],
  afastado: ['AFASTADO', 'AFASTAMENTO'],
  codigo: ['C. CUSTO', 'CONTRATO'],
} as const

function acharColuna(header: string[], rotulos: readonly string[]): number {
  for (const rotulo of rotulos) {
    const idx = header.indexOf(rotulo)
    if (idx !== -1) return idx
  }
  return -1
}

function parseListagem(file: File): Promise<{ linhas: LinhaRH[]; erro?: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer
        const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
        // Aba "LISTAGEM" (modelo) ou, se não existir, a primeira aba (ex: "Planilha1" do RH).
        const ws = wb.Sheets['LISTAGEM'] ?? wb.Sheets[wb.SheetNames[0]]
        if (!ws) {
          resolve({ linhas: [], erro: 'Nenhuma aba encontrada no arquivo.' })
          return
        }
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as unknown[][]
        // linha 0 = cabeçalho. Colunas localizadas pelo rótulo, não pela posição,
        // então a ordem das colunas pode variar entre planilhas do RH.
        const header = (raw[0] ?? []).map(normalizarCabecalho)
        // Coluna A é só o identificador único (RE/matrícula/código) — o rótulo varia
        // conforme quem editou a planilha, então só exigimos que não esteja vazia.
        const colunaAValida = header[0] != null && header[0] !== ''
        const colNome = acharColuna(header, COLUNAS_LISTAGEM.nome)
        const colFuncao = acharColuna(header, COLUNAS_LISTAGEM.funcao)
        const colAdmissao = acharColuna(header, COLUNAS_LISTAGEM.admissao)
        const colAfastado = acharColuna(header, COLUNAS_LISTAGEM.afastado)
        const colCodigo = acharColuna(header, COLUNAS_LISTAGEM.codigo)
        if (!colunaAValida || colNome === -1 || colFuncao === -1 || colAdmissao === -1 || colAfastado === -1 || colCodigo === -1) {
          resolve({
            linhas: [],
            erro: 'Cabeçalho inesperado — confirme que a planilha tem as colunas [identificador/RE], NOME, FUNÇÃO, ADMISSÃO, AFASTAMENTO e C. CUSTO (ou CONTRATO).',
          })
          return
        }
        const linhas: LinhaRH[] = []
        for (const row of raw.slice(1)) {
          const re = row[0]
          const nome = row[colNome]
          if (re == null || nome == null || String(nome).trim() === '') continue
          linhas.push({
            re: String(re).trim(),
            nome: String(nome).trim(),
            funcao: String(row[colFuncao] ?? '').trim(),
            admissao: excelDataParaISO(row[colAdmissao]),
            afastadoEm: excelDataParaISO(row[colAfastado]),
            codigoSupervisor: Number(row[colCodigo]) || 0,
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
        <div className="mb-2 flex items-center justify-between">
          <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500">
            Planilha do RH (.xlsx, aba LISTAGEM)
          </label>
          <button
            type="button"
            onClick={() => gerarModeloListagemRH()}
            className="text-xs font-medium text-slate-600 underline hover:text-slate-900"
          >
            Baixar modelo
          </button>
        </div>
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

      {resultado && (
        <>
          {resultado.codigosSemSupervisorVinculado.length > 0 && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Códigos do RH sem supervisor vinculado na configuração: {resultado.codigosSemSupervisorVinculado.join(', ')}.
              A comparação seguiu, mas vincule-os na seção &quot;Configuração de Códigos&quot; abaixo pra conferir o supervisor corretamente.
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
