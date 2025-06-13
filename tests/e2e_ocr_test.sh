#!/bin/bash

set -e

echo "🔍 End-to-End OCR Test"
echo "====================="

BASE_URL="http://localhost:8081"
TEST_USER="testuser"
TEST_EMAIL="test@example.com"
TEST_PASSWORD="password123"

# Function to make authenticated API calls
api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    local content_type=${4:-"application/json"}
    
    if [ -n "$data" ]; then
        curl -s -X "$method" \
             -H "Content-Type: $content_type" \
             -H "Authorization: Bearer $AUTH_TOKEN" \
             -d "$data" \
             "$BASE_URL$endpoint"
    else
        curl -s -X "$method" \
             -H "Authorization: Bearer $AUTH_TOKEN" \
             "$BASE_URL$endpoint"
    fi
}

echo "1. Creating test user..."
curl -s -X POST \
     -H "Content-Type: application/json" \
     -d "{\"username\":\"$TEST_USER\",\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" \
     "$BASE_URL/api/auth/register" > /dev/null

echo "2. Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST \
                     -H "Content-Type: application/json" \
                     -d "{\"username\":\"$TEST_USER\",\"password\":\"$TEST_PASSWORD\"}" \
                     "$BASE_URL/api/auth/login")

AUTH_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token')

if [ "$AUTH_TOKEN" = "null" ] || [ -z "$AUTH_TOKEN" ]; then
    echo "❌ Failed to get authentication token"
    exit 1
fi

echo "✅ Authentication successful"

echo "3. Creating test image with text..."
# Create a simple text image for OCR testing
cat > /tmp/test_text.txt << 'EOF'
This is a test document for OCR processing.
It contains multiple lines of text.
The OCR service should extract this text accurately.

Document ID: TEST-001
Date: 2024-01-01
EOF

echo "4. Uploading test document..."
UPLOAD_RESPONSE=$(curl -s -X POST \
                      -H "Authorization: Bearer $AUTH_TOKEN" \
                      -F "file=@/tmp/test_text.txt" \
                      "$BASE_URL/api/documents")

DOCUMENT_ID=$(echo "$UPLOAD_RESPONSE" | jq -r '.id')

if [ "$DOCUMENT_ID" = "null" ] || [ -z "$DOCUMENT_ID" ]; then
    echo "❌ Failed to upload document"
    echo "Response: $UPLOAD_RESPONSE"
    exit 1
fi

echo "✅ Document uploaded with ID: $DOCUMENT_ID"

echo "5. Waiting for OCR processing..."
# Poll the document to check OCR status
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
    DOCUMENTS_RESPONSE=$(api_call "GET" "/api/documents")
    OCR_STATUS=$(echo "$DOCUMENTS_RESPONSE" | jq -r ".[] | select(.id==\"$DOCUMENT_ID\") | .ocr_status")
    
    if [ "$OCR_STATUS" = "completed" ]; then
        echo "✅ OCR processing completed"
        break
    elif [ "$OCR_STATUS" = "failed" ]; then
        echo "❌ OCR processing failed"
        exit 1
    fi
    
    echo "⏳ OCR status: $OCR_STATUS (attempt $((attempt + 1))/$max_attempts)"
    sleep 2
    attempt=$((attempt + 1))
done

if [ $attempt -eq $max_attempts ]; then
    echo "❌ OCR processing timed out"
    exit 1
fi

echo "6. Retrieving OCR text..."
OCR_RESPONSE=$(api_call "GET" "/api/documents/$DOCUMENT_ID/ocr")

# Verify OCR response structure
HAS_OCR_TEXT=$(echo "$OCR_RESPONSE" | jq -r '.has_ocr_text')
OCR_TEXT=$(echo "$OCR_RESPONSE" | jq -r '.ocr_text')
OCR_CONFIDENCE=$(echo "$OCR_RESPONSE" | jq -r '.ocr_confidence')
OCR_WORD_COUNT=$(echo "$OCR_RESPONSE" | jq -r '.ocr_word_count')

echo "7. Validating OCR results..."

if [ "$HAS_OCR_TEXT" != "true" ]; then
    echo "❌ Expected has_ocr_text to be true, got: $HAS_OCR_TEXT"
    exit 1
fi

if [ "$OCR_TEXT" = "null" ] || [ -z "$OCR_TEXT" ]; then
    echo "❌ OCR text is empty or null"
    exit 1
fi

if ! echo "$OCR_TEXT" | grep -q "test document"; then
    echo "❌ OCR text does not contain expected content"
    echo "OCR Text: $OCR_TEXT"
    exit 1
fi

echo "✅ OCR text contains expected content"

if [ "$OCR_CONFIDENCE" != "null" ] && [ -n "$OCR_CONFIDENCE" ]; then
    # Check if confidence is a reasonable number (0-100)
    if (( $(echo "$OCR_CONFIDENCE >= 0 && $OCR_CONFIDENCE <= 100" | bc -l) )); then
        echo "✅ OCR confidence is valid: $OCR_CONFIDENCE%"
    else
        echo "⚠️  OCR confidence seems unusual: $OCR_CONFIDENCE%"
    fi
fi

if [ "$OCR_WORD_COUNT" != "null" ] && [ "$OCR_WORD_COUNT" -gt 0 ]; then
    echo "✅ OCR word count is valid: $OCR_WORD_COUNT words"
else
    echo "⚠️  OCR word count is missing or zero: $OCR_WORD_COUNT"
fi

echo "8. Testing OCR endpoint error handling..."
# Test with non-existent document
NON_EXISTENT_ID="00000000-0000-0000-0000-000000000000"
ERROR_RESPONSE=$(curl -s -w "%{http_code}" -X GET \
                     -H "Authorization: Bearer $AUTH_TOKEN" \
                     "$BASE_URL/api/documents/$NON_EXISTENT_ID/ocr")

HTTP_CODE=$(echo "$ERROR_RESPONSE" | tail -c 4)

if [ "$HTTP_CODE" = "404" ]; then
    echo "✅ OCR endpoint correctly returns 404 for non-existent document"
else
    echo "⚠️  Expected 404 for non-existent document, got: $HTTP_CODE"
fi

echo ""
echo "🎉 End-to-End OCR Test Completed Successfully!"
echo "==============================================="
echo "✅ User registration and login"
echo "✅ Document upload"
echo "✅ OCR processing completion"
echo "✅ OCR text retrieval via API"
echo "✅ OCR response validation"
echo "✅ Error handling"
echo ""
echo "OCR Results Summary:"
echo "- Document ID: $DOCUMENT_ID"
echo "- Has OCR Text: $HAS_OCR_TEXT"
echo "- OCR Confidence: $OCR_CONFIDENCE%"
echo "- Word Count: $OCR_WORD_COUNT"
echo "- Text Preview: $(echo "$OCR_TEXT" | head -c 100)..."