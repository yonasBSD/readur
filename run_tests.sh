#!/bin/bash

echo "Running backend tests in Docker..."

# Create a test runner script
cat > test_runner.sh << 'EOF'
#!/bin/bash
set -e

echo "=== Running Backend Tests ==="
cd /app

# Run non-database tests
echo "Running unit tests..."
cargo test --lib -- --skip db_tests

# Run OCR tests with test data
echo "Running OCR tests..."
if [ -d "test_data" ]; then
    cargo test ocr_tests
fi

echo "=== All tests completed ==="
EOF

# Run tests in Docker
docker run --rm \
    -v $(pwd):/app \
    -w /app \
    -e RUST_BACKTRACE=1 \
    rust:1.75-bookworm \
    bash -c "apt-get update && apt-get install -y tesseract-ocr tesseract-ocr-eng libtesseract-dev libleptonica-dev pkg-config && bash test_runner.sh"

# Clean up
rm test_runner.sh