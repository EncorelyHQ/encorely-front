// @ts-check
const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'android/*', 'ios/*', '.expo/*', 'src/lib/api/schema.d.ts'],
  },
  {
    rules: {
      // El texto descifrado, las llaves y los tokens nunca van a la consola.
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['src/features/chat/crypto/**', 'src/features/chat/keys/**'],
    rules: { 'no-console': 'error' },
  },
])
