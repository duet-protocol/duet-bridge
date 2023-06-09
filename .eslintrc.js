module.exports = {
  env: {
    browser: false,
    es2021: true,
    mocha: true,
    node: true,
  },
  plugins: ['@typescript-eslint'],
  extends: ['standard', 'plugin:prettier/recommended', 'plugin:node/recommended'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 16,
  },
  rules: {
    'node/no-unsupported-features/es-syntax': ['error', { ignores: ['modules'] }],
    'node/no-extraneous-import': ['off'],
    'node/no-extraneous-require': ['off'],
    'node/no-missing-import': ['warn'],
    'no-unused-vars': ['warn'],
    'node/no-unpublished-require': ['warn'],
    'node/no-unpublished-import': ['warn'],
  },
}
