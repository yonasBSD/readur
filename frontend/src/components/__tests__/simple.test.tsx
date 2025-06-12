import { describe, test, expect } from 'vitest'

describe('Simple Tests', () => {
  test('basic math works', () => {
    expect(1 + 1).toBe(2)
  })

  test('string operations work', () => {
    expect('hello'.toUpperCase()).toBe('HELLO')
  })
})