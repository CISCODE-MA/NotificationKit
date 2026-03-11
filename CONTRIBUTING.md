# Contributing to @ciscode/notification-kit

Thank you for your interest in contributing to **@ciscode/notification-kit** 💙  
Contributions of all kinds are welcome: bug fixes, improvements, documentation, and discussions.

---

## Project Philosophy

This package follows these principles:

- Be reusable across multiple NestJS applications
- Expose a clear and stable public API
- Keep domain logic isolated and testable
- Avoid unnecessary framework or vendor lock-in
- Favor correctness, safety, and clarity over shortcuts

Please keep these principles in mind when contributing.

---

## Getting Started

### 1. Clone & Install

Clone the repository created from this template, then:

```bash
npm install
```

---

## Branch Naming

Use descriptive branch names:
• feat/<short-description>
• fix/<short-description>
• docs/<short-description>
• refactor/<short-description>

Examples:

• feat/add-new-provider
• fix/congig-validation
• docs/update-readme

---

## Development Guidelines

• All code must be written in TypeScript
• Public APIs must remain backward-compatible unless explicitly discussed
• Prefer small, focused changes over large refactors
• Avoid committing secrets, API keys, or credentials

---

## Test & Quality

Before pushing or opening a PR, ensure the following pass:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

### Testing Guidelines

This project maintains high test coverage (133+ tests). When contributing:

**For bug fixes:**

- Add a test that reproduces the bug
- Verify the fix resolves the issue
- Ensure existing tests still pass

**For new features:**

- Add unit tests for core business logic
- Add integration tests for end-to-end workflows
- Test error cases and edge cases
- Use shared test utilities from `test/test-utils.ts`

**Testing best practices:**

- Keep tests independent and isolated
- Use descriptive test names: `it('should [expected behavior]')`
- Avoid live external API calls - use mocks
- Test both success and failure scenarios
- Aim for at least 80% code coverage

**Available test utilities:**

```typescript
import {
  createNotificationServiceWithDeps,
  MockRepository,
  MockSender,
  defaultNotificationDto,
} from "./test/test-utils";
```

**Running specific test suites:**

```bash
npm test -- notification.service.test.ts  # Run specific file
npm run test:watch                         # Watch mode
npm run test:cov                           # With coverage
```

---

## Pull Requests

When opening a PR:

• Clearly describe what was changed and why
• Keep PRs focused on a single concern
• Reference related issues if applicable
• Update documentation if APIs or behaviour change
• Ensure all tests pass and coverage is maintained

A maintainer may ask for changes or clarification before merging.

---

## What not to submit

• Breaking changes without prior discussion
• Large refactors unrelated to the issue being solved
• Experimental features without a clear use case
• Code copied from proprietary or incompatible licenses

---

## Questions or Ideas ?

If you’re unsure about a change or want to discuss an idea:
• Open a GitHub Issue
• Or start a GitHub Discussion

We’re happy to talk things through before you write code.
