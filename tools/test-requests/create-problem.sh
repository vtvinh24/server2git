#!/bin/bash
# Usage: ./create-problem.sh <title> <statement> <source_zip>
# Example: ./create-problem.sh "Sample Problem" "This is a statement." ./sample.zip
# The script will append a random suffix to the title to avoid duplicates during testing.

API_URL="http://localhost:3000/api/v1/problems"
RAW_TITLE=${1:-"Sample Problem"}
# generate a short random suffix (timestamp + 4-digit random) to avoid duplicates
RAND_SUFFIX="$(date +%s)-$((RANDOM%9000+1000))"
TITLE="$RAW_TITLE-$RAND_SUFFIX"
STATEMENT=${2:-"This is a sample problem statement."}
SOURCE_ZIP=${3:-"./sample/sample-problem.zip"}

if [ ! -f "$SOURCE_ZIP" ]; then
  echo "Source zip file not found: $SOURCE_ZIP"
  exit 1
fi

curl -X POST "$API_URL" \
  -F "title=$TITLE" \
  -F "statement=$STATEMENT" \
  -F "source=@$SOURCE_ZIP"
