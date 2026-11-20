import { describe, expect, it } from 'vitest'
import { formatDensity, formatDiscovery, formatTemperature, prettyConfig } from './format'

describe('format helpers', () => {
  it('renders electron configurations with superscripts', () => {
    expect(prettyConfig('[Ar] 3d6 4s2')).toBe('[Ar] 3d⁶ 4s²')
    expect(prettyConfig('[Xe] 4f14 5d10 6s2')).toBe('[Xe] 4f¹⁴ 5d¹⁰ 6s²')
  })

  it('shows temperatures in kelvin and celsius', () => {
    expect(formatTemperature(273.15)).toBe('273 K · 0 °C')
    expect(formatTemperature(null)).toBe('—')
  })

  it('uses scientific notation for gas densities', () => {
    expect(formatDensity(0.00008988)).toBe('8.99×10⁻⁵ g/cm³')
    expect(formatDensity(7.874)).toBe('7.874 g/cm³')
  })

  it('describes ancient discoveries', () => {
    expect(formatDiscovery(-2000, null)).toBe('c. 2,000 BC')
    expect(formatDiscovery(null, null)).toBe('Known since ancient times')
    expect(formatDiscovery(1807, 'Humphry Davy')).toBe('1807 · Humphry Davy')
  })
})
