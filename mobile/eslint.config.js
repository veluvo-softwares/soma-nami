// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'android/*', 'ios/*', 'qvac/*', 'coverage/*', 'pears/*'], // pears/ is a Bare project (its own globals), checked by its selftest
  },
]);
