export type RespostaEncaminhamento =
  | { ok: true; enviadoEm: string }
  | { ok: false; erro: string }
