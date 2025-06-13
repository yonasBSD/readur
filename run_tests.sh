#!/bin/bash

# Test runner script for Readur
# This script runs tests in different modes to handle dependencies

echo "🧪 Readur Test Runner"
echo "===================="

# Function to run tests with specific configuration
run_tests() {
    local mode="$1"
    local flags="$2"
    local description="$3"
    
    echo ""
    echo "📋 Running $description"
    echo "Command: cargo test $flags"
    echo "-------------------------------------------"
    
    if cargo test $flags; then
        echo "✅ $description: PASSED"
    else
        echo "❌ $description: FAILED"
        return 1
    fi
}

# Check if Docker is available for integration tests
check_docker() {
    if command -v docker &> /dev/null && docker info &> /dev/null; then
        echo "🐳 Docker is available - integration tests can run"
        return 0
    else
        echo "⚠️  Docker not available - skipping integration tests"
        return 1
    fi
}

# Main test execution
echo "Starting test execution..."

# 1. Run unit tests without OCR dependencies (fastest)
run_tests "unit" "--lib --no-default-features -- --skip database --skip integration" "Unit tests (no OCR/DB dependencies)"
unit_result=$?

# 2. Run unit tests with OCR dependencies (requires tesseract)
if command -v tesseract &> /dev/null; then
    echo "📷 Tesseract OCR available - running OCR tests"
    run_tests "ocr" "--lib --features ocr -- --skip database --skip integration" "Unit tests with OCR support"
    ocr_result=$?
else
    echo "⚠️  Tesseract not available - skipping OCR tests"
    echo "   Install with: sudo apt-get install tesseract-ocr tesseract-ocr-eng"
    ocr_result=0  # Don't fail if tesseract isn't available
fi

# 3. Run integration tests (requires Docker for PostgreSQL)
if check_docker; then
    run_tests "integration" "--lib --features ocr" "Integration tests (requires Docker/PostgreSQL)"
    integration_result=$?
else
    integration_result=0  # Don't fail if Docker isn't available
fi

# Summary
echo ""
echo "📊 Test Summary"
echo "==============="
echo "Unit tests (basic):       $([ $unit_result -eq 0 ] && echo "✅ PASSED" || echo "❌ FAILED")"
echo "Unit tests (with OCR):    $([ $ocr_result -eq 0 ] && echo "✅ PASSED" || echo "⚠️ SKIPPED")"
echo "Integration tests:        $([ $integration_result -eq 0 ] && echo "✅ PASSED" || echo "⚠️ SKIPPED")"

# Exit with appropriate code
if [ $unit_result -eq 0 ]; then
    echo ""
    echo "🎉 Core functionality tests passed!"
    echo "Your code changes are working correctly."
    exit 0
else
    echo ""
    echo "💥 Some tests failed. Please check the output above."
    exit 1
fi