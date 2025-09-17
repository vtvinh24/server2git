#!/bin/sh
mkdir -p /logs
echo "Starting container entrypoint: $@" > /logs/container.log
"$@" 2>&1 | tee -a /logs/container.log
