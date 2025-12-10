import { cn, formatPriceForDisplay, parsePriceFromUserInput } from '../utils'

describe('utils', () => {
  describe('cn', () => {
    it('should merge class names correctly', () => {
      expect(cn('px-2', 'py-1')).toBe('px-2 py-1')
    })

    it('should handle conditional classes', () => {
      expect(cn('px-2', false && 'hidden', 'py-1')).toBe('px-2 py-1')
    })

    it('should override conflicting Tailwind classes', () => {
      expect(cn('px-2', 'px-4')).toBe('px-4')
    })
  })

  describe('formatPriceForDisplay', () => {
    it('should format price with comma decimal separator', () => {
      expect(formatPriceForDisplay(1234.56)).toBe('1.234,56')
    })

    it('should format price without decimals correctly', () => {
      expect(formatPriceForDisplay(1000)).toBe('1.000,00')
    })

    it('should handle small amounts', () => {
      expect(formatPriceForDisplay(5.99)).toBe('5,99')
    })

    it('should handle zero', () => {
      expect(formatPriceForDisplay(0)).toBe('0,00')
    })
  })

  describe('parsePriceFromUserInput', () => {
    it('should parse German/Dutch formatted price', () => {
      expect(parsePriceFromUserInput('1.234,56')).toBe(1234.56)
    })

    it('should handle price without thousands separator', () => {
      expect(parsePriceFromUserInput('99,99')).toBe(99.99)
    })

    it('should handle integer values', () => {
      expect(parsePriceFromUserInput('100')).toBe(100)
    })

    it('should handle edge cases', () => {
      expect(parsePriceFromUserInput('0')).toBe(0)
      expect(parsePriceFromUserInput('0,00')).toBe(0)
    })
  })
})
