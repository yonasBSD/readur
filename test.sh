#!/bin/bash

# Run tests in Docker environment
echo "Running tests in Docker environment..."

# Build and run tests
docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from test

# Clean up
docker-compose -f docker-compose.test.yml down -v

# Return the exit code from the test container
exit $?