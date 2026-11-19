// lib/absenteismo/hoje.test.ts
import { describe, it, expect } from 'vitest'
import { hojeBrasilia } from './hoje'

describe('hojeBrasilia', () => {
  it('meio-dia UTC é o mesmo dia em Brasília', () => {
    expect(hojeBrasilia(new Date('2026-11-19T12:00:00Z'))).toBe('2026-11-19')
  })
  it('01:30 UTC ainda é o dia anterior em Brasília (UTC-3)', () => {
    expect(hojeBrasilia(new Date('2026-11-20T01:30:00Z'))).toBe('2026-11-19')
  })
  it('03:00 UTC já é o dia seguinte em Brasília', () => {
    expect(hojeBrasilia(new Date('2026-11-20T03:00:00Z'))).toBe('2026-11-20')
  })
})
