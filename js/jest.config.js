module.exports = {
    testEnvironment: 'jsdom',
    testMatch: ['**/tests/**/*.test.js'],
    coverageDirectory: 'coverage',
    collectCoverageFrom: ['src/**/*.js'],
    coverageThreshold: {
        global: {
            statements: 50,  // Start low, increase as coverage improves
            branches: 40,
            functions: 50,
            lines: 50,
        },
    },
    verbose: true,
};
