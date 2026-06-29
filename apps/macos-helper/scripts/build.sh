#!/usr/bin/env bash
set -euo pipefail

mkdir -p .build/debug

swiftc \
  -parse-as-library \
  Sources/WorkflowRecorderCore/*.swift \
  Sources/WorkflowRecorderHelper/main.swift \
  -o .build/debug/workflow-recorder-helper

swiftc \
  Sources/WorkflowRecorderCore/*.swift \
  Sources/WorkflowRecorderNativeHost/main.swift \
  -o .build/debug/workflow-recorder-native-host

echo "Built .build/debug/workflow-recorder-helper"
echo "Built .build/debug/workflow-recorder-native-host"
