# Testing Guide

This document describes the testing strategy for the Readur OCR document management system.

## 🧪 Testing Strategy

We have a clean three-tier testing approach:

1. **Unit Tests** (Rust) - Fast, no dependencies, test individual components
2. **Integration Tests** (Python) - Test against running services, user workflow validation  
3. **Frontend Tests** (JavaScript) - Component and API integration testing

## 🚀 Quick Start

### Using the Rust Test Runner (Recommended)
```bash
# Run all tests
cargo run --bin test_runner

# Run specific test types
cargo run --bin test_runner unit         # Unit tests only
cargo run --bin test_runner integration  # Integration tests only  
cargo run --bin test_runner frontend     # Frontend tests only
```

### Manual Test Execution
```bash
# Unit tests (fast, no dependencies)
cargo test --test unit_tests

# Integration tests (requires running server)
# 1. Start server: cargo run
# 2. Run tests: cargo test --test integration_tests

# Frontend tests
cd frontend && npm test -- --run
```

## 📋 Test Categories

### Unit Tests (`tests/unit_tests.rs`)
Rust-based tests for core data structures and conversions without external dependencies:
- ✅ Document response conversion (with/without OCR)
- ✅ OCR field validation (confidence, word count, processing time)
- ✅ User response conversion (security - no password leaks)
- ✅ Search mode defaults and enums

**Run with:** `cargo test --test unit_tests` or `cargo run --bin test_runner unit`

### Integration Tests (`tests/integration_tests.rs`)
Rust-based tests for complete user workflows against running services:
- ✅ User registration and authentication (using `CreateUser`, `LoginRequest` types)
- ✅ Document upload via multipart form (returns `DocumentResponse`)
- ✅ OCR processing completion (with timeout and type validation)
- ✅ OCR text retrieval via API endpoint (validates response structure)
- ✅ Error handling (401, 404 responses)
- ✅ Health endpoint validation

**Run with:** `cargo test --test integration_tests` or `cargo run --bin test_runner integration`

**Advantages of Rust Integration Tests:**
- 🔒 **Type Safety** - Uses same models/types as main application
- 🚀 **Performance** - Faster execution than Python scripts
- 🛠️ **IDE Support** - Full autocomplete and refactoring support
- 🔗 **Code Reuse** - Can import validation logic and test helpers

### Frontend Tests
Located in `frontend/src/`:
- ✅ Document details page with OCR functionality
- ✅ API service mocking and integration
- ✅ Component behavior and user interactions

**Run with:** `cd frontend && npm test`

## 🔧 Test Configuration

### Server Requirements
Integration tests expect the server running at:
- **URL:** `http://localhost:8080`
- **Health endpoint:** `/api/health` returns `{"status": "ok"}`

### Test Data
Integration tests use:
- **Test user:** `integrationtest@test.com`
- **Test document:** Simple text file with known content
- **Timeout:** 30 seconds for OCR processing

## 📊 Test Coverage

### What We Test

**OCR Functionality:**
- Document upload → OCR processing → text retrieval
- OCR metadata validation (confidence, word count, timing)
- Error handling for failed OCR processing

**API Endpoints:**
- Authentication flow (register/login)
- Document management (upload/list)
- OCR text retrieval (`/api/documents/{id}/ocr`)
- Error responses (401, 404, 500)

**Data Models:**
- Type safety and field validation
- Response structure consistency
- Security (no password leaks)

**Frontend Components:**
- OCR dialog behavior
- API integration and error handling
- User interaction flows

### What We Don't Test
- Tesseract OCR accuracy (external library)
- Database schema migrations (handled by SQLx)
- File system operations (handled by OS)
- Network failures (covered by error handling)

## 🐛 Debugging Test Failures

### Integration Test Failures
1. **"Server is not running"**
   ```bash
   # Start the server first
   cargo run
   # Then run tests
   ./run_user_tests.sh
   ```

2. **"OCR processing timed out"**
   - Check server logs for OCR errors
   - Ensure Tesseract is installed and configured
   - Increase timeout in test if needed

3. **"Authentication failed"**
   - Check JWT secret configuration
   - Verify database is accessible

### Unit Test Failures
Unit tests should never fail due to external dependencies. If they do:
1. Check for compilation errors in models
2. Verify type definitions match expectations
3. Review recent changes to data structures

## 🔄 Continuous Integration

For CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Unit Tests
  run: cargo test --lib

- name: Start Services  
  run: docker-compose up -d

- name: Wait for Health
  run: timeout 60s bash -c 'until curl -s http://localhost:8080/api/health | grep -q "ok"; do sleep 2; done'

- name: Run Integration Tests
  run: cargo test --test integration_ocr_test
```

## 📈 Adding New Tests

### For New API Endpoints
1. Add unit tests for data models in `tests/unit_tests.rs`
2. Add integration test in `tests/integration_ocr_test.rs`
3. Add frontend tests if UI components involved

### For New OCR Features
1. Test the happy path (document → processing → retrieval)
2. Test error conditions (file format, processing failures)
3. Test performance/timeout scenarios
4. Validate response structure changes

## 🎯 Test Philosophy

**Fast Feedback:** Unit tests run in milliseconds, integration tests in seconds.

**Real User Scenarios:** Integration tests simulate actual user workflows.

**Maintainable:** Tests are simple, focused, and well-documented.

**Reliable:** Tests pass consistently and fail for good reasons.

**Comprehensive:** Critical paths are covered, edge cases are handled.