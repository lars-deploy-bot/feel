import { describe, it, expect, beforeEach } from 'bun:test'
import { PATHS, DEFAULTS } from '../src/config'

describe('Configuration Constants', () => {
  it('should have valid site root paths', () => {
    expect(PATHS.SITES_ROOT).toMatch(/^\//)
    expect(PATHS.LEGACY_SITES_ROOT).toMatch(/^\//)
  })

  it('should have valid registry path', () => {
    expect(PATHS.REGISTRY_PATH).toMatch(/\.json$/)
    expect(PATHS.REGISTRY_PATH).toContain('domain-passwords')
  })

  it('should have valid Caddyfile path', () => {
    expect(PATHS.CADDYFILE_PATH).toMatch(/Caddyfile$/)
  })

  it('should have valid systemd paths', () => {
    expect(PATHS.SYSTEMD_ENV_DIR).toBe('/etc/sites')
  })

  it('should have valid lock timeout', () => {
    expect(DEFAULTS.FLOCK_TIMEOUT).toBeGreaterThan(0)
    expect(typeof DEFAULTS.FLOCK_TIMEOUT).toBe('number')
  })
})

describe('Port Range Validation', () => {
  it('should have valid port range', () => {
    expect(DEFAULTS.MIN_PORT).toBe(3333)
    expect(DEFAULTS.MAX_PORT).toBe(3999)
    expect(DEFAULTS.MIN_PORT).toBeLessThan(DEFAULTS.MAX_PORT)
  })
})

describe('Server Configuration', () => {
  it('should have valid server IP', () => {
    expect(DEFAULTS.SERVER_IP).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)
  })

  it('should have valid wildcard domain', () => {
    expect(DEFAULTS.WILDCARD_DOMAIN).toBe('alive.best')
  })
})
