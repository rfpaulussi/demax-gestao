-- CID R42 e outros códigos do grupo R (sintomas/sinais gerais)
-- frequentes em atestados de trabalhadores de limpeza
INSERT INTO cid_referencia (codigo, descricao) VALUES
  ('R42',  'Tontura e vertigem'),
  ('R50.9','Febre não especificada'),
  ('R53',  'Mal-estar e fadiga'),
  ('R55',  'Síncope e colapso (desmaio)'),
  ('R60.0','Edema localizado'),
  ('R61',  'Hiperhidrose (sudorese excessiva)'),
  ('R68.8','Outros sintomas e sinais gerais especificados')
ON CONFLICT (codigo) DO NOTHING;
