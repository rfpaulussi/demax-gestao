-- Adiciona campo tipo_motivo em coberturas_temporarias
-- Valores: 'atestado_medico' | 'falta_justificada' | 'falta_injustificada' |
--          'ferias' | 'licenca' | 'folga' | 'outros'
ALTER TABLE coberturas_temporarias ADD COLUMN IF NOT EXISTS tipo_motivo varchar(50);
