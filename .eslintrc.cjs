/* eslint-env node */
module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:vue/vue3-recommended',
    'prettier'
  ],
  parser: 'vue-eslint-parser',
  parserOptions: {
    ecmaVersion: 'latest',
    parser: '@typescript-eslint/parser',
    sourceType: 'module'
  },
  plugins: ['@typescript-eslint', 'vue'],
  rules: {
    // TypeScript
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }
    ],
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-non-null-assertion': 'warn',

    // Vue
    'vue/multi-word-component-names': 'off',
    'vue/require-default-prop': 'off',
    'vue/no-v-html': 'warn',
    'vue/component-name-in-template-casing': [
      'error',
      'PascalCase',
      {
        registeredComponentsOnly: false
      }
    ],
    'vue/component-api-style': ['error', ['script-setup']],
    'vue/block-lang': [
      'error',
      {
        script: {
          lang: 'ts'
        }
      }
    ],

    // General
    'no-console': [
      'warn',
      {
        allow: ['warn', 'error']
      }
    ],
    'no-debugger': 'warn',
    'no-unused-vars': 'off', // 使用 TypeScript 的规则
    'prefer-const': 'error',
    'no-var': 'error',
    eqeqeq: ['error', 'always'],
    curly: ['error', 'all'],

    // Import
    'sort-imports': [
      'warn',
      {
        ignoreCase: true,
        ignoreDeclarationSort: true
      }
    ]
  },
  overrides: [
    {
      files: ['*.vue'],
      rules: {
        // Vue 特定规则
        'vue/no-setup-props-destructure': 'error'
      }
    },
    {
      files: ['*.spec.ts', '*.test.ts'],
      rules: {
        // 测试文件允许 any
        '@typescript-eslint/no-explicit-any': 'off'
      }
    }
  ]
}
