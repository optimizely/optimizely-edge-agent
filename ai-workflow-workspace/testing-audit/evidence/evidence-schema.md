---
type: documentation
description: "Schema definition for test evidence storage"
lastUpdated: "2023-10-31"
status: "Active"
planId: "testing-audit-reconciliation-04-10-2025"
---

# Test Evidence Storage Schema

This document defines the schema and structure for storing test evidence in the Edge Agent Testing Audit framework. It ensures consistent, verifiable, and traceable evidence storage for all test executions.

## Core Principles

- **Completeness**: Evidence must capture all relevant test execution details
- **Verifiability**: Include cryptographic integrity mechanisms for all artifacts
- **Traceability**: Every evidence artifact must be traceable to a test execution
- **Immutability**: Evidence must be stored in an append-only manner
- **Searchability**: Evidence must be easily searchable by test ID, timestamp, and type

## Directory Structure

The evidence storage follows this directory structure:

```
ai-workflow-workspace/testing-audit/evidence/
├── metadata/
│   ├── [YYYY-MM-DD]/
│   │   ├── [test-id]-[run-id]-metadata.json
│   │   └── ...
│   └── ...
├── artifacts/
│   ├── [YYYY-MM-DD]/
│   │   ├── [test-id]/
│   │   │   ├── [run-id]/
│   │   │   │   ├── [artifact-id].json
│   │   │   │   └── ...
│   │   │   └── ...
│   │   └── ...
│   └── ...
├── screenshots/
│   ├── [YYYY-MM-DD]/
│   │   ├── [test-id]/
│   │   │   ├── [run-id]/
│   │   │   │   ├── [timestamp]-[description].png
│   │   │   │   └── ...
│   │   │   └── ...
│   │   └── ...
│   └── ...
├── network/
│   ├── [YYYY-MM-DD]/
│   │   ├── [test-id]/
│   │   │   ├── [run-id]/
│   │   │   │   ├── [timestamp]-[request-id].har
│   │   │   │   └── ...
│   │   │   └── ...
│   │   └── ...
│   └── ...
└── registry/
    ├── [YYYY-MM-DD]-registry.json
    └── ...
```

## Evidence Metadata Schema

Every test run generates a metadata file that follows this JSON schema:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": [
    "testId",
    "runId",
    "startTime",
    "endTime",
    "result",
    "artifacts"
  ],
  "properties": {
    "testId": {
      "type": "string",
      "description": "Identifier for the test that generated this evidence"
    },
    "runId": {
      "type": "string",
      "description": "Unique identifier for this test run (UUID v4)"
    },
    "startTime": {
      "type": "string",
      "format": "date-time",
      "description": "ISO 8601 timestamp for test start"
    },
    "endTime": {
      "type": "string",
      "format": "date-time",
      "description": "ISO 8601 timestamp for test end"
    },
    "result": {
      "type": "string",
      "enum": ["PASS", "FAIL", "ERROR", "SKIPPED"],
      "description": "Overall test result"
    },
    "environment": {
      "type": "object",
      "description": "Information about the test environment",
      "properties": {
        "nodeVersion": {
          "type": "string",
          "description": "Node.js version"
        },
        "platform": {
          "type": "string",
          "description": "Operating system platform"
        },
        "workerUrl": {
          "type": "string",
          "description": "Cloudflare Worker URL"
        },
        "sdkKey": {
          "type": "string",
          "description": "SDK key identifier (not the actual key)"
        }
      }
    },
    "summary": {
      "type": "object",
      "description": "Summary of test results",
      "properties": {
        "assertions": {
          "type": "object",
          "properties": {
            "total": {
              "type": "integer",
              "description": "Total number of assertions"
            },
            "passed": {
              "type": "integer",
              "description": "Number of passed assertions"
            },
            "failed": {
              "type": "integer",
              "description": "Number of failed assertions"
            },
            "skipped": {
              "type": "integer",
              "description": "Number of skipped assertions"
            }
          }
        },
        "steps": {
          "type": "object",
          "properties": {
            "total": {
              "type": "integer",
              "description": "Total number of steps"
            },
            "passed": {
              "type": "integer",
              "description": "Number of passed steps"
            },
            "failed": {
              "type": "integer",
              "description": "Number of failed steps"
            },
            "skipped": {
              "type": "integer",
              "description": "Number of skipped steps"
            }
          }
        },
        "duration": {
          "type": "integer",
          "description": "Test duration in milliseconds"
        },
        "errors": {
          "type": "integer",
          "description": "Number of errors"
        },
        "warnings": {
          "type": "integer",
          "description": "Number of warnings"
        },
        "cloudflareEvidence": {
          "type": "boolean",
          "description": "Whether Cloudflare-specific evidence was collected"
        }
      }
    },
    "artifacts": {
      "type": "array",
      "description": "List of evidence artifacts generated during the test",
      "items": {
        "type": "object",
        "required": [
          "id",
          "type",
          "path",
          "timestamp",
          "hash"
        ],
        "properties": {
          "id": {
            "type": "string",
            "description": "Unique identifier for this artifact (UUID v4)"
          },
          "type": {
            "type": "string",
            "enum": ["NETWORK", "SCREENSHOT", "LOG", "ASSERTION", "DATA"],
            "description": "Type of artifact"
          },
          "path": {
            "type": "string",
            "description": "Relative path to the artifact file"
          },
          "description": {
            "type": "string",
            "description": "Human-readable description of the artifact"
          },
          "timestamp": {
            "type": "string",
            "format": "date-time",
            "description": "ISO 8601 timestamp when the artifact was created"
          },
          "hash": {
            "type": "string",
            "description": "SHA-256 hash of the artifact file for integrity verification"
          },
          "metadata": {
            "type": "object",
            "description": "Additional metadata specific to the artifact type"
          }
        }
      }
    },
    "integrityData": {
      "type": "object",
      "description": "Cryptographic integrity information",
      "required": [
        "evidenceHash",
        "signatureTimestamp"
      ],
      "properties": {
        "evidenceHash": {
          "type": "string",
          "description": "SHA-256 hash of all artifact hashes concatenated"
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

## Artifact Storage

### Network Artifacts

Network artifacts (HTTP requests/responses) are stored in HAR format with the following additional metadata:

```json
{
  "testId": "string",
  "runId": "string",
  "requestId": "string",
  "timestamp": "string (ISO 8601)",
  "url": "string",
  "method": "string",
  "statusCode": "integer",
  "cloudflare": {
    "cfRay": "string",
    "cacheStatus": "string"
  },
  "harContent": { ... HAR format object ... },
  "hash": "string (SHA-256 of harContent)"
}
```

### Screenshot Artifacts

Screenshot artifacts are stored as PNG files with associated metadata:

```json
{
  "testId": "string",
  "runId": "string",
  "screenshotId": "string",
  "timestamp": "string (ISO 8601)",
  "description": "string",
  "context": "string (what was being tested)",
  "path": "string (relative path to PNG file)",
  "hash": "string (SHA-256 of PNG file)"
}
```

### Data Artifacts

Generic data artifacts (test data, outputs, etc.) are stored as JSON files:

```json
{
  "testId": "string",
  "runId": "string",
  "artifactId": "string",
  "timestamp": "string (ISO 8601)",
  "description": "string",
  "contentType": "string",
  "data": { ... content ... },
  "hash": "string (SHA-256 of data)"
}
```

## Evidence Registry

The evidence registry maintains a daily index of all evidence generated, stored in `registry/[YYYY-MM-DD]-registry.json`:

```json
{
  "date": "string (YYYY-MM-DD)",
  "entries": [
    {
      "testId": "string",
      "runId": "string",
      "startTime": "string (ISO 8601)",
      "endTime": "string (ISO 8601)",
      "result": "string (PASS/FAIL/ERROR/SKIPPED)",
      "metadataPath": "string (relative path to metadata file)",
      "artifactCount": "integer"
    }
  ],
  "summary": {
    "totalRuns": "integer",
    "passed": "integer",
    "failed": "integer",
    "errors": "integer",
    "skipped": "integer",
    "totalArtifacts": "integer"
  },
  "integrityHash": "string (SHA-256 of entries array)"
}
```

## Evidence Collection Process

1. **Test Initialization**: Create a unique runId and initialize the metadata structure
2. **Artifact Collection**: As test executes, store artifacts in the appropriate directories
3. **Metadata Update**: Update the metadata file with artifact references and integrity hashes
4. **Registry Update**: Add an entry to the daily registry file
5. **Evidence Verification**: Calculate and store integrity hashes for all artifacts and metadata

## Integrity Verification

To verify the integrity of stored evidence:

1. Verify the hash of each individual artifact matches its stored hash
2. Verify the evidence hash in the metadata file matches the concatenated artifact hashes
3. Verify the registry entry hash matches the metadata file hash

This creates a chain of integrity verification from individual artifacts to the registry.

## Implementation Guidelines

- Always use UTC for all timestamps
- Generate UUIDs using version 4 (random)
- Calculate SHA-256 hashes on the raw file content (not the parsed object)
- Store evidence in the appropriate directories based on date and type
- Provide utility functions for searching and retrieving evidence

## Example Metadata File

```json
{
  "testId": "forced-variation-tests",
  "runId": "9e26f6b2-db65-49d3-98b3-373ac53894c2",
  "startTime": "2023-10-31T12:34:56.789Z",
  "endTime": "2023-10-31T12:35:42.123Z",
  "result": "PASS",
  "environment": {
    "nodeVersion": "v16.14.0",
    "platform": "win32",
    "workerUrl": "https://edge-agent.example.workers.dev",
    "sdkKey": "SDK-123456"
  },
  "summary": {
    "assertions": {
      "total": 24,
      "passed": 24,
      "failed": 0,
      "skipped": 0
    },
    "steps": {
      "total": 5,
      "passed": 5,
      "failed": 0,
      "skipped": 0
    },
    "duration": 45334,
    "errors": 0,
    "warnings": 0,
    "cloudflareEvidence": true
  },
  "artifacts": [
    {
      "id": "5a7c44e2-7d07-4451-af6e-9a9fde6a2154",
      "type": "NETWORK",
      "path": "network/2023-10-31/forced-variation-tests/9e26f6b2-db65-49d3-98b3-373ac53894c2/12-34-58-request-1.har",
      "description": "Forced variation API request",
      "timestamp": "2023-10-31T12:34:58.123Z",
      "hash": "f61a8cc1c0a5978e5e62a3b08adce0a3f9cb94188c5e16a3f4ff93f0c5e9254f",
      "metadata": {
        "url": "https://edge-agent.example.workers.dev/decide",
        "method": "POST",
        "statusCode": 200,
        "cfRay": "8168c5df8c5d3183-DFW"
      }
    }
  ],
  "integrityData": {
    "evidenceHash": "7a3b5ec23f98c71da3bd62a8ef96ac7f87c4c65be36050b33a56c665205e1bfd",
    "signatureTimestamp": "2023-10-31T12:35:42.456Z"
  }
}
``` 