ALTER TABLE cid_referencia ADD COLUMN IF NOT EXISTS nexo_ocupacional_limpeza BOOLEAN DEFAULT false;

UPDATE cid_referencia SET nexo_ocupacional_limpeza = true
WHERE codigo IN ('M25.5','M51','M54.4','M54.5','M65','M75','M77','S00-T98','L03','J45','H10');
