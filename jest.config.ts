import type { Config } from "jest";

const config: Config = {
  testEnvironment: "node",
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  testMatch: [
    "<rootDir>/test/**/*.test.ts",
    "<rootDir>/test/**/*.spec.ts",
    "<rootDir>/src/**/*.test.ts",
  ],
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.json" }],
  },
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/**/index.ts",
    "!src/**/*.test.ts",
    "!src/**/*.spec.ts",
    // Exclude infrastructure adapters (thin wrappers around external SDKs)
    "!src/infra/senders/**/*.sender.ts",
    "!src/infra/repositories/**/*.repository.ts",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html", "json-summary"],
  coverageThreshold: {
    global: {
      branches: 64,
      functions: 70,
      lines: 75,
      statements: 75,
    },
  },
  verbose: true,
  maxWorkers: "50%",
};

export default config;
