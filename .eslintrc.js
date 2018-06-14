module.exports = {
    root: true,
    parser: 'babel-eslint',
    parserOptions: {
        sourceType: 'module'
    },
    env: {
        browser: true,
    },
    extends: 'airbnb-base',
    plugins: [
        // Add any plugins required for specific projects, such as 'html' for Vue apps.
    ],
    globals: {
        // Add any global defs to allow, e.g. 'Blockly' for Blockly interfaces.
    },
    // Uncomment this block to use the Webpack resolver to check if imports are valid.
    // settings: {
    //     'import/resolver': {
    //         'webpack': {
    //             'config': 'build/webpack.base.conf.js'
    //         }
    //     }
    // },
    rules: {
        // Our rules are based on "AirBNB Base'. Below are our overrides.
        'indent': ['error', 4, { SwitchCase: 1 }], // 4-space indents
        'no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true, allowTaggedTemplates: true }],
        'max-len': ['error', {
            code: 120,                             // We all have big screens - use them!
            ignoreUrls: true,                      // A bunch of these things are a pain to maintain when wrapped...
            ignoreStrings: true,
            ignoreRegExpLiterals: true,
            ignoreTemplateLiterals: true,
        }],
        'arrow-parens': ['error', 'as-needed'],    // No reason to write ((a) => {..}) when (a => {..}) will do
        'no-trailing-spaces': 0,                   // Many IDEs insert these, they're invisible, and cause no harm
        'no-alert': 0,                             // These are actually pretty useful in modern browsers
        'comma-dangle': 0,                         // This seems good but ends up being painful in large nested objects
        'func-names': ['error', 'as-needed'],      // Only require function names when required.
        'no-plusplus': 0,                          // i += 1 is REALLY annoying for devs used to ++. We'll be careful.
        'class-methods-use-this': 0,               // We have plenty of good reasons to define classes this way

        // Project specific:
        'no-console': 0,

        // don't require extensions when importing
        'import/extensions': ['error', 'always', {
            'js': 'never',
        }],

        // allow optionalDependencies
        'import/no-extraneous-dependencies': ['error', {
            'optionalDependencies': ['test/unit/index.js']
        }],

        // allow debugger during development
        'no-debugger': process.env.NODE_ENV === 'production' ? 2 : 0
    }
};
