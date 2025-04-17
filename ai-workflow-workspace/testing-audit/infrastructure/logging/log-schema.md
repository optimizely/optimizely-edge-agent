---
type: documentation
description: "Schema definition for test event logging framework"
lastUpdated: "2023-10-31"
status: "Active"
planId: "testing-audit-reconciliation-04-10-2025"
---

# Test Event Logging Schema

This document defines the structured schema for test event logging in the Edge Agent testing framework. This schema ensures consistent, verifiable, and traceable event logs for all test executions.

## Core Principles

- **Completeness**: Logs must capture all relevant test execution details
- **Verifiability**: Include cryptographic integrity mechanisms
- **Traceability**: Every test event must be traceable to an execution context
- **Timestamp Accuracy**: All events must include accurate, verifiable timestamps
- **Evidence Links**: Connect logs to stored artifacts when applicable

## Schema Definition

All log entries must follow this JSON schema:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": [
    "eventId",
    "timestamp",
    "testId",
    "runId",
    "eventType",
    "level",
    "message"
  ],
  "properties": {
    "eventId": {
      "type": "string",
      "description": "Unique identifier for this event (UUID v4)"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "ISO 8601 timestamp with timezone"
    },
    "testId": {
      "type": "string",
      "description": "Identifier for the test generating this event"
    },
    "runId": {
      "type": "string",
      "description": "Unique identifier for this test run (UUID v4)"
    },
    "eventType": {
      "type": "string",
      "enum": [
        "TEST_START",
        "TEST_END",
        "TEST_STEP",
        "ASSERTION",
        "HTTP_REQUEST",
        "HTTP_RESPONSE",
        "SDK_OPERATION",
        "ENVIRONMENT",
        "ERROR",
        "WARNING",
        "INFO",
        "DEBUG"
      ],
      "description": "Type of event being logged"
    },
    "level": {
      "type": "string",
      "enum": [
        "DEBUG",
        "INFO",
        "WARNING",
        "ERROR",
        "CRITICAL"
      ],
      "description": "Severity/importance level of this event"
    },
    "message": {
      "type": "string",
      "description": "Human-readable description of the event"
    },
    "metadata": {
      "type": "object",
      "description": "Additional contextual information about the event",
      "properties": {
        "component": {
          "type": "string",
          "description": "Component or module generating the event"
        },
        "duration": {
          "type": "number",
          "description": "Duration in milliseconds (for timed events)"
        },
        "status": {
          "type": "string",
          "enum": [
            "PASS",
            "FAIL",
            "SKIPPED",
            "ERROR",
            "PENDING"
          ],
          "description": "Result status (for assertions or test steps)"
        },
        "artifactRef": {
          "type": "string",
          "description": "Reference to a stored artifact (e.g., screenshot, HTTP payload)"
        },
        "expectedValue": {
          "description": "Expected value in an assertion"
        },
        "actualValue": {
          "description": "Actual value in an assertion"
        },
        "stackTrace": {
          "type": "string",
          "description": "Stack trace for error events"
        },
        "httpMethod": {
          "type": "string",
          "description": "HTTP method for request/response events"
        },
        "httpUrl": {
          "type": "string",
          "description": "URL for HTTP request/response events"
        },
        "httpStatusCode": {
          "type": "integer",
          "description": "Status code for HTTP response events"
        },
        "httpHeaders": {
          "type": "object",
          "description": "Headers for HTTP request/response events"
        },
        "cfRay": {
          "type": "string",
          "description": "Cloudflare Ray ID for requests to the worker"
        },
        "instanceId": {
          "type": "string",
          "description": "ID of the worker instance handling the request"
        }
      }
    },
    "integrityData": {
      "type": "object",
      "description": "Cryptographic integrity information",
      "required": [
        "previousEventHash",
        "currentHash"
      ],
      "properties": {
        "previousEventHash": {
          "type": "string",
          "description": "SHA-256 hash of the previous log event (creates a chain)"
        },
        "currentHash": {
          "type": "string",
          "description": "SHA-256 hash of this event's contents (excluding the integrityData)"
        },
        "signatureTimestamp": {
          "type": "string",
          "format": "date-time",
          "description": "When the integrity hash was calculated"
        }
      }
    }
  }
}
```

## Event Type Definitions

| Event Type | Description | Required Metadata Fields |
|------------|-------------|--------------------------|
| TEST_START | Test execution started | component |
| TEST_END | Test execution completed | component, duration, status |
| TEST_STEP | Individual test step | component, status |
| ASSERTION | Test assertion | component, status, expectedValue, actualValue |
| HTTP_REQUEST | Outgoing HTTP request | httpMethod, httpUrl, httpHeaders |
| HTTP_RESPONSE | Incoming HTTP response | httpStatusCode, httpHeaders, duration, cfRay (if available) |
| SDK_OPERATION | SDK API call | component |
| ENVIRONMENT | Environment information | - |
| ERROR | Error event | stackTrace (if available) |
| WARNING | Warning event | - |
| INFO | Informational event | - |
| DEBUG | Debug information | - |

## Log Storage Structure

Logs will be stored in the following directory structure:

```
ai-workflow-workspace/testing-audit/infrastructure/logging/
├── storage/
│   ├── [YYYY-MM-DD]/
│   │   ├── [test-name]-[runId].log
│   │   └── ...
│   └── ...
└── manifest/
    ├── [YYYY-MM-DD]-manifest.json
    └── ...
```

Each log file will contain a newline-delimited JSON (NDJSON) stream of log entries, with one complete JSON object per line.

## Log Integrity Verification

The integrity verification mechanism works as follows:

1. Each log entry contains a hash of its own contents (excluding the integrityData object)
2. Each entry also references the hash of the previous entry
3. This creates a chain where modifying any event would break the chain
4. The manifest files provide an additional verification layer by storing:
   - Start/end events for each test run
   - Hash of the first and last events in each log file
   - Overall manifest integrity hash

## Implementation Requirements

The logging framework implementation must:

1. Generate proper event IDs and run IDs
2. Accurately record timestamps with timezone information
3. Calculate and verify integrity hashes
4. Create the proper directory structure for log storage
5. Write logs in the correct format
6. Provide utility functions for common logging operations
7. Include verification utilities to validate log integrity

## Example Log Entry

```json
{
  "eventId": "3a7c44e2-7d07-4451-af6e-9a9fde6a2154",
  "timestamp": "2023-10-31T14:32:56.789Z", 
  "testId": "forced-variation-tests",
  "runId": "9e26f6b2-db65-49d3-98b3-373ac53894c2",
  "eventType": "HTTP_RESPONSE",
  "level": "INFO",
  "message": "Received response from Cloudflare Worker",
  "metadata": {
    "component": "api-client",
    "duration": 235,
    "httpStatusCode": 200,
    "httpHeaders": {
      "content-type": "application/json",
      "cf-ray": "8168c5df8c5d3183-DFW" 
    },
    "cfRay": "8168c5df8c5d3183-DFW",
    "instanceId": "worker-instance-12345"
  },
  "integrityData": {
    "previousEventHash": "f61a8cc1c0a5978e5e62a3b08adce0a3f9cb94188c5e16a3f4ff93f0c5e9254f",
    "currentHash": "7a3b5ec23f98c71da3bd62a8ef96ac7f87c4c65be36050b33a56c665205e1bfd",
    "signatureTimestamp": "2023-10-31T14:32:56.790Z"
  }
}
```

This schema documentation will serve as the foundation for implementing the logging framework utilities. 