module.exports = {
  env: {
    node: true,
    browser: true,
    es2021: true,
  },
  extends: [
    'eslint:recommended',
  ],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
  },
  rules: {
    'no-unused-vars': 'warn',
    'no-console': 'off',
    'indent': 'off', // Disable indent rule due to mixed formatting
    'quotes': 'off', // Disable quotes rule
    'semi': 'off', // Disable semicolon rule
    'no-undef': 'warn', // Warn about undefined variables
    'no-mixed-spaces-and-tabs': 'warn',
    'no-case-declarations': 'off', // Allow declarations in case blocks
    'no-dupe-else-if': 'warn', // Warn about duplicate conditions
    'no-dupe-class-members': 'warn', // Warn about duplicate class members
  },
  globals: {
    'window': 'readonly',
    'document': 'readonly',
    'localStorage': 'readonly',
    'alert': 'readonly',
    'solanaWeb3': 'readonly',
    'io': 'readonly',
    'anchor': 'readonly',
  },
};
