import { describe, expect, it } from 'vitest'
import { marcaValida } from '@/lib/catalogos'

describe('marcaValida — validación por formato, ya no por lista cerrada', () => {
  it('acepta marcas conocidas del catálogo semilla', () => {
    expect(marcaValida('LG')).toBe(true)
    expect(marcaValida('Samsung')).toBe(true)
    expect(marcaValida('ONN')).toBe(true)
  })

  it('acepta una marca nueva que no está en el catálogo semilla', () => {
    expect(marcaValida('Hisense')).toBe(true)
    expect(marcaValida('TCL')).toBe(true)
    expect(marcaValida('Marca Totalmente Nueva')).toBe(true)
  })

  it('acepta letras, números, espacios, puntos, ampersand y guion', () => {
    expect(marcaValida('J.V.C')).toBe(true)
    expect(marcaValida('AT&T')).toBe(true)
    expect(marcaValida('Element-2')).toBe(true)
    expect(marcaValida('LG 2024')).toBe(true)
  })

  it('recorta espacios al inicio/fin antes de validar', () => {
    expect(marcaValida('  LG  ')).toBe(true)
  })

  it('rechaza cadena vacía o solo espacios', () => {
    expect(marcaValida('')).toBe(false)
    expect(marcaValida('   ')).toBe(false)
  })

  it('rechaza null, undefined y no-strings', () => {
    expect(marcaValida(null)).toBe(false)
    expect(marcaValida(undefined)).toBe(false)
    expect(marcaValida(123)).toBe(false)
    expect(marcaValida(['LG'])).toBe(false)
  })

  it('rechaza caracteres no permitidos como signos de puntuación arbitrarios', () => {
    expect(marcaValida('LG<script>')).toBe(false)
    expect(marcaValida('Samsung;DROP TABLE')).toBe(false)
    expect(marcaValida('#Marca')).toBe(false)
  })

  it('rechaza una marca que exceda el largo máximo (40 caracteres)', () => {
    expect(marcaValida('A'.repeat(40))).toBe(true)
    expect(marcaValida('A'.repeat(41))).toBe(false)
  })

  it('acepta marcas con acentos o caracteres unicode de letra', () => {
    expect(marcaValida('Zúñiga')).toBe(true)
  })
})
