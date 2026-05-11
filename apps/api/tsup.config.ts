import { defineConfig } from 'tsup'

export default defineConfig({
  noExternal: ['@leseflux/shared'],
})
