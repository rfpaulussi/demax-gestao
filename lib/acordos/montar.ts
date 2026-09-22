import type { CamposAcordo, FuncionarioCalc } from './tipos'
import { agruparPorJornada, resumoCalculo } from './movimentos'
import { gerarObjeto } from './templates'
import { assinaturaSemana, juntarRotulos, semanaParaTexto } from './horario-do-turno'

export interface TurnoHorario {
  label: string
  horario: Record<string, string>   // dia -> "07:00 às 12:00 / 13:12 às 17:00"
  funcionario_ids: string[]
  /** Parágrafo de compensação deste turno (depois de "…com a finalidade de que os funcionários "). Ausente em acordos antigos. */
  objeto?: string
}

export type TextosAcordo =
  | { ok: true; horarios: TurnoHorario[]; descricao: string }
  | { ok: false; erro: string }

/**
 * Turnos (tabela de horários + parágrafo de compensação) e `descricao_acordo` de um acordo.
 * Usado para gravar (servidor) e para o rascunho em PDF (navegador): os dois têm que sair iguais.
 * Não valida: quem chama roda `validarAcordo` antes.
 */
export function montarTextosAcordo(campos: CamposAcordo, funcs: FuncionarioCalc[]): TextosAcordo {
  const grupos = agruparPorJornada(campos, funcs)
  if (grupos.length === 0) return { ok: false, erro: 'Selecione ao menos um funcionário.' }

  // Revezamento: cada grupo (mesma data de folga) abre o parágrafo com os nomes dele
  const revezamento = !!campos.folgasPorFuncionario
  const objetoPorFunc = new Map<string, string>()
  const objetosDosGrupos: string[] = []
  for (const g of grupos) {
    const texto = gerarObjeto(campos, resumoCalculo(campos, g))
    if (!texto.ok) return { ok: false, erro: texto.erro }
    const objeto = revezamento ? `${juntarRotulos(g.map(f => f.nome))} ${texto.texto}` : texto.texto
    objetosDosGrupos.push(objeto)
    for (const f of g) objetoPorFunc.set(f.id, objeto)
  }

  const porSemana = new Map<string, FuncionarioCalc[]>()
  for (const f of funcs) {
    const chave = assinaturaSemana(f.semana)
    porSemana.set(chave, [...(porSemana.get(chave) ?? []), f])
  }
  const gruposDeTurno = Array.from(porSemana.values())
  const horarios: TurnoHorario[] = gruposDeTurno.map((g, i) => ({
    label: gruposDeTurno.length === 1 ? 'Turno Único' : `Turno ${String.fromCharCode(65 + i)}`,
    horario: semanaParaTexto(g[0].semana),
    funcionario_ids: g.map(f => f.id),
    // um turno pode ter grupos de datas diferentes no revezamento: junta os textos distintos, na ordem
    objeto: Array.from(new Set(g.map(f => objetoPorFunc.get(f.id)!))).join('; e os funcionários '),
  }))

  // descricao_acordo: um texto só quando todos os grupos coincidem; senão, um trecho por grupo com os turnos dele
  const descricao = objetosDosGrupos.every(o => o === objetosDosGrupos[0])
    ? objetosDosGrupos[0]
    : grupos.map((g, gi) => {
        const ids = new Set(g.map(f => f.id))
        const labels = horarios.filter(h => h.funcionario_ids.some(id => ids.has(id))).map(h => h.label)
        return `${juntarRotulos(labels)}: ${objetosDosGrupos[gi]}`
      }).join(' ')

  return { ok: true, horarios, descricao }
}
