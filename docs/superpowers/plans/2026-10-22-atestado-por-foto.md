# Atestado por foto — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Botão "Lançar por foto" em Atestados: a IA lê a foto do atestado, o sistema acha o funcionário (com pergunta de nome parecido quando não há certeza) e abre o formulário de atestado já preenchido.

**Architecture:** Lógica pura e testada em `lib/atestados/leitura/` (nomes, casamento, normalização, schema da IA). Uma rota `POST /api/atestados/ler` junta IA + casamento + normalização e devolve JSON sem CPF. Um componente cliente conduz foto → "Quem é o funcionário?" → `ModalAtestado` existente, que ganha só a prop `inicial`. O salvamento continua sendo `registrarAtestado`, com todas as regras atuais.

**Tech Stack:** Next.js 14 App Router, TypeScript, `@anthropic-ai/sdk` (Haiku 4.5, ferramenta forçada), Supabase, Vitest (`lib/**/*.test.ts`), Tailwind, `@base-ui/react` Dialog.

**Spec:** `docs/superpowers/specs/2026-10-22-atestado-por-foto-design.md`

**Regras do projeto que valem em todas as tarefas** (CLAUDE.md): `createClient()` é síncrono (nunca `await createClient()`); CPF nunca aparece completo em tela; rodar `npx tsc --noEmit` e `npm run build` ao final; **nunca `git push` sem confirmação do usuário**; `git add` só dos arquivos da tarefa (a pasta tem arquivos de outras tarefas não rastreados).

**Diferença deliberada em relação ao spec:** o schema da IA **não** traz campos `confianca_*`. No teste de viabilidade a IA marcou "baixa" onde acertou e "alta" onde errou; os avisos amarelos saem só das regras determinísticas (data assumida da emissão, faixa de datas, CID ausente/fora da referência). O campo `observacao` da IA continua, como dica ao supervisor.

---

## Estrutura de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `lib/atestados/leitura/tipos.ts` | criar | Tipos compartilhados (leitura, preenchimento, resposta da rota) |
| `lib/atestados/leitura/nomes.ts` | criar | Normalizar nome, distância de edição, similaridade |
| `lib/atestados/leitura/nomes.test.ts` | criar | Testes de `nomes.ts` |
| `lib/atestados/leitura/casar-funcionario.ts` | criar | Nome/CPF/mãe → candidatos com nota; busca manual |
| `lib/atestados/leitura/casar-funcionario.test.ts` | criar | Testes do casamento (nomes fictícios) |
| `lib/atestados/leitura/normalizar.ts` | criar | Datas, CID, avisos amarelos → `Preenchimento` |
| `lib/atestados/leitura/normalizar.test.ts` | criar | Testes de `normalizar.ts` |
| `lib/atestados/leitura/schema.ts` | criar | Ferramenta da IA + leitura defensiva da resposta |
| `lib/atestados/leitura/schema.test.ts` | criar | Testes da leitura defensiva |
| `lib/atestados/leitura/prompt.ts` | criar | Instruções do sistema para a IA |
| `lib/atestados/leitura/ler.ts` | criar | Chama a IA com imagem/PDF e devolve `LeituraAtestado` |
| `lib/atestados/leitura/funcionarios-visiveis.ts` | criar | Funcionários que o usuário pode ver (escopo de supervisor) |
| `lib/atestados/leitura/reduzir-imagem.ts` | criar | Reduz a foto no navegador (canvas) |
| `lib/acordos/ia/cliente.ts` | modificar | `chamarFerramenta` aceita blocos de imagem/PDF |
| `app/api/atestados/ler/route.ts` | criar | Endpoint de leitura |
| `app/(admin)/atestados/actions.ts` | modificar | Action `buscarFuncionariosParaAtestado` (busca manual) |
| `components/efetivo/modal-atestado.tsx` | modificar | Props `inicial` e destaque amarelo; tipo do funcionário mais estreito |
| `components/atestados/atestado-por-foto.tsx` | criar | Botão + fluxo foto → quem é → modal |
| `app/(admin)/atestados/page.tsx` | modificar | Coloca o botão no cabeçalho |

---

### Task 1: Tipos compartilhados

**Files:**
- Create: `lib/atestados/leitura/tipos.ts`

- [ ] **Step 1: Criar os tipos**

```ts
import type { CandidatoFuncionario } from './casar-funcionario'

/** O que a IA leu do papel, já validado por `lerExtracaoAtestado`. */
export interface LeituraAtestado {
  tipoDocumento: 'atestado_medico' | 'outro'
  pacienteNome: string | null
  /** Só dígitos (11). Usado apenas para casar com o cadastro; nunca sai do servidor. */
  pacienteCpf: string | null
  pacienteMenor: boolean | null
  maeNome: string | null
  /** AAAA-MM-DD */
  dataInicio: string | null
  origemDataInicio: 'explicita' | 'emissao' | null
  dias: number | null
  /** Como está impresso no papel (ex.: "J399"). Normalizado depois. */
  cid: string | null
  observacao: string | null
}

/** Aviso por campo; `null` = sem aviso. Os campos com aviso ficam em amarelo no modal. */
export interface AvisosPreenchimento {
  dataInicio: string | null
  dias: string | null
  cid: string | null
}

/** Valores iniciais do modal "Registrar Atestado". Strings vazias = não preencher. */
export interface Preenchimento {
  dataInicio: string
  dias: string
  dataFim: string
  cidCodigo: string
  avisos: AvisosPreenchimento
}

export interface DocumentoLido {
  tipo: 'atestado_medico' | 'outro'
  observacao: string | null
  pacienteNome: string | null
  pacienteMenor: boolean | null
  maeNome: string | null
}

export type RespostaLeitura =
  | {
      ok: true
      documento: DocumentoLido
      preenchimento: Preenchimento
      candidatos: CandidatoFuncionario[]
      /** id do candidato pré-selecionado (nota alta e folga sobre o segundo), ou null. */
      automatico: string | null
    }
  | { ok: false; erro: string }
```

- [ ] **Step 2: Commit** (o arquivo importa `./casar-funcionario`, criado na Task 3; o type-check só passa depois dela — commitar junto com a Task 3)

Não commitar ainda. Seguir para a Task 2.

---

### Task 2: Utilitários de nome (TDD)

**Files:**
- Create: `lib/atestados/leitura/nomes.ts`
- Test: `lib/atestados/leitura/nomes.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

`lib/atestados/leitura/nomes.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { normalizarNome, partesDoNome, distanciaEdicao, similaridadeNomes } from './nomes'

describe('normalizarNome', () => {
  it('tira acento, caixa e pontuação', () => {
    expect(normalizarNome("  Conceição  d'Ávila-Silva ")).toBe('CONCEICAO D AVILA SILVA')
  })
})

describe('partesDoNome', () => {
  it('ignora as ligações DE, DA, DO, DAS, DOS e E', () => {
    expect(partesDoNome('Maria da Silva e Souza dos Santos')).toEqual(['MARIA', 'SILVA', 'SOUZA', 'SANTOS'])
  })
})

describe('distanciaEdicao', () => {
  it('conta trocas, inserções e remoções', () => {
    expect(distanciaEdicao('ROSALINA', 'ROSALIMA')).toBe(1)
    expect(distanciaEdicao('ANA', 'ANA')).toBe(0)
    expect(distanciaEdicao('', 'ABC')).toBe(3)
  })
})

describe('similaridadeNomes', () => {
  it('dá 1 para nomes iguais, ignorando acento e caixa', () => {
    expect(similaridadeNomes('Ana Paula Souza', 'ANA PAULA SOUZA')).toBe(1)
    expect(similaridadeNomes('Conceição Lima', 'CONCEICAO LIMA')).toBe(1)
  })
  it('tolera uma letra trocada numa parte do nome', () => {
    expect(similaridadeNomes('MARCELA ROSALINA SOARES', 'MARCELA ROSALIMA SOARES')).toBeGreaterThan(0.95)
  })
  it('nome do meio omitido fica em 0,8', () => {
    expect(similaridadeNomes('FERNANDA COSTA', 'FERNANDA OLIVEIRA DA COSTA')).toBeCloseTo(0.8, 5)
  })
  it('dá 0 para nomes sem relação e para vazio', () => {
    expect(similaridadeNomes('JOAO SILVA', 'MARIA SOUSA')).toBe(0)
    expect(similaridadeNomes('', 'ANA')).toBe(0)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/atestados/leitura/nomes.test.ts`
Expected: FAIL — "Failed to resolve import './nomes'".

- [ ] **Step 3: Implementar**

`lib/atestados/leitura/nomes.ts`:

```ts
const LIGACOES = new Set(['DE', 'DA', 'DO', 'DAS', 'DOS', 'E'])

/** Sem acento, maiúsculas, só letras e espaço simples. */
export function normalizarNome(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Partes do nome sem as ligações (DE, DA, DO...). */
export function partesDoNome(s: string): string[] {
  return normalizarNome(s).split(' ').filter(p => p !== '' && !LIGACOES.has(p))
}

/** Distância de Levenshtein. */
export function distanciaEdicao(a: string, b: string): number {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  let anterior = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const atual = [i]
    for (let j = 1; j <= b.length; j++) {
      atual[j] = Math.min(
        anterior[j] + 1,
        atual[j - 1] + 1,
        anterior[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    anterior = atual
  }
  return anterior[b.length]
}

function similaridadeParte(a: string, b: string): number {
  return 1 - distanciaEdicao(a, b) / Math.max(a.length, b.length)
}

/**
 * 0 a 1. Cada parte do nome mais curto procura a parte mais parecida do outro (vale com ≥ 0,8, ou seja,
 * tolera 1 letra trocada em parte de 5+ letras). Nota = 2 × soma / (partes de A + partes de B).
 */
export function similaridadeNomes(a: string, b: string): number {
  const pa = partesDoNome(a)
  const pb = partesDoNome(b)
  if (pa.length === 0 || pb.length === 0) return 0
  const [curta, longa] = pa.length <= pb.length ? [pa, pb] : [pb, pa]
  const usadas = new Set<number>()
  let soma = 0
  for (const parte of curta) {
    let melhor = 0
    let indice = -1
    longa.forEach((outra, i) => {
      if (usadas.has(i)) return
      const s = similaridadeParte(parte, outra)
      if (s > melhor) { melhor = s; indice = i }
    })
    if (indice >= 0 && melhor >= 0.8) { usadas.add(indice); soma += melhor }
  }
  return (2 * soma) / (pa.length + pb.length)
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/atestados/leitura/nomes.test.ts`
Expected: PASS (4 describes, 8 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/atestados/leitura/nomes.ts lib/atestados/leitura/nomes.test.ts
git commit -m "feat(atestados): similaridade aproximada de nomes" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Casamento com o cadastro (TDD)

**Files:**
- Create: `lib/atestados/leitura/casar-funcionario.ts`
- Test: `lib/atestados/leitura/casar-funcionario.test.ts`
- Commit junto: `lib/atestados/leitura/tipos.ts` (Task 1)

- [ ] **Step 1: Escrever o teste que falha** (nomes e CPF **fictícios**; `529.982.247-25` é CPF de exemplo válido usado nos testes da admissão)

`lib/atestados/leitura/casar-funcionario.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { casarFuncionarios, buscarPorNome, type FuncionarioParaCasar } from './casar-funcionario'

const f = (id: string, nome: string, extra: Partial<FuncionarioParaCasar> = {}): FuncionarioParaCasar => ({
  id, nome, cpf: null, postoId: `posto-${id}`, postoNome: 'EM TESTE', funcaoNome: 'AUXILIAR DE LIMPEZA', status: 'ativo', ...extra,
})

const entrada = (nome: string | null, extra = {}) => ({
  pacienteNome: nome, pacienteCpf: null, pacienteMenor: false, maeNome: null, ...extra,
})

const base = [
  f('1', 'ANA PAULA FERREIRA LIMA', { cpf: '529.982.247-25' }),
  f('3', 'CARLOS EDUARDO MOURA'),
  f('4', 'BEATRIZ HELENA ROCHA', { status: 'desligado' }),
  f('5', 'FERNANDA OLIVEIRA DA COSTA'),
]

describe('casarFuncionarios', () => {
  it('acha por nome exato ignorando acento e caixa, e pré-seleciona', () => {
    const r = casarFuncionarios(entrada('Carlos Eduardo Móura'), base)
    expect(r.candidatos[0].id).toBe('3')
    expect(r.automatico).toBe('3')
  })

  it('tolera uma letra trocada e ainda pré-seleciona', () => {
    const r = casarFuncionarios(entrada('CARLOS EDUARDO MOURRA'), base)
    expect(r.candidatos[0].id).toBe('3')
    expect(r.automatico).toBe('3')
  })

  it('nome do meio omitido vira lista, sem pré-seleção', () => {
    const r = casarFuncionarios(entrada('FERNANDA COSTA'), base)
    expect(r.candidatos.map(c => c.id)).toEqual(['5'])
    expect(r.automatico).toBeNull()
  })

  it('ignora desligado', () => {
    const r = casarFuncionarios(entrada('BEATRIZ HELENA ROCHA'), base)
    expect(r.candidatos).toEqual([])
    expect(r.automatico).toBeNull()
  })

  it('homônimos: lista os dois, sem pré-seleção', () => {
    const lista = [f('1', 'ANA PAULA FERREIRA LIMA'), f('2', 'ANA PAULA FERREIRA LIMA')]
    const r = casarFuncionarios(entrada('ANA PAULA FERREIRA LIMA'), lista)
    expect(r.candidatos).toHaveLength(2)
    expect(r.automatico).toBeNull()
  })

  it('CPF desempata homônimos', () => {
    const lista = [f('1', 'ANA PAULA FERREIRA LIMA', { cpf: '52998224725' }), f('2', 'ANA PAULA FERREIRA LIMA')]
    const r = casarFuncionarios(entrada('ANA PAULA FERREIRA LIMA', { pacienteCpf: '52998224725' }), lista)
    expect(r.automatico).toBe('1')
  })

  it('menor de idade: procura pela mãe e nunca pré-seleciona', () => {
    const r = casarFuncionarios(
      entrada('LUCAS PEREIRA DA SILVA NETO', { pacienteMenor: true, maeNome: 'Fernanda Oliveira da Costa' }),
      base,
    )
    expect(r.candidatos[0]).toMatchObject({ id: '5', viaMae: true })
    expect(r.automatico).toBeNull()
  })

  it('sem nome nenhum devolve vazio', () => {
    expect(casarFuncionarios(entrada(null), base)).toEqual({ candidatos: [], automatico: null })
  })

  it('não devolve o CPF do cadastro', () => {
    const r = casarFuncionarios(entrada('ANA PAULA FERREIRA LIMA'), base)
    expect(JSON.stringify(r)).not.toContain('52998224725')
    expect(JSON.stringify(r)).not.toContain('529.982')
  })
})

describe('buscarPorNome', () => {
  it('acha por pedaço do nome', () => {
    expect(buscarPorNome('eduardo', base).map(c => c.id)).toEqual(['3'])
  })
  it('exige 3 letras ou mais', () => {
    expect(buscarPorNome('ca', base)).toEqual([])
  })
  it('não traz desligado', () => {
    expect(buscarPorNome('beatriz', base)).toEqual([])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/atestados/leitura/casar-funcionario.test.ts`
Expected: FAIL — "Failed to resolve import './casar-funcionario'".

- [ ] **Step 3: Implementar**

`lib/atestados/leitura/casar-funcionario.ts`:

```ts
import { apenasDigitos } from '@/lib/admissao/cpf'
import { normalizarNome, similaridadeNomes } from './nomes'

export interface FuncionarioParaCasar {
  id: string
  nome: string
  /** Só para comparar; nunca é devolvido. */
  cpf: string | null
  postoId: string | null
  postoNome: string | null
  funcaoNome: string | null
  status: string | null
}

export interface CandidatoFuncionario {
  id: string
  nome: string
  postoId: string | null
  postoNome: string | null
  funcaoNome: string | null
  status: string | null
  /** 0 a 1 */
  nota: number
  /** Achado pelo nome da mãe (atestado de menor). */
  viaMae: boolean
}

export interface EntradaCasamento {
  pacienteNome: string | null
  pacienteCpf: string | null
  pacienteMenor: boolean | null
  maeNome: string | null
}

export interface ResultadoCasamento {
  candidatos: CandidatoFuncionario[]
  /** id pré-selecionado, ou null quando o supervisor precisa escolher. */
  automatico: string | null
}

export const NOTA_MINIMA = 0.55
export const NOTA_AUTOMATICA = 0.9
export const VANTAGEM_AUTOMATICA = 0.08
export const MAX_CANDIDATOS = 5

function paraCandidato(f: FuncionarioParaCasar, nota: number, viaMae: boolean): CandidatoFuncionario {
  return {
    id: f.id, nome: f.nome, postoId: f.postoId, postoNome: f.postoNome, funcaoNome: f.funcaoNome,
    status: f.status, nota, viaMae,
  }
}

const porNota = (a: CandidatoFuncionario, b: CandidatoFuncionario) => b.nota - a.nota || a.nome.localeCompare(b.nome)

export function casarFuncionarios(entrada: EntradaCasamento, funcionarios: FuncionarioParaCasar[]): ResultadoCasamento {
  const menor = entrada.pacienteMenor === true
  const cpf = apenasDigitos(entrada.pacienteCpf ?? '')
  const usarCpf = !menor && cpf.length === 11
  const acertosCpf = new Set<string>()
  const candidatos: CandidatoFuncionario[] = []

  for (const f of funcionarios) {
    if (f.status === 'desligado') continue
    if (usarCpf && apenasDigitos(f.cpf ?? '') === cpf) {
      acertosCpf.add(f.id)
      candidatos.push(paraCandidato(f, 1, false))
      continue
    }
    let nota = entrada.pacienteNome ? similaridadeNomes(entrada.pacienteNome, f.nome) : 0
    let viaMae = false
    if (menor && entrada.maeNome) {
      const notaMae = similaridadeNomes(entrada.maeNome, f.nome)
      if (notaMae > nota) { nota = notaMae; viaMae = true }
    }
    // Só o CPF chega a 1: nome igual vale no máximo 0,99.
    if (nota >= NOTA_MINIMA) candidatos.push(paraCandidato(f, Math.min(nota, 0.99), viaMae))
  }

  candidatos.sort(porNota)
  const lista = candidatos.slice(0, MAX_CANDIDATOS)

  let automatico: string | null = null
  if (acertosCpf.size === 1) {
    automatico = Array.from(acertosCpf)[0]
  } else if (!menor && lista[0] && lista[0].nota >= NOTA_AUTOMATICA && (!lista[1] || lista[0].nota - lista[1].nota >= VANTAGEM_AUTOMATICA)) {
    automatico = lista[0].id
  }
  return { candidatos: lista, automatico }
}

/** Busca manual: pedaço do nome (3+ letras) ou nome parecido. */
export function buscarPorNome(termo: string, funcionarios: FuncionarioParaCasar[], limite = 15): CandidatoFuncionario[] {
  const t = normalizarNome(termo)
  if (t.length < 3) return []
  return funcionarios
    .filter(f => f.status !== 'desligado')
    .map(f => paraCandidato(f, normalizarNome(f.nome).includes(t) ? 1 : similaridadeNomes(termo, f.nome), false))
    .filter(c => c.nota >= NOTA_MINIMA)
    .sort(porNota)
    .slice(0, limite)
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/atestados/leitura/casar-funcionario.test.ts lib/atestados/leitura/nomes.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add lib/atestados/leitura/tipos.ts lib/atestados/leitura/casar-funcionario.ts lib/atestados/leitura/casar-funcionario.test.ts
git commit -m "feat(atestados): casa o nome lido no atestado com o cadastro" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Normalização de datas, CID e avisos (TDD)

**Files:**
- Create: `lib/atestados/leitura/normalizar.ts`
- Test: `lib/atestados/leitura/normalizar.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

`lib/atestados/leitura/normalizar.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { dataValida, somarDias, diferencaDias, normalizarCid, prepararPreenchimento } from './normalizar'
import type { LeituraAtestado } from './tipos'

const HOJE = '2026-10-22'

const leitura = (extra: Partial<LeituraAtestado> = {}): LeituraAtestado => ({
  tipoDocumento: 'atestado_medico', pacienteNome: 'ANA TESTE', pacienteCpf: null, pacienteMenor: false, maeNome: null,
  dataInicio: '2026-10-21', origemDataInicio: 'explicita', dias: 2, cid: 'R11', observacao: null, ...extra,
})

describe('datas', () => {
  it('dataValida confere formato e calendário', () => {
    expect(dataValida('2026-10-22')).toBe(true)
    expect(dataValida('2026-02-30')).toBe(false)
    expect(dataValida('22/10/2026')).toBe(false)
    expect(dataValida(null)).toBe(false)
  })
  it('somarDias atravessa mês e ano', () => {
    expect(somarDias('2026-10-30', 2)).toBe('2026-11-01')
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(somarDias('2026-10-22', 0)).toBe('2026-10-22')
  })
  it('diferencaDias é B − A em dias', () => {
    expect(diferencaDias('2026-10-20', '2026-10-22')).toBe(2)
    expect(diferencaDias('2026-10-22', '2026-10-20')).toBe(-2)
  })
})

describe('normalizarCid', () => {
  const ref = new Set(['J39', 'A09', 'I51.7', 'R11', 'S50', 'M45'])
  it('põe o ponto e acha exato', () => {
    expect(normalizarCid('I517', ref)).toEqual({ codigo: 'I51.7', lido: 'I51.7', aproximado: false })
    expect(normalizarCid('a09', ref)).toEqual({ codigo: 'A09', lido: 'A09', aproximado: false })
  })
  it('ignora espaço dentro do código', () => {
    expect(normalizarCid('S 50', ref)).toEqual({ codigo: 'S50', lido: 'S50', aproximado: false })
  })
  it('cai na categoria quando a subcategoria não está na referência', () => {
    expect(normalizarCid('J399', ref)).toEqual({ codigo: 'J39', lido: 'J39.9', aproximado: true })
  })
  it('devolve código nulo quando não está na referência nem tem categoria', () => {
    expect(normalizarCid('K80', ref)).toEqual({ codigo: null, lido: 'K80', aproximado: false })
  })
  it('texto que não parece CID fica como lido', () => {
    expect(normalizarCid('XYZ', ref)).toEqual({ codigo: null, lido: 'XYZ', aproximado: false })
    expect(normalizarCid(null, ref)).toEqual({ codigo: null, lido: null, aproximado: false })
  })
})

describe('prepararPreenchimento', () => {
  const ref = new Set(['R11', 'J39'])

  it('caso normal: sem avisos e com data fim = início + dias − 1', () => {
    const p = prepararPreenchimento(leitura(), HOJE, ref)
    expect(p).toEqual({
      dataInicio: '2026-10-21', dias: '2', dataFim: '2026-10-22', cidCodigo: 'R11',
      avisos: { dataInicio: null, dias: null, cid: null },
    })
  })

  it('início assumido da emissão fica com aviso', () => {
    const p = prepararPreenchimento(leitura({ dataInicio: '2026-10-22', origemDataInicio: 'emissao', dias: 30 }), HOJE, ref)
    expect(p.dataFim).toBe('2026-11-20')
    expect(p.avisos.dataInicio).toContain('emissão')
  })

  it('início muito antigo ou muito à frente fica com aviso', () => {
    expect(prepararPreenchimento(leitura({ dataInicio: '2026-07-01' }), HOJE, ref).avisos.dataInicio).toContain('60 dias')
    expect(prepararPreenchimento(leitura({ dataInicio: '2026-12-01' }), HOJE, ref).avisos.dataInicio).toContain('30 dias')
  })

  it('início ilegível: campo vazio, sem data fim e com aviso', () => {
    const p = prepararPreenchimento(leitura({ dataInicio: null, origemDataInicio: null }), HOJE, ref)
    expect(p.dataInicio).toBe('')
    expect(p.dataFim).toBe('')
    expect(p.avisos.dataInicio).toContain('Não consegui ler')
  })

  it('dias fora de 1 a 365 ou ausente: vazio, sem data fim e com aviso', () => {
    for (const dias of [0, 400, null]) {
      const p = prepararPreenchimento(leitura({ dias }), HOJE, ref)
      expect(p.dias).toBe('')
      expect(p.dataFim).toBe('')
      expect(p.avisos.dias).toContain('Não consegui ler')
    }
  })

  it('sem CID no papel: campo vazio e aviso, nunca "sem CID" automático', () => {
    const p = prepararPreenchimento(leitura({ cid: null }), HOJE, ref)
    expect(p.cidCodigo).toBe('')
    expect(p.avisos.cid).toContain('Não achei CID')
  })

  it('CID aproximado pela categoria avisa qual foi lido', () => {
    const p = prepararPreenchimento(leitura({ cid: 'J399' }), HOJE, ref)
    expect(p.cidCodigo).toBe('J39')
    expect(p.avisos.cid).toContain('J39.9')
  })

  it('CID fora da referência: vazio e aviso com o código lido', () => {
    const p = prepararPreenchimento(leitura({ cid: 'K80' }), HOJE, ref)
    expect(p.cidCodigo).toBe('')
    expect(p.avisos.cid).toContain('K80')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/atestados/leitura/normalizar.test.ts`
Expected: FAIL — "Failed to resolve import './normalizar'".

- [ ] **Step 3: Implementar**

`lib/atestados/leitura/normalizar.ts`:

```ts
import type { AvisosPreenchimento, LeituraAtestado, Preenchimento } from './tipos'

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/

export function dataValida(s: string | null | undefined): s is string {
  if (!s) return false
  const m = ISO.exec(s)
  if (!m) return false
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const d = new Date(Date.UTC(ano, mes - 1, dia))
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia
}

function utc(iso: string): number {
  const [a, m, d] = iso.split('-').map(Number)
  return Date.UTC(a, m - 1, d)
}

export function somarDias(iso: string, dias: number): string {
  return new Date(utc(iso) + dias * 86_400_000).toISOString().slice(0, 10)
}

/** B − A, em dias. */
export function diferencaDias(a: string, b: string): number {
  return Math.round((utc(b) - utc(a)) / 86_400_000)
}

export interface ResultadoCid {
  /** Código que existe em `cid_referencia`, ou null. */
  codigo: string | null
  /** Código como entendido (com ponto), para mostrar ao supervisor. */
  lido: string | null
  /** true quando caiu na categoria porque a subcategoria não está na referência. */
  aproximado: boolean
}

/** "J399" → "J39.9"; procura exato e, se não houver, a categoria ("J39"). */
export function normalizarCid(lido: string | null, referencia: ReadonlySet<string>): ResultadoCid {
  if (!lido) return { codigo: null, lido: null, aproximado: false }
  const limpo = lido.replace(/\s+/g, '').toUpperCase()
  const m = /^([A-Z])(\d{2})\.?(\d)?$/.exec(limpo)
  if (!m) return { codigo: null, lido: limpo, aproximado: false }
  const categoria = `${m[1]}${m[2]}`
  const completo = m[3] ? `${categoria}.${m[3]}` : categoria
  if (referencia.has(completo)) return { codigo: completo, lido: completo, aproximado: false }
  if (m[3] && referencia.has(categoria)) return { codigo: categoria, lido: completo, aproximado: true }
  return { codigo: null, lido: completo, aproximado: false }
}

/** Valores iniciais do modal e avisos amarelos. Só regras determinísticas, nada de nota da IA. */
export function prepararPreenchimento(leitura: LeituraAtestado, hoje: string, codigosCid: ReadonlySet<string>): Preenchimento {
  const avisos: AvisosPreenchimento = { dataInicio: null, dias: null, cid: null }

  let dataInicio = ''
  if (dataValida(leitura.dataInicio)) {
    dataInicio = leitura.dataInicio
    const passado = diferencaDias(dataInicio, hoje)
    if (leitura.origemDataInicio === 'emissao') {
      avisos.dataInicio = 'O papel não traz a data de início; usei a data de emissão. Confira.'
    } else if (passado > 60) {
      avisos.dataInicio = 'O início é de mais de 60 dias atrás. Confira a data.'
    } else if (passado < -30) {
      avisos.dataInicio = 'O início é daqui a mais de 30 dias. Confira a data.'
    }
  } else {
    avisos.dataInicio = 'Não consegui ler a data de início.'
  }

  let dias = ''
  if (leitura.dias !== null && Number.isInteger(leitura.dias) && leitura.dias >= 1 && leitura.dias <= 365) {
    dias = String(leitura.dias)
  } else {
    avisos.dias = 'Não consegui ler o número de dias.'
  }

  const dataFim = dataInicio && dias ? somarDias(dataInicio, Number(dias) - 1) : ''

  let cidCodigo = ''
  if (!leitura.cid) {
    avisos.cid = 'Não achei CID no papel. Confira; se não houver, marque "Atestado sem CID".'
  } else {
    const r = normalizarCid(leitura.cid, codigosCid)
    if (r.codigo) {
      cidCodigo = r.codigo
      if (r.aproximado) avisos.cid = `CID lido: ${r.lido}. Usei a categoria ${r.codigo}. Confira.`
    } else {
      avisos.cid = `CID lido: ${r.lido ?? leitura.cid}. Não está na referência; escolha na lista.`
    }
  }

  return { dataInicio, dias, dataFim, cidCodigo, avisos }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/atestados/leitura/normalizar.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/atestados/leitura/normalizar.ts lib/atestados/leitura/normalizar.test.ts
git commit -m "feat(atestados): normaliza datas e CID lidos e monta os avisos" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Ferramenta da IA e leitura defensiva da resposta (TDD)

**Files:**
- Create: `lib/atestados/leitura/schema.ts`
- Test: `lib/atestados/leitura/schema.test.ts`
- Create: `lib/atestados/leitura/prompt.ts`

- [ ] **Step 1: Escrever o teste que falha**

`lib/atestados/leitura/schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { lerExtracaoAtestado } from './schema'

const valido = {
  tipo_documento: 'atestado_medico',
  paciente_nome: ' ANA TESTE ',
  paciente_cpf: '529.982.247-25',
  paciente_menor: false,
  mae_nome: null,
  data_inicio: '2026-10-21',
  origem_data_inicio: 'explicita',
  dias: 2,
  cid: 'R11',
  observacao: null,
}

describe('lerExtracaoAtestado', () => {
  it('lê uma resposta completa e limpa os textos', () => {
    expect(lerExtracaoAtestado(valido)).toEqual({
      tipoDocumento: 'atestado_medico', pacienteNome: 'ANA TESTE', pacienteCpf: '52998224725', pacienteMenor: false,
      maeNome: null, dataInicio: '2026-10-21', origemDataInicio: 'explicita', dias: 2, cid: 'R11', observacao: null,
    })
  })
  it('devolve null quando não é objeto', () => {
    expect(lerExtracaoAtestado(null)).toBeNull()
    expect(lerExtracaoAtestado('texto')).toBeNull()
  })
  it('dias só vale se for inteiro', () => {
    expect(lerExtracaoAtestado({ ...valido, dias: '2' })?.dias).toBeNull()
    expect(lerExtracaoAtestado({ ...valido, dias: 2.5 })?.dias).toBeNull()
  })
  it('data fora do formato AAAA-MM-DD vira null', () => {
    expect(lerExtracaoAtestado({ ...valido, data_inicio: '21/10/2026' })?.dataInicio).toBeNull()
    expect(lerExtracaoAtestado({ ...valido, data_inicio: '2026-02-30' })?.dataInicio).toBeNull()
  })
  it('tipo desconhecido vira "outro"', () => {
    expect(lerExtracaoAtestado({ ...valido, tipo_documento: 'receita' })?.tipoDocumento).toBe('outro')
  })
  it('CPF só vale com 11 dígitos', () => {
    expect(lerExtracaoAtestado({ ...valido, paciente_cpf: '123' })?.pacienteCpf).toBeNull()
  })
  it('texto vazio vira null e menor não-booleano vira null', () => {
    const r = lerExtracaoAtestado({ ...valido, mae_nome: '  ', paciente_menor: 'sim' })
    expect(r?.maeNome).toBeNull()
    expect(r?.pacienteMenor).toBeNull()
  })
  it('origem da data só aceita explicita ou emissao', () => {
    expect(lerExtracaoAtestado({ ...valido, origem_data_inicio: 'chute' })?.origemDataInicio).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/atestados/leitura/schema.test.ts`
Expected: FAIL — "Failed to resolve import './schema'".

- [ ] **Step 3: Implementar o schema**

`lib/atestados/leitura/schema.ts`:

```ts
import { dataValida } from './normalizar'
import type { LeituraAtestado } from './tipos'

export const NOME_FERRAMENTA_ATESTADO = 'preencher_atestado'

const STR = { type: ['string', 'null'] }

/** Definição da ferramenta (tool use): a IA é obrigada a responder neste formato. */
export const FERRAMENTA_ATESTADO = {
  name: NOME_FERRAMENTA_ATESTADO,
  description:
    'Registra os campos lidos de um atestado médico. Preencha só o que está escrito no papel; use null quando não aparece ou está ilegível. Nunca invente.',
  input_schema: {
    type: 'object' as const,
    properties: {
      tipo_documento: { type: 'string', enum: ['atestado_medico', 'outro'] },
      paciente_nome: { ...STR, description: 'Nome do paciente como está no papel.' },
      paciente_cpf: { ...STR, description: 'CPF do paciente, só dígitos.' },
      paciente_menor: { type: ['boolean', 'null'], description: 'true se a idade ou nascimento mostra paciente com menos de 18 anos.' },
      mae_nome: { ...STR, description: 'Nome da mãe, se constar no papel.' },
      data_inicio: { ...STR, description: 'AAAA-MM-DD. Início do afastamento.' },
      origem_data_inicio: { type: ['string', 'null'], enum: ['explicita', 'emissao', null] },
      dias: { type: ['integer', 'null'], description: 'Dias de afastamento, número inteiro.' },
      cid: { ...STR, description: 'Código CID como impresso, em maiúsculas (ex.: J39.9).' },
      observacao: { ...STR, description: 'Algo estranho ou ilegível que o supervisor deva conferir.' },
    },
    required: ['tipo_documento', 'paciente_nome', 'data_inicio', 'dias', 'cid'],
  },
}

const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : null)
const inteiro = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) ? v : null)
const booleano = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null)
const data = (v: unknown): string | null => {
  const t = texto(v)
  return t && dataValida(t) ? t : null
}
const cpf = (v: unknown): string | null => {
  const t = texto(v)
  const digitos = t ? t.replace(/\D/g, '') : ''
  return digitos.length === 11 ? digitos : null
}

/** A resposta da IA não é confiável: valida campo a campo. null = não é nem um objeto. */
export function lerExtracaoAtestado(entrada: unknown): LeituraAtestado | null {
  if (!entrada || typeof entrada !== 'object') return null
  const e = entrada as Record<string, unknown>
  const origem = e.origem_data_inicio
  return {
    tipoDocumento: e.tipo_documento === 'atestado_medico' ? 'atestado_medico' : 'outro',
    pacienteNome: texto(e.paciente_nome),
    pacienteCpf: cpf(e.paciente_cpf),
    pacienteMenor: booleano(e.paciente_menor),
    maeNome: texto(e.mae_nome),
    dataInicio: data(e.data_inicio),
    origemDataInicio: origem === 'explicita' || origem === 'emissao' ? origem : null,
    dias: inteiro(e.dias),
    cid: texto(e.cid),
    observacao: texto(e.observacao),
  }
}
```

- [ ] **Step 4: Escrever o prompt** (versão validada no teste de viabilidade, sem `data_retorno` nem `confianca_*`, com a regra do CID em checkbox)

`lib/atestados/leitura/prompt.ts`:

```ts
/** Instruções do sistema. `hoje` = AAAA-MM-DD (fuso de São Paulo). */
export function promptSistema(hoje: string): string {
  return `Você lê fotos de atestados médicos brasileiros e extrai campos para um sistema de RH.
Regras:
- Copie só o que está escrito no papel. Se um campo não aparece ou está ilegível, devolva null. Nunca invente.
- Datas no formato AAAA-MM-DD. Hoje é ${hoje}.
- "dias": número inteiro. Converta por extenso (UM=1, DOIS=2, TRÊS=3...). Leia "1 dia(s)", "por 2 dia(s)", "4 DIA(S)" e semelhantes.
- "data_inicio": a data a partir da qual o afastamento vale ("a partir de", "início", "a contar de"). Se o papel não traz data de início explícita, use a data de emissão do atestado e marque origem_data_inicio = "emissao"; senão "explicita". Ignore a hora. Não devolva data de retorno.
- "cid": o código como impresso, em maiúsculas (ex.: J39.9 ou J399). Ele pode aparecer sozinho, junto de "CID", ou ao lado de "libera a impressão do CID" / "autorizei mostrar o CID", inclusive numa caixa marcada. Se o papel não mostra nenhum código, null.
- "paciente_menor": true se a idade ou data de nascimento mostra paciente com menos de 18 anos.
- "mae_nome": nome da mãe, só se constar no papel.
- "paciente_cpf": o CPF do paciente, só dígitos, se constar.
- "tipo_documento": "atestado_medico", ou "outro" (declaração de comparecimento, receita, laudo, exame etc.).
- "observacao": algo estranho ou ilegível que quem lança deva conferir (campo cortado, rasura, foto escura). Null se está tudo claro.`
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run lib/atestados/leitura/`
Expected: PASS (nomes, casar-funcionario, normalizar, schema).

- [ ] **Step 6: Commit**

```bash
git add lib/atestados/leitura/schema.ts lib/atestados/leitura/schema.test.ts lib/atestados/leitura/prompt.ts
git commit -m "feat(atestados): ferramenta e prompt da leitura por IA" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Cliente de IA aceita imagem e PDF

**Files:**
- Modify: `lib/acordos/ia/cliente.ts:37-47` (assinatura) e `:56` (mensagem)
- Create: `lib/atestados/leitura/ler.ts`

- [ ] **Step 1: Aceitar blocos de conteúdo em `chamarFerramenta`**

Em `lib/acordos/ia/cliente.ts`, trocar o parâmetro `mensagem: string` por `mensagem: string | Anthropic.ContentBlockParam[]`:

```ts
/** Uma chamada só, sem histórico, forçando a ferramenta dada. Texto já anonimizado; blocos de imagem/PDF não têm como anonimizar. */
export async function chamarFerramenta(
  sistema: string,
  ferramenta: Anthropic.Tool,
  mensagem: string | Anthropic.ContentBlockParam[],
  opcoes: OpcoesChamada = {},
): Promise<RespostaModelo> {
```

O corpo não muda: `messages: [{ role: 'user', content: mensagem }]` já aceita string ou lista de blocos.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros. Se `Anthropic.ContentBlockParam` não existir nesta versão do SDK, usar `Anthropic.Messages.ContentBlockParam` (mesmo tipo).

- [ ] **Step 3: Criar `ler.ts`**

`lib/atestados/leitura/ler.ts`:

```ts
import type Anthropic from '@anthropic-ai/sdk'
import { chamarFerramenta, ErroIA } from '@/lib/acordos/ia/cliente'
import { FERRAMENTA_ATESTADO, lerExtracaoAtestado } from './schema'
import { promptSistema } from './prompt'
import type { LeituraAtestado } from './tipos'

export type TipoArquivoAtestado = 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf'

export interface ResultadoLeitura {
  leitura: LeituraAtestado
  tokensEntrada: number
  tokensSaida: number
}

/**
 * Manda a foto (ou PDF) para a IA e devolve os campos lidos. O arquivo fica só em memória.
 * 45 s sem retry: o tempo total tem que caber nos 60 s de maxDuration da rota.
 */
export async function lerAtestado(base64: string, tipo: TipoArquivoAtestado, hoje: string): Promise<ResultadoLeitura> {
  const arquivo: Anthropic.ContentBlockParam =
    tipo === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
      : { type: 'image', source: { type: 'base64', media_type: tipo, data: base64 } }

  const r = await chamarFerramenta(
    promptSistema(hoje),
    FERRAMENTA_ATESTADO,
    [arquivo, { type: 'text', text: 'Leia este atestado.' }],
    { maxTokens: 800, timeoutMs: 45_000, maxRetries: 0 },
  )
  const leitura = lerExtracaoAtestado(r.entrada)
  if (!leitura) throw new ErroIA('RESPOSTA_INVALIDA', 'A IA não devolveu os campos esperados.')
  return { leitura, tokensEntrada: r.tokensEntrada, tokensSaida: r.tokensSaida }
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add lib/acordos/ia/cliente.ts lib/atestados/leitura/ler.ts
git commit -m "feat(atestados): cliente de IA aceita imagem e PDF e le o atestado" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Validação da leitura com fotos reais (não vai para o git)

Repete o teste de viabilidade agora com o código de verdade (prompt final). Script descartável, apagado no fim.

**Files:**
- Create (temporário, raiz do projeto): `_validar_tmp.ts`

- [ ] **Step 1: Pedir ao usuário uma pasta com as fotos**

Usar a pasta das 7 fotos de teste (`C:\Users\Rodolfo\AppData\Local\Temp\claude\C--Users-Rodolfo-projetos-claude-demax-gestao\d60bad4b-0e3e-4596-a788-a5b2a9e0c25e\images`, arquivos `3.jpg` a `9.jpg`) ou outra que o usuário indicar.

- [ ] **Step 2: Criar o script**

`_validar_tmp.ts`:

```ts
import { readFileSync, readdirSync } from 'node:fs'
import { lerAtestado } from '@/lib/atestados/leitura/ler'
import { prepararPreenchimento } from '@/lib/atestados/leitura/normalizar'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }),
)
process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY

const pasta = process.argv[2]
const referencia = new Set(['A09', 'R11', 'R51', 'S50', 'M45', 'J39', 'I51.7'])

async function main() {
  for (const nome of readdirSync(pasta).filter(n => /\.(jpe?g|png)$/i.test(n))) {
    const tipo = /\.png$/i.test(nome) ? 'image/png' : 'image/jpeg'
    const { leitura, tokensEntrada, tokensSaida } = await lerAtestado(readFileSync(`${pasta}/${nome}`).toString('base64'), tipo, '2026-10-22')
    const preenchimento = prepararPreenchimento(leitura, '2026-10-22', referencia)
    console.log(nome, `(${tokensEntrada}/${tokensSaida})`, JSON.stringify({ ...leitura, pacienteCpf: leitura.pacienteCpf ? '***' : null }), JSON.stringify(preenchimento))
  }
}
main()
```

- [ ] **Step 3: Empacotar e rodar**

Run (Git Bash, na raiz do projeto; `<PASTA>` = a pasta do passo 1):

```bash
npx esbuild _validar_tmp.ts --bundle --platform=node --outfile=_validar_tmp.cjs --tsconfig=tsconfig.json --log-level=error --external:@anthropic-ai/sdk && node _validar_tmp.cjs "<PASTA>"
```

Expected: uma linha por foto. Conferir contra os dados das fotos:
- datas de início e dias corretos nas 7;
- foto da Santa Casa (`S 50`): `cid` agora vem como `S50` (se ainda vier `null`, ajustar o prompt na regra do "cid" e rodar de novo);
- menor de idade: `pacienteMenor: true` e `maeNome` preenchido;
- foto sem data de início: `origemDataInicio: "emissao"` e aviso na data.

- [ ] **Step 4: Apagar os temporários**

```bash
rm -f _validar_tmp.ts _validar_tmp.cjs && git status --short
```

Expected: nenhum `_validar_tmp*` na lista. Se o prompt foi ajustado no passo 3, commitar `lib/atestados/leitura/prompt.ts` com `git commit -m "fix(atestados): ajusta prompt de leitura do CID"`.

---

### Task 8: Funcionários visíveis, rota de leitura e busca manual

**Files:**
- Create: `lib/atestados/leitura/funcionarios-visiveis.ts`
- Create: `app/api/atestados/ler/route.ts`
- Modify: `app/(admin)/atestados/actions.ts` (imports no topo + nova action no fim)

- [ ] **Step 1: Criar o carregador de funcionários do escopo do usuário**

`lib/atestados/leitura/funcionarios-visiveis.ts`:

```ts
import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import type { AuthUser } from '@/lib/auth/get-user'
import type { FuncionarioParaCasar } from './casar-funcionario'

type Linha = {
  id: string
  nome: string
  cpf: string | null
  status: string | null
  posto_id: string | null
  funcoes: { nome: string } | null
  postos: { nome: string } | null
}

/** Funcionários não desligados que o usuário pode ver: admin/coordenador todos; supervisor só os dos postos dele. */
export async function carregarFuncionariosVisiveis(auth: AuthUser): Promise<FuncionarioParaCasar[]> {
  const supabase = createClient()

  let postoIds: string[] | null = null
  if (auth.perfil.role === 'supervisor') {
    const { data } = await supabase
      .from('config_supervisores_postos')
      .select('posto_id')
      .eq('supervisor_id', auth.user.id)
      .eq('ativo', true)
    postoIds = (data ?? []).map(r => r.posto_id as string)
    if (postoIds.length === 0) return []
  }

  const linhas = await fetchAllRows<Linha>((from, to) => {
    let q = supabase
      .from('funcionarios')
      .select('id, nome, cpf, status, posto_id, funcoes!funcao_id(nome), postos!posto_id(nome)')
      .or('status.is.null,status.neq.desligado')
      .order('nome')
      .range(from, to)
    if (postoIds) q = q.in('posto_id', postoIds)
    return q as unknown as PromiseLike<{ data: Linha[] | null; error: { message: string } | null }>
  })

  return linhas.map(l => ({
    id: l.id,
    nome: l.nome,
    cpf: l.cpf,
    postoId: l.posto_id,
    postoNome: l.postos?.nome ?? null,
    funcaoNome: l.funcoes?.nome ?? null,
    status: l.status,
  }))
}
```

- [ ] **Step 2: Criar a rota**

`app/api/atestados/ler/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { getUser } from '@/lib/auth/get-user'
import { createClient } from '@/lib/supabase/server'
import { ErroIA, iaConfigurada } from '@/lib/acordos/ia/cliente'
import { lerAtestado, type TipoArquivoAtestado } from '@/lib/atestados/leitura/ler'
import { prepararPreenchimento } from '@/lib/atestados/leitura/normalizar'
import { casarFuncionarios } from '@/lib/atestados/leitura/casar-funcionario'
import { carregarFuncionariosVisiveis } from '@/lib/atestados/leitura/funcionarios-visiveis'
import type { RespostaLeitura } from '@/lib/atestados/leitura/tipos'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_BYTES = 4 * 1024 * 1024
const TIPOS: readonly string[] = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

const resposta = (corpo: RespostaLeitura, status = 200) => NextResponse.json(corpo, { status })
const falha = (erro: string, status: number) => resposta({ ok: false, erro }, status)

export async function POST(req: Request) {
  const auth = await getUser()
  if (!auth) return falha('Sessão expirada. Entre de novo.', 401)
  if (auth.perfil.role === 'viewer') return falha('Acesso negado.', 403)
  if (!iaConfigurada()) return falha('A leitura por IA não está configurada neste ambiente.', 503)

  let arquivo: File | null = null
  try {
    const campo = (await req.formData()).get('arquivo')
    if (campo instanceof File) arquivo = campo
  } catch {
    /* corpo inválido: cai no erro abaixo */
  }
  if (!arquivo) return falha('Envie a foto do atestado.', 400)
  if (!TIPOS.includes(arquivo.type)) return falha('Formato não aceito. Envie JPG, PNG, WEBP ou PDF.', 400)
  if (arquivo.size > MAX_BYTES) return falha('Arquivo grande demais (máximo 4 MB).', 413)

  const base64 = Buffer.from(await arquivo.arrayBuffer()).toString('base64')
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

  try {
    const { leitura } = await lerAtestado(base64, arquivo.type as TipoArquivoAtestado, hoje)

    const [funcionarios, { data: cids }] = await Promise.all([
      carregarFuncionariosVisiveis(auth),
      createClient().from('cid_referencia').select('codigo'),
    ])
    const codigosCid = new Set((cids ?? []).map(c => c.codigo as string))

    const { candidatos, automatico } = casarFuncionarios(leitura, funcionarios)
    return resposta({
      ok: true,
      documento: {
        tipo: leitura.tipoDocumento,
        observacao: leitura.observacao,
        pacienteNome: leitura.pacienteNome,
        pacienteMenor: leitura.pacienteMenor,
        maeNome: leitura.maeNome,
      },
      preenchimento: prepararPreenchimento(leitura, hoje, codigosCid),
      candidatos,
      automatico,
    })
  } catch (e) {
    // Sem nome, CPF ou CID no log: só o código do erro.
    console.error('[atestados/ler]', e instanceof ErroIA ? e.codigo : 'ERRO_INESPERADO')
    if (e instanceof ErroIA) return falha(e.message, 502)
    return falha('Não foi possível ler o atestado. Tente de novo ou lance manualmente.', 500)
  }
}
```

- [ ] **Step 3: Adicionar a action de busca manual**

Em `app/(admin)/atestados/actions.ts`, acrescentar aos imports do topo:

```ts
import { buscarPorNome, type CandidatoFuncionario } from '@/lib/atestados/leitura/casar-funcionario'
import { carregarFuncionariosVisiveis } from '@/lib/atestados/leitura/funcionarios-visiveis'
```

e no fim do arquivo:

```ts
/** Busca manual de funcionário (3+ letras) dentro do escopo do usuário, para o lançamento por foto. */
export async function buscarFuncionariosParaAtestado(termo: string): Promise<CandidatoFuncionario[]> {
  const auth = await getUser()
  if (!auth || auth.perfil.role === 'viewer') return []
  return buscarPorNome(termo.slice(0, 60), await carregarFuncionariosVisiveis(auth))
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add lib/atestados/leitura/funcionarios-visiveis.ts app/api/atestados/ler/route.ts "app/(admin)/atestados/actions.ts"
git commit -m "feat(atestados): rota de leitura por foto e busca manual de funcionario" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Reduzir a foto no navegador

**Files:**
- Create: `lib/atestados/leitura/reduzir-imagem.ts`

- [ ] **Step 1: Criar o utilitário** (só roda no navegador; sem teste unitário porque o Vitest deste projeto não tem DOM — validado na Task 12)

```ts
const LADO_MAXIMO = 1600
const QUALIDADE_JPEG = 0.85

/**
 * Reduz a foto para caber no limite de ~4,5 MB da Vercel: lado maior 1600 px, JPEG.
 * Respeita a rotação da câmera. PDF segue como está.
 */
export async function prepararArquivo(arquivo: File): Promise<File> {
  if (arquivo.type === 'application/pdf') return arquivo

  let imagem: ImageBitmap
  try {
    imagem = await createImageBitmap(arquivo, { imageOrientation: 'from-image' })
  } catch {
    throw new Error('Não consegui abrir essa imagem. Use uma foto em JPG ou PNG.')
  }

  const escala = Math.min(1, LADO_MAXIMO / Math.max(imagem.width, imagem.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(imagem.width * escala)
  canvas.height = Math.round(imagem.height * escala)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível preparar a foto.')
  ctx.drawImage(imagem, 0, 0, canvas.width, canvas.height)
  imagem.close()

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', QUALIDADE_JPEG))
  if (!blob) throw new Error('Não foi possível preparar a foto.')
  return new File([blob], 'atestado.jpg', { type: 'image/jpeg' })
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add lib/atestados/leitura/reduzir-imagem.ts
git commit -m "feat(atestados): reduz a foto do atestado no navegador" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: `ModalAtestado` aceita valores iniciais e destaca campos incertos

**Files:**
- Modify: `components/efetivo/modal-atestado.tsx`

Nenhum fluxo atual muda: sem `inicial`, o modal se comporta como hoje.

- [ ] **Step 1: Imports, tipo do funcionário e props**

Substituir:

```tsx
import type { FuncionarioRow } from './funcionarios-table'

const fmt = (d: string) => d.split('-').reverse().join('/')

type CidOpt = { codigo: string; descricao: string }

interface Props {
  funcionario: FuncionarioRow
  open: boolean
  onClose: () => void
  cids: CidOpt[]
}
```

por:

```tsx
import { cn } from '@/lib/utils'
import type { Preenchimento } from '@/lib/atestados/leitura/tipos'
import type { FuncionarioRow } from './funcionarios-table'

const fmt = (d: string) => d.split('-').reverse().join('/')

type CidOpt = { codigo: string; descricao: string }

interface Props {
  /** O modal só usa estes quatro campos; o lançamento por foto não tem a linha completa do Efetivo. */
  funcionario: Pick<FuncionarioRow, 'id' | 'nome' | 'status' | 'posto_id'>
  open: boolean
  onClose: () => void
  cids: CidOpt[]
  /** Valores lidos da foto: início, dias, fim e CID já preenchidos; campos com aviso ficam em amarelo. */
  inicial?: Preenchimento
}

const destaque = 'border-amber-400 bg-amber-50'

function textoCid(codigo: string, cids: CidOpt[]): string {
  const c = cids.find(x => x.codigo === codigo)
  return c ? `${c.codigo} — ${c.descricao}` : codigo
}
```

- [ ] **Step 2: Estado inicial vindo de `inicial`**

Substituir:

```tsx
export function ModalAtestado({ funcionario, open, onClose, cids }: Props) {
  const [pending, setPending]     = useState(false)
  const [erro, setErro]           = useState<string | null>(null)
  const [cidBusca, setCidBusca]   = useState('')
  const [cidCodigo, setCidCodigo] = useState('')
  const [cidAberto, setCidAberto] = useState(false)
  const [semCid, setSemCid]       = useState(false)
  const [dataInicio, setDataInicio] = useState('')
  const [dias, setDias]           = useState('')
  const [dataFim, setDataFim]     = useState('')
```

por:

```tsx
export function ModalAtestado({ funcionario, open, onClose, cids, inicial }: Props) {
  const [pending, setPending]     = useState(false)
  const [erro, setErro]           = useState<string | null>(null)
  const [cidBusca, setCidBusca]   = useState(inicial?.cidCodigo ? textoCid(inicial.cidCodigo, cids) : '')
  const [cidCodigo, setCidCodigo] = useState(inicial?.cidCodigo ?? '')
  const [cidAberto, setCidAberto] = useState(false)
  const [semCid, setSemCid]       = useState(false)
  const [dataInicio, setDataInicio] = useState(inicial?.dataInicio ?? '')
  const [dias, setDias]           = useState(inicial?.dias ?? '')
  const [dataFim, setDataFim]     = useState(inicial?.dataFim ?? '')
  const [avisos, setAvisos]       = useState<Preenchimento['avisos']>(inicial?.avisos ?? { dataInicio: null, dias: null, cid: null })
```

- [ ] **Step 3: Limpar o aviso quando o usuário mexe no campo**

Substituir:

```tsx
  const cidRef = useRef<HTMLDivElement>(null)
```

por:

```tsx
  const cidRef = useRef<HTMLDivElement>(null)

  function limparAviso(campo: keyof Preenchimento['avisos']) {
    setAvisos(a => ({ ...a, [campo]: null }))
  }
```

Substituir:

```tsx
  function handleDiasChange(val: string) {
    setDias(val)
```

por:

```tsx
  function handleDiasChange(val: string) {
    limparAviso('dias')
    setDias(val)
```

Substituir:

```tsx
  function handleDataInicioChange(val: string) {
    setDataInicio(val)
```

por:

```tsx
  function handleDataInicioChange(val: string) {
    limparAviso('dataInicio')
    setDataInicio(val)
```

Substituir:

```tsx
  function selecionarCid(c: CidOpt) {
    setCidCodigo(c.codigo)
```

por:

```tsx
  function selecionarCid(c: CidOpt) {
    limparAviso('cid')
    setCidCodigo(c.codigo)
```

- [ ] **Step 4: Destaque amarelo e texto do aviso nos três campos**

Substituir o campo Data Início:

```tsx
                <label className={labelClass}>Data Início</label>
                <input
                  type="date"
                  name="data_inicio_display"
                  required
                  value={dataInicio}
                  onChange={e => handleDataInicioChange(e.target.value)}
                  className={inputClass}
                />
```

por:

```tsx
                <label className={labelClass}>Data Início</label>
                <input
                  type="date"
                  name="data_inicio_display"
                  required
                  value={dataInicio}
                  onChange={e => handleDataInicioChange(e.target.value)}
                  className={cn(inputClass, avisos.dataInicio && destaque)}
                />
                {avisos.dataInicio && <p className="mt-1 text-xs text-amber-700">⚠ {avisos.dataInicio}</p>}
```

Substituir o campo Dias:

```tsx
                <label className={labelClass}>Dias</label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  placeholder="Ex: 15"
                  value={dias}
                  onChange={e => handleDiasChange(e.target.value)}
                  className={inputClass}
                />
```

por:

```tsx
                <label className={labelClass}>Dias</label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  placeholder="Ex: 15"
                  value={dias}
                  onChange={e => handleDiasChange(e.target.value)}
                  className={cn(inputClass, avisos.dias && destaque)}
                />
                {avisos.dias && <p className="mt-1 text-xs text-amber-700">⚠ {avisos.dias}</p>}
```

Substituir o campo de busca do CID (o `className` do input de texto) e o aviso. Trocar:

```tsx
                  className={`${inputClass} pr-8 ${semCid ? 'bg-gray-50 text-gray-400' : ''}`}
```

por:

```tsx
                  className={cn(inputClass, 'pr-8', semCid && 'bg-gray-50 text-gray-400', !semCid && avisos.cid && destaque)}
```

e trocar:

```tsx
                <input type="hidden" name="cid_codigo" value={semCid ? '' : cidCodigo} />
```

por:

```tsx
                <input type="hidden" name="cid_codigo" value={semCid ? '' : cidCodigo} />
                {avisos.cid && !semCid && <p className="mt-1 text-xs text-amber-700">⚠ {avisos.cid}</p>}
```

- [ ] **Step 4b: Marcar "sem CID" também limpa o aviso**

No `onChange` do checkbox "Atestado sem CID", trocar:

```tsx
                      setSemCid(e.target.checked)
                      if (e.target.checked) limparCid()
```

por:

```tsx
                      setSemCid(e.target.checked)
                      if (e.target.checked) { limparCid(); limparAviso('cid') }
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros. Os dois usos atuais (`funcionarios-table.tsx:405` e `faltas/faixa-faltas-confirmar.tsx:72`) continuam compilando: `FuncionarioRow` é atribuível ao `Pick`.

- [ ] **Step 6: Commit**

```bash
git add components/efetivo/modal-atestado.tsx
git commit -m "feat(atestados): modal de atestado aceita valores iniciais e destaca campos incertos" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Componente "Lançar por foto" e botão na página

**Files:**
- Create: `components/atestados/atestado-por-foto.tsx`
- Modify: `app/(admin)/atestados/page.tsx` (import + cabeçalho)

- [ ] **Step 1: Criar o componente**

`components/atestados/atestado-por-foto.tsx`:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog } from '@base-ui/react/dialog'
import { Camera, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ModalAtestado } from '@/components/efetivo/modal-atestado'
import type { FuncionarioRow } from '@/components/efetivo/funcionarios-table'
import { buscarFuncionariosParaAtestado } from '@/app/(admin)/atestados/actions'
import { prepararArquivo } from '@/lib/atestados/leitura/reduzir-imagem'
import type { CandidatoFuncionario } from '@/lib/atestados/leitura/casar-funcionario'
import type { RespostaLeitura } from '@/lib/atestados/leitura/tipos'

type Leitura = Extract<RespostaLeitura, { ok: true }>
type Etapa = 'fechado' | 'escolher' | 'lendo' | 'quem' | 'lancar'

/** Leitura vazia: usada quando o supervisor escolhe o funcionário na mão (IA fora do ar ou foto ruim). */
const LEITURA_VAZIA: Leitura = {
  ok: true,
  documento: { tipo: 'atestado_medico', observacao: null, pacienteNome: null, pacienteMenor: null, maeNome: null },
  preenchimento: { dataInicio: '', dias: '', dataFim: '', cidCodigo: '', avisos: { dataInicio: null, dias: null, cid: null } },
  candidatos: [],
  automatico: null,
}

const botaoPrimario = 'inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50'
const botaoSecundario = 'inline-flex h-9 items-center justify-center rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50'

export function AtestadoPorFoto({ cids }: { cids: { codigo: string; descricao: string }[] }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [etapa, setEtapa] = useState<Etapa>('fechado')
  const [erro, setErro] = useState<string | null>(null)
  const [leitura, setLeitura] = useState<Leitura | null>(null)
  const [escolhido, setEscolhido] = useState<CandidatoFuncionario | null>(null)
  const [termo, setTermo] = useState('')
  const [achados, setAchados] = useState<CandidatoFuncionario[]>([])
  const [buscando, setBuscando] = useState(false)

  function fechar() {
    setEtapa('fechado'); setErro(null); setLeitura(null); setEscolhido(null); setTermo(''); setAchados([])
  }

  async function aoEscolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    e.target.value = ''
    if (!arquivo) return
    setErro(null)
    setEtapa('lendo')
    try {
      const pronto = await prepararArquivo(arquivo)
      const corpo = new FormData()
      corpo.set('arquivo', pronto)
      const resp = await fetch('/api/atestados/ler', { method: 'POST', body: corpo })
      const json = (await resp.json()) as RespostaLeitura
      if (!json.ok) { setErro(json.erro); setEtapa('escolher'); return }
      setLeitura(json)
      setEscolhido(json.candidatos.find(c => c.id === json.automatico) ?? null)
      setEtapa('quem')
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível ler o atestado. Tente de novo.')
      setEtapa('escolher')
    }
  }

  // Busca manual com espera de 400 ms entre as teclas.
  useEffect(() => {
    if (etapa !== 'quem' || termo.trim().length < 3) { setAchados([]); setBuscando(false); return }
    let cancelado = false
    setBuscando(true)
    const timer = setTimeout(async () => {
      const r = await buscarFuncionariosParaAtestado(termo)
      if (!cancelado) { setAchados(r); setBuscando(false) }
    }, 400)
    return () => { cancelado = true; clearTimeout(timer) }
  }, [termo, etapa])

  if (etapa === 'lancar' && escolhido && leitura) {
    return (
      <ModalAtestado
        key={escolhido.id}
        funcionario={{ id: escolhido.id, nome: escolhido.nome, status: escolhido.status as FuncionarioRow['status'], posto_id: escolhido.postoId }}
        open
        onClose={() => { fechar(); router.refresh() }}
        cids={cids}
        inicial={leitura.preenchimento}
      />
    )
  }

  const doc = leitura?.documento
  const lista = termo.trim().length >= 3 ? achados : leitura?.candidatos ?? []

  function Opcao({ c }: { c: CandidatoFuncionario }) {
    const marcado = escolhido?.id === c.id
    return (
      <label className={cn('flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 text-sm', marcado ? 'border-slate-900 bg-slate-50' : 'border-gray-200 hover:bg-gray-50')}>
        <input type="radio" name="funcionario" className="mt-1" checked={marcado} onChange={() => setEscolhido(c)} />
        <span className="min-w-0">
          <span className="block font-medium text-gray-900">{c.nome}</span>
          <span className="block text-xs text-gray-500">
            {[c.postoNome, c.funcaoNome].filter(Boolean).join(' · ') || 'Sem posto'} · parecido {Math.round(c.nota * 100)}%
            {c.viaMae && ' · pelo nome da mãe'}
          </span>
        </span>
      </label>
    )
  }

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={aoEscolherArquivo} />
      <button type="button" onClick={() => setEtapa('escolher')} className={botaoPrimario}>
        <Camera className="h-4 w-4" aria-hidden="true" />
        Lançar por foto
      </button>

      <Dialog.Root open={etapa !== 'fechado'} onOpenChange={aberto => { if (!aberto && etapa !== 'lendo') fechar() }}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            {etapa === 'escolher' && (
              <div className="space-y-4">
                <Dialog.Title className="text-lg font-semibold">Atestado por foto</Dialog.Title>
                <p className="text-sm text-gray-500">
                  Tire uma foto do atestado (ou escolha da galeria). Eu leio o nome, o início, os dias e o CID, e você confere antes de salvar. A imagem não fica guardada.
                </p>
                {erro && <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>}
                <div className="flex flex-wrap justify-end gap-2">
                  <button type="button" onClick={fechar} className={botaoSecundario}>Cancelar</button>
                  {erro && (
                    <button type="button" onClick={() => { setLeitura(LEITURA_VAZIA); setErro(null); setEtapa('quem') }} className={botaoSecundario}>
                      Escolher o funcionário e digitar
                    </button>
                  )}
                  <button type="button" onClick={() => inputRef.current?.click()} className={botaoPrimario}>
                    <Camera className="h-4 w-4" aria-hidden="true" />
                    Escolher foto
                  </button>
                </div>
              </div>
            )}

            {etapa === 'lendo' && (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <Loader2 className="h-6 w-6 animate-spin text-slate-700" aria-hidden="true" />
                <Dialog.Title className="text-sm font-medium text-gray-700">Lendo o atestado…</Dialog.Title>
              </div>
            )}

            {etapa === 'quem' && doc && (
              <div className="space-y-4">
                <Dialog.Title className="text-lg font-semibold">Quem é o funcionário?</Dialog.Title>

                {doc.tipo === 'outro' && (
                  <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Este papel não parece um atestado médico. Confira antes de seguir.
                  </p>
                )}
                {doc.pacienteMenor && (
                  <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    O paciente é menor de idade — pode ser acompanhamento de filho(a).
                    {doc.maeNome ? ` Procurei também pelo nome da mãe: ${doc.maeNome}.` : ''} Escolha o funcionário responsável.
                  </p>
                )}
                {doc.pacienteNome && (
                  <p className="text-sm text-gray-600">No papel: <strong className="text-gray-900">{doc.pacienteNome}</strong></p>
                )}
                {doc.observacao && <p className="text-xs italic text-gray-500">IA: {doc.observacao}</p>}

                {lista.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                      {termo.trim().length >= 3 ? 'Resultado da busca' : leitura?.automatico ? 'Encontrado no cadastro' : 'Você quis dizer…?'}
                    </p>
                    {lista.map(c => <Opcao key={c.id} c={c} />)}
                  </div>
                ) : (
                  termo.trim().length < 3 && doc.pacienteNome && (
                    <p className="text-sm text-gray-500">Não achei ninguém parecido nos seus postos. Busque pelo nome abaixo.</p>
                  )
                )}

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600">Buscar pelo nome</label>
                  <input
                    type="text"
                    value={termo}
                    onChange={e => setTermo(e.target.value)}
                    placeholder="Digite 3 letras ou mais"
                    autoComplete="off"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  {buscando && <p className="mt-1 text-xs text-gray-400">Buscando…</p>}
                  {!buscando && termo.trim().length >= 3 && achados.length === 0 && (
                    <p className="mt-1 text-xs text-gray-500">Ninguém encontrado com esse nome nos seus postos.</p>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={fechar} className={botaoSecundario}>Cancelar</button>
                  <button type="button" disabled={!escolhido} onClick={() => setEtapa('lancar')} className={botaoPrimario}>Continuar</button>
                </div>
              </div>
            )}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
```

- [ ] **Step 2: Colocar o botão no cabeçalho de Atestados**

Em `app/(admin)/atestados/page.tsx`, adicionar o import junto dos outros:

```tsx
import { AtestadoPorFoto } from '@/components/atestados/atestado-por-foto'
```

e substituir o cabeçalho:

```tsx
        {totalAlerta > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2">
            <span className="text-sm font-semibold text-red-700">
              ⚠️ {totalAlerta} funcionário{totalAlerta > 1 ? 's' : ''} com acumulado &gt; 15 dias
            </span>
          </div>
        )}
      </div>
```

por:

```tsx
        <div className="flex flex-wrap items-center justify-end gap-3">
          {totalAlerta > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2">
              <span className="text-sm font-semibold text-red-700">
                ⚠️ {totalAlerta} funcionário{totalAlerta > 1 ? 's' : ''} com acumulado &gt; 15 dias
              </span>
            </div>
          )}
          <AtestadoPorFoto cids={cids} />
        </div>
      </div>
```

(`cids` já existe na página como `{ codigo, descricao }[]`; viewer já é redirecionado no topo da página.)

- [ ] **Step 3: Type-check e testes**

Run: `npx tsc --noEmit && npx vitest run`
Expected: sem erros de tipo; todos os testes passam.

- [ ] **Step 4: Commit**

```bash
git add components/atestados/atestado-por-foto.tsx "app/(admin)/atestados/page.tsx"
git commit -m "feat(atestados): botao Lancar por foto com identificacao do funcionario" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Verificação final

- [ ] **Step 1: Build completo**

Run: `npm run build`
Expected: "Compiled successfully" e sem erro de lint/tipo. Se o lint reclamar de `Opcao` declarada dentro do componente (`react/no-unstable-nested-components`), mover `Opcao` para fora do componente recebendo `escolhido` e `onEscolher` por props.

- [ ] **Step 2: Todos os testes**

Run: `npm test`
Expected: PASS em todos os arquivos `lib/**/*.test.ts`, incluindo os 4 novos de `lib/atestados/leitura/` (`nomes`, `casar-funcionario`, `normalizar`, `schema`).

- [ ] **Step 3: Conferir que nenhum dado real entrou no repositório**

Run: `git grep -niE "<nomes e sobrenomes das fotos de teste, separados por |>" -- lib components app docs/superpowers`
Expected: nenhuma linha (os testes usam só nomes fictícios).

- [ ] **Step 4: Roteiro de teste manual no preview** (o teste logado local não funciona neste projeto; o usuário faz no preview/produção)

Entregar ao usuário, para cada caso, o resultado esperado:
1. Supervisor → Atestados → **Lançar por foto** → foto de atestado de funcionário dele: aparece "Encontrado no cadastro" com o nome pré-selecionado e "No papel: …". **Continuar** abre o modal com início, dias, data fim e CID preenchidos.
2. Foto com nome com 1 letra errada: aparece como pré-selecionado ou na lista "Você quis dizer…?".
3. Atestado sem data de início no papel: campo **Data Início em amarelo** com "usei a data de emissão".
4. Atestado sem CID legível: campo CID em amarelo com "Não achei CID no papel"; marcar "Atestado sem CID" tira o aviso.
5. Atestado de criança: aviso "paciente é menor" e candidatos pelo nome da mãe.
6. Foto de pessoa de outro posto (supervisor): não aparece no cadastro dele → "Não achei ninguém parecido" + busca manual.
7. Salvar: o atestado aparece na lista de Atestados (a página recarrega) e as regras de sobreposição/falta continuam valendo.
8. Celular real: o botão abre a câmera/galeria e a foto grande (3–5 MB) é aceita.

- [ ] **Step 5: Parar e perguntar**

Reportar ao usuário o resultado de `tsc`, `vitest` e `build`, e **perguntar antes de qualquer `git push`** (regra do projeto).

---

## Autoavaliação contra o spec

| Requisito do spec | Onde está |
|---|---|
| Botão "Lançar por foto" na página Atestados, oculto para viewer | Task 11 (viewer já é redirecionado em `page.tsx`; a rota e a action também recusam viewer) |
| Redução da imagem 1600 px JPEG; PDF aceito | Task 9; rota aceita PDF (Task 8), `ler.ts` envia como `document` (Task 6) |
| IA Haiku 4.5, ferramenta forçada, imagem/PDF | Tasks 5 e 6 |
| Casamento com nome aproximado, lista "Você quis dizer…?", pré-seleção com nota ≥ 0,90 e vantagem ≥ 0,08 | Tasks 2 e 3; tela na Task 11 |
| "No papel: X" / "No cadastro: Y" lado a lado | Task 11 (nome do papel em cima, cada candidato com nome do cadastro, posto, função e %) |
| Menor de idade: aviso + busca pela mãe, nunca pré-seleciona | Task 3 (`viaMae`, `automatico` nulo) e Task 11 (aviso) |
| Desligado fora; supervisor só vê os postos dele | Task 3 (`status === 'desligado'`) e Task 8 (`carregarFuncionariosVisiveis`) |
| CPF só para casar, nunca exibido nem devolvido | Task 3 (teste "não devolve o CPF") e Task 8 (resposta sem CPF) |
| Início da emissão em amarelo; faixa −60/+30 dias | Task 4 |
| Dias 1–365; data fim = início + dias − 1 | Task 4 |
| CID normalizado, exato/categoria, aviso quando fora da referência; CID nulo nunca vira "sem CID" | Task 4 |
| `data_retorno` fora do schema | Task 5 |
| Documento que não é atestado: aviso | Task 11 |
| Erro da IA: atalho para escolher o funcionário e digitar | Task 11 (`LEITURA_VAZIA`) |
| Imagem não gravada; log sem nome/CPF/CID | Tasks 6 e 8 |
| `ModalAtestado` ganha só `inicial`; fluxo atual intacto | Task 10 |
| `registrarAtestado` reaproveitado com todas as regras | Task 11 (o modal salva por ele) |
| Testes unitários com nomes fictícios; leitura real com as fotos | Tasks 2–5 e 7 |

**Fora do plano (conforme spec):** auditoria de inconsistências, médico/CRM/emissão, admissão por documento (Fase 2), limite por usuário.
