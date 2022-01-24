module.exports = {
    plugins: [
        'eslint-plugin-import',
        'eslint-plugin-unicorn',
        '@typescript-eslint',
    ],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        // TODO: doesn't work for some reason from this config and has to be imported separately
        // 'prettier',
    ],
    rules: {
        /**
         * eslint
         */
        'no-await-in-loop': 'warn',
        'no-console': [
            'warn',
            {
                allow: ['log', 'warn', 'error', 'assert'],
            },
        ],
        'no-promise-executor-return': 'warn',
        'no-template-curly-in-string': 'warn',
        'no-unreachable-loop': 'warn',
        'no-useless-backreference': 'warn',
        'require-atomic-updates': 'warn',
        'array-callback-return': 'warn',
        // "class-methods-use-this": "warn",
        'default-case-last': 'warn',
        eqeqeq: ['warn', 'always'],
        'grouped-accessor-pairs': 'warn',
        'guard-for-in': 'warn',
        // "max-classes-per-file": ["warn", 3],
        'no-caller': 'warn',
        'no-constructor-return': 'warn',
        'no-div-regex': 'warn',
        'no-else-return': 'warn',
        'no-eval': 'warn',
        'no-extend-native': 'warn',
        'no-extra-bind': 'warn',
        'no-extra-label': 'warn',
        'no-floating-decimal': 'warn',
        'no-implicit-globals': 'warn',
        'no-iterator': 'warn',
        'no-labels': 'warn',
        'no-lone-blocks': 'warn',
        'no-magic-numbers': 'off',
        'no-new': 'warn',
        'no-new-func': 'warn',
        'no-new-wrappers': 'warn',
        'no-octal-escape': 'warn',
        'no-param-reassign': 'warn',
        'no-proto': 'warn',
        'no-return-assign': 'warn',
        'no-script-url': 'warn',
        'no-self-compare': 'warn',
        'no-sequences': 'warn',
        // "no-unmodified-loop-condition": "warn",
        'no-useless-call': 'warn',
        'no-useless-concat': 'warn',
        'no-useless-return': 'warn',
        'no-void': 'warn',
        'prefer-regex-literals': 'warn',
        radix: ['warn', 'as-needed'],
        'require-unicode-regexp': 'warn',
        yoda: 'warn',
        'no-undefined': 'off',
        'arrow-body-style': 'warn',
        'no-restricted-exports': 'warn',
        'no-restricted-imports': [
            'warn',
            {
                name: 'lodash',
                importNames: ['lodash-es'],
                message: 'Please use lodash-es instead.',
            },
            'assert',
            'buffer',
            'child_process',
            'cluster',
            'crypto',
            'dgram',
            'dns',
            'domain',
            'events',
            'freelist',
            'fs',
            'http',
            'https',
            'module',
            'net',
            'os',
            'path',
            'punycode',
            'querystring',
            'readline',
            'repl',
            'smalloc',
            'stream',
            'string_decoder',
            'sys',
            'timers',
            'tls',
            'tracing',
            'tty',
            'url',
            'util',
            'vm',
            'zlib',
        ],
        'no-useless-computed-key': ['warn', { enforceForClassMembers: true }],
        'no-useless-rename': 'warn',
        'no-var': 'warn',
        'object-shorthand': 'warn',
        'prefer-arrow-callback': 'warn',
        'prefer-const': 'warn',
        'prefer-numeric-literals': 'warn',
        'prefer-rest-params': 'warn',
        'prefer-spread': 'warn',
        'prefer-template': 'warn',
        // eslint-plugin-import does that instead (with autofix)
        'sort-imports': 'off',
        'symbol-description': 'warn',
        'id-match': 'warn',
        'no-bitwise': 'warn',
        'max-len': [
            'warn',
            {
                code: 140,
                ignoreStrings: true,
                ignoreComments: true,
                ignoreUrls: true,
                ignoreRegExpLiterals: true,
                ignoreTemplateLiterals: true,
            },
        ],
        'no-debugger': 'warn',
        'no-duplicate-case': 'warn',
        'no-empty': 'off',
        'no-fallthrough': 'warn',
        'no-trailing-spaces': 'warn',
        'no-undef-init': 'warn',
        'no-unused-labels': 'warn',
        'spaced-comment': [
            'warn',
            'always',
            {
                markers: ['/'],
            },
        ],
        //  disabled because @typescript-eslint implements them
        'dot-notation': 'off',
        'no-empty-function': 'off',
        'no-unused-expressions': 'off',
        quotes: 'off',
        'no-useless-constructor': 'off',
        'no-dupe-class-members': 'off',
        'no-implied-eval': 'off',
        'no-invalid-this': 'off',
        'no-loop-func': 'off',
        'no-loss-of-precision': 'off',
        'no-redeclare': 'off',
        'no-shadow': 'off',
        'no-throw-literal': 'off',
        'no-unused-vars': 'off',
        'no-use-before-define': 'off',
        'no-return-await': 'off',
        'require-await': 'off',

        /**
         * eslint-plugin-unicorn
         */
        'unicorn/filename-case': 'warn',
        'unicorn/better-regex': 'warn',
        'unicorn/consistent-function-scoping': 'off',
        'unicorn/custom-error-definition': 'off',
        'unicorn/error-message': 'warn',
        'unicorn/escape-case': 'warn',
        'unicorn/expiring-todo-comments': 'warn',
        'unicorn/import-index': 'warn',
        'unicorn/no-for-loop': 'warn',
        'unicorn/no-keyword-prefix': 'off',
        'unicorn/no-unsafe-regex': 'off',
        'unicorn/no-unused-properties': 'off',
        'unicorn/no-useless-undefined': 'off',
        'unicorn/no-zero-fractions': 'warn',
        'unicorn/number-literal-case': 'warn',
        'unicorn/numeric-separators-style': 'off',
        // "unicorn/prefer-add-event-listener": "warn",
        'unicorn/prefer-keyboard-event-key': 'warn',
        'unicorn/prefer-array-flat-map': 'warn',
        'unicorn/prefer-includes': 'warn',
        'unicorn/prefer-math-trunc': 'warn',
        'unicorn/prefer-modern-dom-apis': 'warn',
        'unicorn/prefer-negative-index': 'warn',
        'unicorn/prefer-dom-node-append': 'warn',
        'unicorn/prefer-dom-node-remove': 'warn',
        'unicorn/prefer-number-properties': 'warn',
        'unicorn/prefer-optional-catch-binding': 'warn',
        'unicorn/prefer-query-selector': 'warn',
        'unicorn/prefer-reflect-apply': 'warn',
        'unicorn/prefer-string-replace-all': 'off',
        'unicorn/prefer-set-has': 'warn',
        'unicorn/prefer-spread': 'warn',
        'unicorn/prefer-string-starts-ends-with': 'warn',
        'unicorn/prefer-string-slice': 'warn',
        'unicorn/prefer-ternary': 'off',
        'unicorn/prefer-dom-node-text-content': 'warn',
        'unicorn/prefer-string-trim-start-end': 'warn',
        'unicorn/prefer-type-error': 'warn',
        'unicorn/prefer-array-some': 'warn',
        'unicorn/prefer-array-index-of': 'warn',
        'unicorn/prefer-regexp-test': 'warn',
        'unicorn/no-new-array': 'warn',
        'unicorn/prefer-default-parameters': 'warn',
        'unicorn/consistent-destructuring': 'warn',
        'unicorn/no-this-assignment': 'warn',
        'unicorn/no-array-push-push': 'warn',
        'unicorn/prefer-array-flat': 'warn',
        'unicorn/prefer-node-protocol': 'warn',
        'unicorn/no-array-for-each': 'off',
        // "unicorn/prevent-abbreviations": "warn",
        'unicorn/string-content': [
            'warn',
            {
                patterns: {
                    '\\.\\.\\.': '…',
                },
            },
        ],
        /**
         * eslint-plugin-import
         */
        'import/no-deprecated': 'warn',
        'import/order': 'warn',

        /**
         * @typescript-eslint
         */
        // "@typescript-eslint/array-type": "array-simple",
        '@typescript-eslint/ban-tslint-comment': 'warn',
        '@typescript-eslint/class-literal-property-style': ['warn', 'fields'],
        '@typescript-eslint/consistent-indexed-object-style': [
            'warn',
            'index-signature',
        ],
        '@typescript-eslint/consistent-type-assertions': [
            'warn',
            {
                assertionStyle: 'as',
                objectLiteralTypeAssertions: 'allow-as-parameter',
            },
        ],
        '@typescript-eslint/consistent-type-definitions': ['warn', 'interface'],
        '@typescript-eslint/consistent-type-imports': [
            'warn',
            {
                prefer: 'type-imports',
                disallowTypeAnnotations: true,
            },
        ],
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        // "@typescript-eslint/explicit-member-accessibility": "warn",
        '@typescript-eslint/member-ordering': [
            'warn',
            {
                default: {
                    memberTypes: 'never',
                    order: 'as-written',
                },
            },
        ],
        '@typescript-eslint/method-signature-style': 'warn',
        '@typescript-eslint/naming-convention': [
            'warn',
            {
                selector: 'default',
                format: ['camelCase'],
                leadingUnderscore: 'forbid',
                trailingUnderscore: 'forbid',
            },
            {
                selector: ['class', 'typeLike'],
                format: ['PascalCase'],
            },
            {
                selector: 'default',
                format: [],
                modifiers: ['public'],
                leadingUnderscore: 'allow',
            },
        ],
        '@typescript-eslint/no-base-to-string': 'warn',
        '@typescript-eslint/no-confusing-non-null-assertion': 'warn',
        '@typescript-eslint/no-namespace': 'warn',
        '@typescript-eslint/non-nullable-type-assertion-style': 'warn',
        '@typescript-eslint/sort-type-union-intersection-members': 'warn',
        '@typescript-eslint/no-confusing-void-expression': [
            'warn',
            { ignoreArrowShorthand: true },
        ],
        // "@typescript-eslint/no-dynamic-delete": "warn",
        '@typescript-eslint/no-empty-interface': 'off',
        '@typescript-eslint/no-explicit-any': ['off'],
        '@typescript-eslint/no-extraneous-class': [
            'warn',
            { allowWithDecorator: true, allowStaticOnly: true },
        ],
        // maybe turn on later...
        '@typescript-eslint/no-floating-promises': 'off',
        '@typescript-eslint/no-implicit-any-catch': [
            'warn',
            { allowExplicitAny: true },
        ],
        '@typescript-eslint/no-invalid-void-type': 'warn',
        '@typescript-eslint/no-parameter-properties': 'off',
        '@typescript-eslint/no-require-imports': 'warn',
        '@typescript-eslint/no-type-alias': 'off',
        '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'warn',
        // Because `object[key]` is always truthy for ts
        '@typescript-eslint/no-unnecessary-condition': 'off',
        '@typescript-eslint/no-unnecessary-qualifier': 'warn',
        '@typescript-eslint/no-unnecessary-type-arguments': 'warn',
        '@typescript-eslint/no-unnecessary-type-constraint': 'warn',
        '@typescript-eslint/prefer-enum-initializers': 'warn',
        '@typescript-eslint/prefer-for-of': 'warn',
        '@typescript-eslint/prefer-function-type': 'warn',
        '@typescript-eslint/prefer-includes': 'warn',
        '@typescript-eslint/prefer-literal-enum-member': 'warn',
        '@typescript-eslint/prefer-namespace-keyword': 'off',
        '@typescript-eslint/prefer-nullish-coalescing': 'warn',
        '@typescript-eslint/prefer-optional-chain': 'warn',
        '@typescript-eslint/prefer-readonly': 'warn',
        // "@typescript-eslint/prefer-readonly-parameter-types": "warn",
        '@typescript-eslint/prefer-reduce-type-parameter': 'warn',
        '@typescript-eslint/prefer-regexp-exec': 'warn',
        '@typescript-eslint/prefer-string-starts-ends-with': 'warn',
        '@typescript-eslint/prefer-ts-expect-error': 'warn',
        '@typescript-eslint/promise-function-async': 'warn',
        '@typescript-eslint/require-array-sort-compare': 'warn',
        // "@typescript-eslint/strict-boolean-expressions": "warn",
        '@typescript-eslint/switch-exhaustiveness-check': 'warn',
        '@typescript-eslint/unified-signatures': 'warn',
        // Extension rules that should be used instead of the eslint ones:
        '@typescript-eslint/default-param-last': 'warn',
        '@typescript-eslint/dot-notation': 'warn',
        '@typescript-eslint/no-dupe-class-members': 'warn',
        '@typescript-eslint/no-duplicate-imports': 'warn',
        '@typescript-eslint/no-empty-function': 'warn',
        '@typescript-eslint/no-implied-eval': 'warn',
        '@typescript-eslint/no-invalid-this': 'warn',
        '@typescript-eslint/no-loop-func': 'warn',
        '@typescript-eslint/no-loss-of-precision': 'warn',
        '@typescript-eslint/no-redeclare': 'warn',
        '@typescript-eslint/no-shadow': [
            'warn',
            {
                builtinGlobals: true,
                hoist: 'all',
            },
        ],
        '@typescript-eslint/no-throw-literal': 'warn',
        '@typescript-eslint/no-unused-expressions': 'warn',
        '@typescript-eslint/no-unused-vars': ['warn', { args: 'none' }],
        '@typescript-eslint/no-use-before-define': 'off',
        '@typescript-eslint/no-useless-constructor': ['warn'],
        '@typescript-eslint/require-await': ['off'],
        '@typescript-eslint/return-await': ['warn'],
        '@typescript-eslint/explicit-member-accessibility': [
            'off',
            {
                accessibility: 'explicit',
            },
        ],
        '@typescript-eslint/no-inferrable-types': [
            'warn',
            {
                ignoreParameters: true,
            },
        ],
        '@typescript-eslint/no-misused-new': 'warn',
        '@typescript-eslint/no-non-null-assertion': 'off',
        // "@typescript-eslint/no-param-reassign": "warn",
        '@typescript-eslint/no-unnecessary-type-assertion': 'off',
    },
};