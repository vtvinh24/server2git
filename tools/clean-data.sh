#!/bin/bash
# clean-data.sh: Remove all data stored in the file system for this project
# Prompts for confirmation with a random 4-digit code

DATA_DIRS=(
  "./data/problems/uploads"
  "./data/problems"
  "./data"
)

CODE=$(shuf -i 1000-9999 -n 1)
echo "WARNING: This will permanently delete all data in the following directories:"
for d in "${DATA_DIRS[@]}"; do
  echo "  $d"
done
echo "To confirm, type the following code: $CODE"
read -p "Enter code: " INPUT
if [[ "$INPUT" == "$CODE" ]]; then
  for d in "${DATA_DIRS[@]}"; do
    if [ -d "$d" ]; then
      rm -rf "$d"/*
      echo "Cleaned $d"
    fi
  done
  echo "Data cleanup complete."
else
  echo "Confirmation code incorrect. Aborting."
  exit 1
fi
