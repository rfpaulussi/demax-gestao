export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      acordos_compensacao: {
        Row: {
          created_at: string | null
          criado_por: string | null
          data_documento: string
          descricao_acordo: string
          entregue_em: string | null
          entregue_rh: boolean
          funcionarios: Json
          horario_semana: Json
          id: string
          postos: Json
          subtipo: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          created_at?: string | null
          criado_por?: string | null
          data_documento?: string
          descricao_acordo?: string
          entregue_em?: string | null
          entregue_rh?: boolean
          funcionarios?: Json
          horario_semana?: Json
          id?: string
          postos?: Json
          subtipo?: string | null
          tipo: string
          titulo: string
        }
        Update: {
          created_at?: string | null
          criado_por?: string | null
          data_documento?: string
          descricao_acordo?: string
          entregue_em?: string | null
          entregue_rh?: boolean
          funcionarios?: Json
          horario_semana?: Json
          id?: string
          postos?: Json
          subtipo?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: []
      }
      advertencias: {
        Row: {
          created_at: string | null
          criado_por: string | null
          data_aplicacao: string | null
          data_ocorrencia: string | null
          defesa_colaborador: string | null
          descricao: string | null
          dias_suspensao: number | null
          funcionario_id: string
          grau: string | null
          horario_fato: string | null
          id: string
          natureza: string | null
          pdf_url: string | null
          registrado_por: string | null
          relato: string | null
          status: string | null
          testemunha_1: string | null
          testemunha_2: string | null
          tipo: string | null
        }
        Insert: {
          created_at?: string | null
          criado_por?: string | null
          data_aplicacao?: string | null
          data_ocorrencia?: string | null
          defesa_colaborador?: string | null
          descricao?: string | null
          dias_suspensao?: number | null
          funcionario_id: string
          grau?: string | null
          horario_fato?: string | null
          id?: string
          natureza?: string | null
          pdf_url?: string | null
          registrado_por?: string | null
          relato?: string | null
          status?: string | null
          testemunha_1?: string | null
          testemunha_2?: string | null
          tipo?: string | null
        }
        Update: {
          created_at?: string | null
          criado_por?: string | null
          data_aplicacao?: string | null
          data_ocorrencia?: string | null
          defesa_colaborador?: string | null
          descricao?: string | null
          dias_suspensao?: number | null
          funcionario_id?: string
          grau?: string | null
          horario_fato?: string | null
          id?: string
          natureza?: string | null
          pdf_url?: string | null
          registrado_por?: string | null
          relato?: string | null
          status?: string | null
          testemunha_1?: string | null
          testemunha_2?: string | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "advertencias_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advertencias_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      afastamentos: {
        Row: {
          created_at: string | null
          data_fim_prevista: string | null
          data_fim_real: string | null
          data_inicio: string
          funcionario_id: string
          id: string
          motivo: string | null
          solicitacao_id: string | null
        }
        Insert: {
          created_at?: string | null
          data_fim_prevista?: string | null
          data_fim_real?: string | null
          data_inicio: string
          funcionario_id: string
          id?: string
          motivo?: string | null
          solicitacao_id?: string | null
        }
        Update: {
          created_at?: string | null
          data_fim_prevista?: string | null
          data_fim_real?: string | null
          data_inicio?: string
          funcionario_id?: string
          id?: string
          motivo?: string | null
          solicitacao_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "afastamentos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "afastamentos_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      atestados: {
        Row: {
          cid: string | null
          cid_codigo: string | null
          created_at: string | null
          data_fim: string
          data_inicio: string
          funcionario_id: string
          id: string
          motivo: string | null
          origem_ocupacional: string | null
          posto_id: string
          registrado_por: string
          sem_cid: boolean | null
        }
        Insert: {
          cid?: string | null
          cid_codigo?: string | null
          created_at?: string | null
          data_fim: string
          data_inicio: string
          funcionario_id: string
          id?: string
          motivo?: string | null
          origem_ocupacional?: string | null
          posto_id: string
          registrado_por: string
          sem_cid?: boolean | null
        }
        Update: {
          cid?: string | null
          cid_codigo?: string | null
          created_at?: string | null
          data_fim?: string
          data_inicio?: string
          funcionario_id?: string
          id?: string
          motivo?: string | null
          origem_ocupacional?: string | null
          posto_id?: string
          registrado_por?: string
          sem_cid?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "atestados_cid_codigo_fkey"
            columns: ["cid_codigo"]
            isOneToOne: false
            referencedRelation: "cid_referencia"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "atestados_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atestados_posto_id_fkey"
            columns: ["posto_id"]
            isOneToOne: false
            referencedRelation: "postos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atestados_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      cid_referencia: {
        Row: {
          codigo: string
          descricao: string
          nexo_ocupacional_limpeza: boolean | null
        }
        Insert: {
          codigo: string
          descricao: string
          nexo_ocupacional_limpeza?: boolean | null
        }
        Update: {
          codigo?: string
          descricao?: string
          nexo_ocupacional_limpeza?: boolean | null
        }
        Relationships: []
      }
      coberturas_insalubres: {
        Row: {
          created_at: string | null
          data_fim: string | null
          data_inicio: string | null
          declaracao_url: string | null
          funcionario_id: string
          grau: string | null
          id: string
          percentual: number | null
          posto_id: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          declaracao_url?: string | null
          funcionario_id: string
          grau?: string | null
          id?: string
          percentual?: number | null
          posto_id: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          declaracao_url?: string | null
          funcionario_id?: string
          grau?: string | null
          id?: string
          percentual?: number | null
          posto_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coberturas_insalubres_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coberturas_insalubres_posto_id_fkey"
            columns: ["posto_id"]
            isOneToOne: false
            referencedRelation: "postos"
            referencedColumns: ["id"]
          },
        ]
      }
      coberturas_insalubridade: {
        Row: {
          agente_ausente: string
          contrato_id: string | null
          data_inicio: string
          dias_no_mes: number
          funcao_agente_ausente: string | null
          funcao_colaborador: string | null
          id: string
          importado_em: string | null
          mes_ano: string
          motivo: string | null
          nome_colaborador: string
          origem: string | null
          periodo_dias: number
          posto_atual: string | null
          posto_formulario: string | null
          registro: string | null
          supervisor: string | null
        }
        Insert: {
          agente_ausente: string
          contrato_id?: string | null
          data_inicio: string
          dias_no_mes: number
          funcao_agente_ausente?: string | null
          funcao_colaborador?: string | null
          id?: string
          importado_em?: string | null
          mes_ano: string
          motivo?: string | null
          nome_colaborador: string
          origem?: string | null
          periodo_dias: number
          posto_atual?: string | null
          posto_formulario?: string | null
          registro?: string | null
          supervisor?: string | null
        }
        Update: {
          agente_ausente?: string
          contrato_id?: string | null
          data_inicio?: string
          dias_no_mes?: number
          funcao_agente_ausente?: string | null
          funcao_colaborador?: string | null
          id?: string
          importado_em?: string | null
          mes_ano?: string
          motivo?: string | null
          nome_colaborador?: string
          origem?: string | null
          periodo_dias?: number
          posto_atual?: string | null
          posto_formulario?: string | null
          registro?: string | null
          supervisor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coberturas_insalubridade_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      coberturas_temporarias: {
        Row: {
          created_at: string | null
          data_inicio: string | null
          data_prev_retorno: string | null
          data_retorno_real: string | null
          funcionario_ausente_id: string | null
          funcionario_id: string
          id: string
          motivo: string | null
          posto_destino_id: string
          posto_origem_id: string | null
          status: string | null
          supervisor_destino_id: string | null
          supervisor_origem_id: string | null
          tipo_cobertura: string | null
          tipo_motivo: string | null
          urgencia: string | null
        }
        Insert: {
          created_at?: string | null
          data_inicio?: string | null
          data_prev_retorno?: string | null
          data_retorno_real?: string | null
          funcionario_ausente_id?: string | null
          funcionario_id: string
          id?: string
          motivo?: string | null
          posto_destino_id: string
          posto_origem_id?: string | null
          status?: string | null
          supervisor_destino_id?: string | null
          supervisor_origem_id?: string | null
          tipo_cobertura?: string | null
          tipo_motivo?: string | null
          urgencia?: string | null
        }
        Update: {
          created_at?: string | null
          data_inicio?: string | null
          data_prev_retorno?: string | null
          data_retorno_real?: string | null
          funcionario_ausente_id?: string | null
          funcionario_id?: string
          id?: string
          motivo?: string | null
          posto_destino_id?: string
          posto_origem_id?: string | null
          status?: string | null
          supervisor_destino_id?: string | null
          supervisor_origem_id?: string | null
          tipo_cobertura?: string | null
          tipo_motivo?: string | null
          urgencia?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coberturas_temporarias_funcionario_ausente_id_fkey"
            columns: ["funcionario_ausente_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coberturas_temporarias_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coberturas_temporarias_posto_destino_id_fkey"
            columns: ["posto_destino_id"]
            isOneToOne: false
            referencedRelation: "postos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coberturas_temporarias_posto_origem_id_fkey"
            columns: ["posto_origem_id"]
            isOneToOne: false
            referencedRelation: "postos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coberturas_temporarias_supervisor_destino_id_fkey"
            columns: ["supervisor_destino_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coberturas_temporarias_supervisor_origem_id_fkey"
            columns: ["supervisor_origem_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      composicao_postos: {
        Row: {
          created_at: string | null
          funcao_id: string
          id: string
          posto_id: string
          quantidade: number
        }
        Insert: {
          created_at?: string | null
          funcao_id: string
          id?: string
          posto_id: string
          quantidade?: number
        }
        Update: {
          created_at?: string | null
          funcao_id?: string
          id?: string
          posto_id?: string
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "composicao_postos_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "funcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "composicao_postos_posto_id_fkey"
            columns: ["posto_id"]
            isOneToOne: false
            referencedRelation: "postos"
            referencedColumns: ["id"]
          },
        ]
      }
      config_escalas_postos: {
        Row: {
          descricao: string | null
          posto_id: string
          regime: string
          updated_at: string | null
        }
        Insert: {
          descricao?: string | null
          posto_id: string
          regime?: string
          updated_at?: string | null
        }
        Update: {
          descricao?: string | null
          posto_id?: string
          regime?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "config_escalas_postos_posto_id_fkey"
            columns: ["posto_id"]
            isOneToOne: true
            referencedRelation: "postos"
            referencedColumns: ["id"]
          },
        ]
      }
      config_supervisores_postos: {
        Row: {
          ativo: boolean | null
          id: string
          posto_id: string
          supervisor_id: string
        }
        Insert: {
          ativo?: boolean | null
          id?: string
          posto_id: string
          supervisor_id: string
        }
        Update: {
          ativo?: boolean | null
          id?: string
          posto_id?: string
          supervisor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "config_supervisores_postos_posto_id_fkey"
            columns: ["posto_id"]
            isOneToOne: false
            referencedRelation: "postos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "config_supervisores_postos_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          data_fim: string | null
          data_inicio: string | null
          id: string
          numero: string | null
          objeto: string | null
          secretaria: string | null
          valor_mensal: number | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          id?: string
          numero?: string | null
          objeto?: string | null
          secretaria?: string | null
          valor_mensal?: number | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          id?: string
          numero?: string | null
          objeto?: string | null
          secretaria?: string | null
          valor_mensal?: number | null
        }
        Relationships: []
      }
      convencao_valores_funcoes: {
        Row: {
          assid_asseio: number | null
          aux_saude: number | null
          bss: number | null
          convencao_id: string
          enc_inss: number | null
          enc_provisorio: number | null
          fgts: number | null
          funcao_id: string
          id: string
          insalubridade_perc: number | null
          insalubridade_valor: number | null
          multa_40_pct: number | null
          periculosidade_perc: number | null
          periculosidade_valor: number | null
          plr: number | null
          salario_base: number
          total_por_func: number | null
          um_doze_decimo_terceiro: number | null
          um_doze_lei_12506: number | null
          um_terceiro_ferias: number | null
          va: number | null
          vr: number | null
          vt: number | null
        }
        Insert: {
          assid_asseio?: number | null
          aux_saude?: number | null
          bss?: number | null
          convencao_id: string
          enc_inss?: number | null
          enc_provisorio?: number | null
          fgts?: number | null
          funcao_id: string
          id?: string
          insalubridade_perc?: number | null
          insalubridade_valor?: number | null
          multa_40_pct?: number | null
          periculosidade_perc?: number | null
          periculosidade_valor?: number | null
          plr?: number | null
          salario_base: number
          total_por_func?: number | null
          um_doze_decimo_terceiro?: number | null
          um_doze_lei_12506?: number | null
          um_terceiro_ferias?: number | null
          va?: number | null
          vr?: number | null
          vt?: number | null
        }
        Update: {
          assid_asseio?: number | null
          aux_saude?: number | null
          bss?: number | null
          convencao_id?: string
          enc_inss?: number | null
          enc_provisorio?: number | null
          fgts?: number | null
          funcao_id?: string
          id?: string
          insalubridade_perc?: number | null
          insalubridade_valor?: number | null
          multa_40_pct?: number | null
          periculosidade_perc?: number | null
          periculosidade_valor?: number | null
          plr?: number | null
          salario_base?: number
          total_por_func?: number | null
          um_doze_decimo_terceiro?: number | null
          um_doze_lei_12506?: number | null
          um_terceiro_ferias?: number | null
          va?: number | null
          vr?: number | null
          vt?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "convencao_valores_funcoes_convencao_id_fkey"
            columns: ["convencao_id"]
            isOneToOne: false
            referencedRelation: "convencoes_coletivas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convencao_valores_funcoes_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "funcoes"
            referencedColumns: ["id"]
          },
        ]
      }
      convencoes_coletivas: {
        Row: {
          aplicada_em: string | null
          aplicada_por: string | null
          created_at: string | null
          criada_por: string | null
          data_vigencia_fim: string
          data_vigencia_inicio: string
          descricao: string
          id: string
          observacoes: string | null
          percentual_reajuste: number | null
          status: string
        }
        Insert: {
          aplicada_em?: string | null
          aplicada_por?: string | null
          created_at?: string | null
          criada_por?: string | null
          data_vigencia_fim: string
          data_vigencia_inicio: string
          descricao: string
          id?: string
          observacoes?: string | null
          percentual_reajuste?: number | null
          status?: string
        }
        Update: {
          aplicada_em?: string | null
          aplicada_por?: string | null
          created_at?: string | null
          criada_por?: string | null
          data_vigencia_fim?: string
          data_vigencia_inicio?: string
          descricao?: string
          id?: string
          observacoes?: string | null
          percentual_reajuste?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "convencoes_coletivas_aplicada_por_fkey"
            columns: ["aplicada_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convencoes_coletivas_criada_por_fkey"
            columns: ["criada_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      custos_funcoes: {
        Row: {
          assid_asseio: number | null
          aux_saude: number | null
          bss: number | null
          created_at: string | null
          enc_inss: number | null
          enc_provisorio: number | null
          fgts: number | null
          funcao_id: string
          id: string
          multa_40_pct: number | null
          plr: number | null
          total_por_func: number | null
          um_doze_decimo_terceiro: number | null
          um_doze_lei_12506: number | null
          um_terceiro_ferias: number | null
          updated_at: string | null
          va: number | null
          vr: number | null
          vt: number | null
        }
        Insert: {
          assid_asseio?: number | null
          aux_saude?: number | null
          bss?: number | null
          created_at?: string | null
          enc_inss?: number | null
          enc_provisorio?: number | null
          fgts?: number | null
          funcao_id: string
          id?: string
          multa_40_pct?: number | null
          plr?: number | null
          total_por_func?: number | null
          um_doze_decimo_terceiro?: number | null
          um_doze_lei_12506?: number | null
          um_terceiro_ferias?: number | null
          updated_at?: string | null
          va?: number | null
          vr?: number | null
          vt?: number | null
        }
        Update: {
          assid_asseio?: number | null
          aux_saude?: number | null
          bss?: number | null
          created_at?: string | null
          enc_inss?: number | null
          enc_provisorio?: number | null
          fgts?: number | null
          funcao_id?: string
          id?: string
          multa_40_pct?: number | null
          plr?: number | null
          total_por_func?: number | null
          um_doze_decimo_terceiro?: number | null
          um_doze_lei_12506?: number | null
          um_terceiro_ferias?: number | null
          updated_at?: string | null
          va?: number | null
          vr?: number | null
          vt?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "custos_funcoes_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: true
            referencedRelation: "funcoes"
            referencedColumns: ["id"]
          },
        ]
      }
      faltas: {
        Row: {
          cobertura_id: string | null
          created_at: string | null
          data_falta: string
          data_fim: string | null
          dias: number
          funcionario_id: string
          id: string
          justificativa: string | null
          observacao: string | null
          origem: string | null
          registrado_por: string
          tem_documento: boolean | null
          tipo: string
        }
        Insert: {
          cobertura_id?: string | null
          created_at?: string | null
          data_falta: string
          data_fim?: string | null
          dias?: number
          funcionario_id: string
          id?: string
          justificativa?: string | null
          observacao?: string | null
          origem?: string | null
          registrado_por: string
          tem_documento?: boolean | null
          tipo: string
        }
        Update: {
          cobertura_id?: string | null
          created_at?: string | null
          data_falta?: string
          data_fim?: string | null
          dias?: number
          funcionario_id?: string
          id?: string
          justificativa?: string | null
          observacao?: string | null
          origem?: string | null
          registrado_por?: string
          tem_documento?: boolean | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "faltas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faltas_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      fechamento_financeiro_resumos: {
        Row: {
          ano: number
          custo_ferias_extra: number
          custo_total: number
          excluiu_aprendiz: boolean
          gerado_em: string
          gerado_por: string | null
          id: string
          mes: number
          salario_total: number
          total_afastados: number
          total_ativos: number
          total_dias_ferias: number
          total_em_ferias: number
        }
        Insert: {
          ano: number
          custo_ferias_extra?: number
          custo_total?: number
          excluiu_aprendiz?: boolean
          gerado_em?: string
          gerado_por?: string | null
          id?: string
          mes: number
          salario_total?: number
          total_afastados?: number
          total_ativos?: number
          total_dias_ferias?: number
          total_em_ferias?: number
        }
        Update: {
          ano?: number
          custo_ferias_extra?: number
          custo_total?: number
          excluiu_aprendiz?: boolean
          gerado_em?: string
          gerado_por?: string | null
          id?: string
          mes?: number
          salario_total?: number
          total_afastados?: number
          total_ativos?: number
          total_dias_ferias?: number
          total_em_ferias?: number
        }
        Relationships: []
      }
      fechamento_itens: {
        Row: {
          coberturas_insalubres: number
          dias_atestado: number
          dias_faltas: number
          dias_ferias: number
          dias_suspensao: number
          dias_trabalhados: number
          dias_uteis_regime: number
          fechamento_id: string
          funcionario_id: string
          id: string
          posto_id: string | null
          regime: string
          secretaria: string | null
          tem_advertencia: boolean
          tem_suspensao: boolean
        }
        Insert: {
          coberturas_insalubres?: number
          dias_atestado?: number
          dias_faltas?: number
          dias_ferias?: number
          dias_suspensao?: number
          dias_trabalhados?: number
          dias_uteis_regime?: number
          fechamento_id: string
          funcionario_id: string
          id?: string
          posto_id?: string | null
          regime?: string
          secretaria?: string | null
          tem_advertencia?: boolean
          tem_suspensao?: boolean
        }
        Update: {
          coberturas_insalubres?: number
          dias_atestado?: number
          dias_faltas?: number
          dias_ferias?: number
          dias_suspensao?: number
          dias_trabalhados?: number
          dias_uteis_regime?: number
          fechamento_id?: string
          funcionario_id?: string
          id?: string
          posto_id?: string | null
          regime?: string
          secretaria?: string | null
          tem_advertencia?: boolean
          tem_suspensao?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "fechamento_itens_fechamento_id_fkey"
            columns: ["fechamento_id"]
            isOneToOne: false
            referencedRelation: "fechamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fechamento_itens_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fechamento_itens_posto_id_fkey"
            columns: ["posto_id"]
            isOneToOne: false
            referencedRelation: "postos"
            referencedColumns: ["id"]
          },
        ]
      }
      fechamentos: {
        Row: {
          ano: number
          gerado_em: string | null
          gerado_por: string
          id: string
          mes: number
          status: string
        }
        Insert: {
          ano: number
          gerado_em?: string | null
          gerado_por: string
          id?: string
          mes: number
          status?: string
        }
        Update: {
          ano?: number
          gerado_em?: string | null
          gerado_por?: string
          id?: string
          mes?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "fechamentos_gerado_por_fkey"
            columns: ["gerado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      ferias: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          created_at: string | null
          criado_por: string | null
          data_fim: string | null
          data_inicio: string | null
          dias_direito: number | null
          dias_utilizados: number | null
          funcionario_id: string
          id: string
          limite_gozo: string | null
          numero_periodo: number | null
          observacao: string | null
          pdf_url: string | null
          periodo_fim: string | null
          periodo_inicio: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          dias_direito?: number | null
          dias_utilizados?: number | null
          funcionario_id: string
          id?: string
          limite_gozo?: string | null
          numero_periodo?: number | null
          observacao?: string | null
          pdf_url?: string | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          dias_direito?: number | null
          dias_utilizados?: number | null
          funcionario_id?: string
          id?: string
          limite_gozo?: string | null
          numero_periodo?: number | null
          observacao?: string | null
          pdf_url?: string | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ferias_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ferias_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionarios: {
        Row: {
          cpf: string | null
          created_at: string | null
          data_admissao: string | null
          data_desligamento: string | null
          data_fim_fase1: string | null
          data_fim_fase2: string | null
          eh_encarregado_volante: boolean | null
          fase_experiencia: string | null
          funcao_id: string | null
          id: string
          motivo_afastamento: string | null
          motivo_desligamento: string | null
          nome: string
          periodo_experiencia: string | null
          posto_id: string | null
          registro: string | null
          salario: number | null
          salario_base: number | null
          status: string | null
          tipo_desligamento: string | null
          updated_at: string | null
        }
        Insert: {
          cpf?: string | null
          created_at?: string | null
          data_admissao?: string | null
          data_desligamento?: string | null
          data_fim_fase1?: string | null
          data_fim_fase2?: string | null
          eh_encarregado_volante?: boolean | null
          fase_experiencia?: string | null
          funcao_id?: string | null
          id?: string
          motivo_afastamento?: string | null
          motivo_desligamento?: string | null
          nome: string
          periodo_experiencia?: string | null
          posto_id?: string | null
          registro?: string | null
          salario?: number | null
          salario_base?: number | null
          status?: string | null
          tipo_desligamento?: string | null
          updated_at?: string | null
        }
        Update: {
          cpf?: string | null
          created_at?: string | null
          data_admissao?: string | null
          data_desligamento?: string | null
          data_fim_fase1?: string | null
          data_fim_fase2?: string | null
          eh_encarregado_volante?: boolean | null
          fase_experiencia?: string | null
          funcao_id?: string | null
          id?: string
          motivo_afastamento?: string | null
          motivo_desligamento?: string | null
          nome?: string
          periodo_experiencia?: string | null
          posto_id?: string | null
          registro?: string | null
          salario?: number | null
          salario_base?: number | null
          status?: string | null
          tipo_desligamento?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funcionarios_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "funcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_posto_id_fkey"
            columns: ["posto_id"]
            isOneToOne: false
            referencedRelation: "postos"
            referencedColumns: ["id"]
          },
        ]
      }
      funcoes: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          id: string
          insalubridade_perc: number | null
          insalubridade_valor: number | null
          nome: string
          periculosidade_perc: number | null
          periculosidade_valor: number | null
          salario_base: number | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          insalubridade_perc?: number | null
          insalubridade_valor?: number | null
          nome: string
          periculosidade_perc?: number | null
          periculosidade_valor?: number | null
          salario_base?: number | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          insalubridade_perc?: number | null
          insalubridade_valor?: number | null
          nome?: string
          periculosidade_perc?: number | null
          periculosidade_valor?: number | null
          salario_base?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      historico_funcionarios: {
        Row: {
          created_at: string
          dados_anteriores: Json | null
          dados_novos: Json | null
          data_evento: string
          descricao: string | null
          funcionario_id: string
          id: string
          registrado_por: string | null
          tipo: string
        }
        Insert: {
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          data_evento: string
          descricao?: string | null
          funcionario_id: string
          id?: string
          registrado_por?: string | null
          tipo: string
        }
        Update: {
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          data_evento?: string
          descricao?: string | null
          funcionario_id?: string
          id?: string
          registrado_por?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "historico_funcionarios_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_funcionarios_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      horarios_funcionarios: {
        Row: {
          created_at: string | null
          criado_por: string | null
          data_fim: string | null
          data_inicio: string
          dia_curso: number | null
          funcionario_id: string
          id: string
          turno_id: string
        }
        Insert: {
          created_at?: string | null
          criado_por?: string | null
          data_fim?: string | null
          data_inicio: string
          dia_curso?: number | null
          funcionario_id: string
          id?: string
          turno_id: string
        }
        Update: {
          created_at?: string | null
          criado_por?: string | null
          data_fim?: string | null
          data_inicio?: string
          dia_curso?: number | null
          funcionario_id?: string
          id?: string
          turno_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "horarios_funcionarios_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horarios_funcionarios_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horarios_funcionarios_turno_id_fkey"
            columns: ["turno_id"]
            isOneToOne: false
            referencedRelation: "turnos_postos"
            referencedColumns: ["id"]
          },
        ]
      }
      insalubridade_coberturas: {
        Row: {
          agente_ausente_id: string | null
          agente_ausente_nome: string | null
          ano: number
          cobertura_id: string | null
          created_at: string | null
          criado_por: string | null
          data_cobertura: string
          funcionario_id: string
          id: string
          mes: number
          observacao: string | null
          origem: string | null
          percentual: number | null
          periodo_dias: number
          posto_id: string | null
          status: string | null
        }
        Insert: {
          agente_ausente_id?: string | null
          agente_ausente_nome?: string | null
          ano: number
          cobertura_id?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_cobertura: string
          funcionario_id: string
          id?: string
          mes: number
          observacao?: string | null
          origem?: string | null
          percentual?: number | null
          periodo_dias?: number
          posto_id?: string | null
          status?: string | null
        }
        Update: {
          agente_ausente_id?: string | null
          agente_ausente_nome?: string | null
          ano?: number
          cobertura_id?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_cobertura?: string
          funcionario_id?: string
          id?: string
          mes?: number
          observacao?: string | null
          origem?: string | null
          percentual?: number | null
          periodo_dias?: number
          posto_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insalubridade_coberturas_agente_ausente_id_fkey"
            columns: ["agente_ausente_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insalubridade_coberturas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insalubridade_coberturas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insalubridade_coberturas_posto_id_fkey"
            columns: ["posto_id"]
            isOneToOne: false
            referencedRelation: "postos"
            referencedColumns: ["id"]
          },
        ]
      }
      log_supervisor_acoes: {
        Row: {
          acao: string
          created_at: string
          detalhes: string | null
          funcionario_nome: string | null
          id: string
          lido: boolean
          supervisor_id: string | null
          supervisor_nome: string
          tipo: string
        }
        Insert: {
          acao: string
          created_at?: string
          detalhes?: string | null
          funcionario_nome?: string | null
          id?: string
          lido?: boolean
          supervisor_id?: string | null
          supervisor_nome?: string
          tipo: string
        }
        Update: {
          acao?: string
          created_at?: string
          detalhes?: string | null
          funcionario_nome?: string | null
          id?: string
          lido?: boolean
          supervisor_id?: string | null
          supervisor_nome?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "log_supervisor_acoes_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      logs_alocacoes_mensais: {
        Row: {
          created_at: string | null
          efetivo_previsto: number | null
          efetivo_real: number | null
          id: string
          mes_referencia: string | null
          nomes_funcionarios: Json | null
          posto_id: string
        }
        Insert: {
          created_at?: string | null
          efetivo_previsto?: number | null
          efetivo_real?: number | null
          id?: string
          mes_referencia?: string | null
          nomes_funcionarios?: Json | null
          posto_id: string
        }
        Update: {
          created_at?: string | null
          efetivo_previsto?: number | null
          efetivo_real?: number | null
          id?: string
          mes_referencia?: string | null
          nomes_funcionarios?: Json | null
          posto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "logs_alocacoes_mensais_posto_id_fkey"
            columns: ["posto_id"]
            isOneToOne: false
            referencedRelation: "postos"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentacoes: {
        Row: {
          campo_alterado: string | null
          created_at: string | null
          enviado_rh: boolean
          executado_por: string | null
          funcionario_id: string
          id: string
          solicitacao_id: string | null
          tipo: string
          valor_antes: string | null
          valor_depois: string | null
        }
        Insert: {
          campo_alterado?: string | null
          created_at?: string | null
          enviado_rh?: boolean
          executado_por?: string | null
          funcionario_id: string
          id?: string
          solicitacao_id?: string | null
          tipo: string
          valor_antes?: string | null
          valor_depois?: string | null
        }
        Update: {
          campo_alterado?: string | null
          created_at?: string | null
          enviado_rh?: boolean
          executado_por?: string | null
          funcionario_id?: string
          id?: string
          solicitacao_id?: string | null
          tipo?: string
          valor_antes?: string | null
          valor_depois?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_executado_por_fkey"
            columns: ["executado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      ocorrencias: {
        Row: {
          created_at: string | null
          data_lembrete: string | null
          data_ocorrencia: string | null
          descricao: string | null
          gravidade: string | null
          id: string
          posto_id: string | null
          status: string | null
          supervisor_id: string
          tipo: string
          titulo: string | null
        }
        Insert: {
          created_at?: string | null
          data_lembrete?: string | null
          data_ocorrencia?: string | null
          descricao?: string | null
          gravidade?: string | null
          id?: string
          posto_id?: string | null
          status?: string | null
          supervisor_id: string
          tipo?: string
          titulo?: string | null
        }
        Update: {
          created_at?: string | null
          data_lembrete?: string | null
          data_ocorrencia?: string | null
          descricao?: string | null
          gravidade?: string | null
          id?: string
          posto_id?: string | null
          status?: string | null
          supervisor_id?: string
          tipo?: string
          titulo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ocorrencias_posto_id_fkey"
            columns: ["posto_id"]
            isOneToOne: false
            referencedRelation: "postos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocorrencias_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          email: string | null
          id: string
          nome: string | null
          role: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          email?: string | null
          id: string
          nome?: string | null
          role?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          email?: string | null
          id?: string
          nome?: string | null
          role?: string | null
        }
        Relationships: []
      }
      postos: {
        Row: {
          ativo: boolean | null
          contrato_id: string | null
          cota_insalubridade: number | null
          created_at: string | null
          efetivo_previsto: number | null
          id: string
          nome: string
          secretaria: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          contrato_id?: string | null
          cota_insalubridade?: number | null
          created_at?: string | null
          efetivo_previsto?: number | null
          id?: string
          nome: string
          secretaria?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          contrato_id?: string | null
          cota_insalubridade?: number | null
          created_at?: string | null
          efetivo_previsto?: number | null
          id?: string
          nome?: string
          secretaria?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "postos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      snapshots_diarios: {
        Row: {
          afastados: number
          aprovacoes_pendentes: number
          ativos: number
          coberturas_ativas: number
          created_at: string | null
          data: string
          em_ferias: number
          postos_deficit: number
        }
        Insert: {
          afastados: number
          aprovacoes_pendentes: number
          ativos: number
          coberturas_ativas: number
          created_at?: string | null
          data: string
          em_ferias: number
          postos_deficit: number
        }
        Update: {
          afastados?: number
          aprovacoes_pendentes?: number
          ativos?: number
          coberturas_ativas?: number
          created_at?: string | null
          data?: string
          em_ferias?: number
          postos_deficit?: number
        }
        Relationships: []
      }
      snapshots_mensais: {
        Row: {
          afastados: number | null
          aprovacoes_pendentes: number | null
          ativos: number | null
          coberturas_ativas: number | null
          created_at: string | null
          em_ferias: number | null
          mes: string
          postos_deficit: number | null
        }
        Insert: {
          afastados?: number | null
          aprovacoes_pendentes?: number | null
          ativos?: number | null
          coberturas_ativas?: number | null
          created_at?: string | null
          em_ferias?: number | null
          mes: string
          postos_deficit?: number | null
        }
        Update: {
          afastados?: number | null
          aprovacoes_pendentes?: number | null
          ativos?: number | null
          coberturas_ativas?: number | null
          created_at?: string | null
          em_ferias?: number | null
          mes?: string
          postos_deficit?: number | null
        }
        Relationships: []
      }
      solicitacoes: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          created_at: string | null
          dados_antes: Json | null
          dados_depois: Json | null
          funcionario_id: string | null
          id: string
          lida_supervisor: boolean
          motivo: string | null
          motivo_rejeicao: string | null
          observacao_admin: string | null
          status: string
          supervisor_id: string | null
          tipo: string
          vigencia: string | null
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string | null
          dados_antes?: Json | null
          dados_depois?: Json | null
          funcionario_id?: string | null
          id?: string
          lida_supervisor?: boolean
          motivo?: string | null
          motivo_rejeicao?: string | null
          observacao_admin?: string | null
          status?: string
          supervisor_id?: string | null
          tipo: string
          vigencia?: string | null
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string | null
          dados_antes?: Json | null
          dados_depois?: Json | null
          funcionario_id?: string | null
          id?: string
          lida_supervisor?: boolean
          motivo?: string | null
          motivo_rejeicao?: string | null
          observacao_admin?: string | null
          status?: string
          supervisor_id?: string | null
          tipo?: string
          vigencia?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      transferencias: {
        Row: {
          created_at: string | null
          criado_por: string | null
          data_transferencia: string | null
          funcionario_id: string
          id: string
          motivo: string | null
          observacao_coordenador: string | null
          posto_destino_id: string
          posto_origem_id: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          criado_por?: string | null
          data_transferencia?: string | null
          funcionario_id: string
          id?: string
          motivo?: string | null
          observacao_coordenador?: string | null
          posto_destino_id: string
          posto_origem_id: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          criado_por?: string | null
          data_transferencia?: string | null
          funcionario_id?: string
          id?: string
          motivo?: string | null
          observacao_coordenador?: string | null
          posto_destino_id?: string
          posto_origem_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transferencias_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_posto_destino_id_fkey"
            columns: ["posto_destino_id"]
            isOneToOne: false
            referencedRelation: "postos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_posto_origem_id_fkey"
            columns: ["posto_origem_id"]
            isOneToOne: false
            referencedRelation: "postos"
            referencedColumns: ["id"]
          },
        ]
      }
      turnos_postos: {
        Row: {
          ativo: boolean
          created_at: string | null
          hora_entrada: string
          hora_fim_almoco: string | null
          hora_inicio_almoco: string | null
          hora_saida_seg_qui: string
          hora_saida_sex: string | null
          id: string
          nome: string
          posto_id: string | null
          tipo_escala: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string | null
          hora_entrada: string
          hora_fim_almoco?: string | null
          hora_inicio_almoco?: string | null
          hora_saida_seg_qui: string
          hora_saida_sex?: string | null
          id?: string
          nome: string
          posto_id?: string | null
          tipo_escala?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string | null
          hora_entrada?: string
          hora_fim_almoco?: string | null
          hora_inicio_almoco?: string | null
          hora_saida_seg_qui?: string
          hora_saida_sex?: string | null
          id?: string
          nome?: string
          posto_id?: string | null
          tipo_escala?: string
        }
        Relationships: [
          {
            foreignKeyName: "turnos_postos_posto_id_fkey"
            columns: ["posto_id"]
            isOneToOne: false
            referencedRelation: "postos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_supervisor_posto_ids: { Args: never; Returns: string[] }
      is_admin_or_coord: { Args: never; Returns: boolean }
      is_supervisor: { Args: never; Returns: boolean }
      is_viewer: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
