#!/bin/bash
# Test GET /api/v1/test/github-connection

API_URL="http://localhost:3000/api/v1/test/github-connection"

curl -i -X GET "$API_URL"
