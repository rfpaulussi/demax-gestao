ALTER TABLE ferias DROP CONSTRAINT IF EXISTS ferias_status_check;

ALTER TABLE ferias ADD CONSTRAINT ferias_status_check
CHECK (status = ANY (ARRAY[
  'agendado'::text,
  'aprovado'::text,
  'em_curso'::text,
  'concluido'::text,
  'cancelado'::text
]));
