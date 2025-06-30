module.exports = {
  // Root configuration for the monorepo
  projects: [
    '<rootDir>/services/app-service',
    '<rootDir>/services/worker-service',
  ],
  
  // Coverage collection from all projects
  collectCoverageFrom: [
    'services/*/src/**/*.(t|j)s',
    '!services/*/src/**/*.spec.ts',
    '!services/*/src/**/*.e2e-spec.ts',
    '!services/*/src/main.ts',
    '!services/*/src/**/*.module.ts',
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  
  // Coverage directory
  coverageDirectory: '<rootDir>/coverage',
  
  // Coverage reporters
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
  ],
  
  // Test environment
  testEnvironment: 'node',
  
  // Module name mapping for shared package
  moduleNameMapping: {
    '^@distributed-async-task-worker/shared(.*)$': '<rootDir>/packages/shared/src$1',
  },
  
  // Test timeout
  testTimeout: 30000,
  
  // Verbose output
  verbose: true,
};
