# Frontend Testing Guide

Quick reference for running frontend tests in the Readur project.

## Quick Start

```bash
# Run all tests once
npm test -- --run

# Run tests in watch mode (development)
npm test

# Run with coverage report
npm run test:coverage

# Run specific test file
npm test -- Dashboard.test.tsx

# Run tests matching pattern
npm test -- --grep "Login"
```

## Test Categories

### Component Tests
```bash
# All component tests
npm test -- src/components/__tests__/

# Specific components
npm test -- Dashboard.test.tsx
npm test -- Login.test.tsx
npm test -- DocumentList.test.tsx
```

### Page Tests
```bash
# All page tests  
npm test -- src/pages/__tests__/

# Specific pages
npm test -- SearchPage.test.tsx
npm test -- DocumentDetailsPage.test.tsx
npm test -- SettingsPage.test.tsx
```

### Service Tests
```bash
# API service tests
npm test -- src/services/__tests__/api.test.ts
```

## Configuration

- **Test Framework**: Vitest
- **Environment**: jsdom (browser simulation)
- **Setup File**: `src/test/setup.ts`
- **Config File**: `vitest.config.ts`

## Debugging

```bash
# Verbose output
npm test -- --reporter=verbose

# Debug specific test
npm test -- --run Dashboard.test.tsx

# Check test setup
cat src/test/setup.ts
cat vitest.config.ts
```

## Common Issues

1. **Module not found**: `rm -rf node_modules && npm install`
2. **API mocking issues**: Check `src/test/setup.ts` for global mocks
3. **Component context errors**: Ensure proper provider wrappers in tests

## Coverage

```bash
# Generate coverage report
npm run test:coverage

# View coverage
open coverage/index.html
```

For complete documentation, see `/TESTING.md` in the project root.