# Phase 5: Metrics & Logging Enhancement - Implementation Plan

## Overview

The Metrics & Logging Enhancement phase focuses on improving the observability of the Edge Agent by implementing comprehensive metrics collection and enhanced logging capabilities. This will enable better monitoring, debugging, and performance analysis of the Edge Agent in production environments.

## Goals

1. Implement a comprehensive metrics collection system
2. Add support for structured logging with configurable levels
3. Ensure both metrics and logging are highly configurable
4. Provide backward compatibility with existing logging behavior
5. Create documentation for metrics and logging features

## Key Metrics to Track

### Request-Level Metrics

| Metric Name | Type | Description | Tags |
|-------------|------|-------------|------|
| `request_duration_ms` | Histogram | Total request processing time | `method`, `path`, `status_code` |
| `requests_total` | Counter | Total number of requests processed | `method`, `path`, `status_code` |
| `request_errors_total` | Counter | Total number of request errors | `method`, `path`, `error_type` |
| `request_size_bytes` | Histogram | Size of incoming requests | `method`, `path` |
| `response_size_bytes` | Histogram | Size of outgoing responses | `method`, `path` |

### Decision-Level Metrics

| Metric Name | Type | Description | Tags |
|-------------|------|-------------|------|
| `decisions_total` | Counter | Total number of flag decisions made | `flag_key`, `variation`, `reason` |
| `decision_duration_ms` | Histogram | Time taken to make decisions | `flag_key`, `sdk_key` |
| `decision_cache_hits` | Counter | Number of decision cache hits | `flag_key`, `sdk_key` |
| `decision_cache_misses` | Counter | Number of decision cache misses | `flag_key`, `sdk_key` |

### Event-Level Metrics

| Metric Name | Type | Description | Tags |
|-------------|------|-------------|------|
| `events_tracked_total` | Counter | Total number of events tracked | `event_key`, `sdk_key` |
| `event_dispatch_duration_ms` | Histogram | Time taken to dispatch events | `batch_size` |
| `event_queue_size` | Gauge | Current size of event queue | `sdk_key` |
| `event_dispatch_errors` | Counter | Number of event dispatch errors | `error_type` |

### Storage-Level Metrics

| Metric Name | Type | Description | Tags |
|-------------|------|-------------|------|
| `kv_operations_total` | Counter | Total number of KV operations | `operation`, `success` |
| `kv_operation_duration_ms` | Histogram | Time taken for KV operations | `operation` |
| `kv_storage_size_bytes` | Gauge | Size of stored data in KV | `storage_type` |
| `flag_storage_cleanup_duration_ms` | Histogram | Time taken for cleanup operations | `sdk_key` |
| `flag_storage_cleanup_items_removed` | Counter | Number of items removed during cleanup | `sdk_key` |

### System-Level Metrics

| Metric Name | Type | Description | Tags |
|-------------|------|-------------|------|
| `memory_usage_bytes` | Gauge | Memory usage of the Edge Agent | `heap`, `non_heap` |
| `datafile_size_bytes` | Gauge | Size of datafiles | `sdk_key` |
| `datafile_sync_duration_ms` | Histogram | Time taken to sync datafiles | `sdk_key` |
| `initialization_duration_ms` | Histogram | Time taken to initialize services | `service_name` |

## Logging Enhancements

### Log Levels

Implement the following log levels with appropriate filtering capabilities:

| Level | Description | Use Cases |
|-------|-------------|----------|
| ERROR | Critical errors that need immediate attention | Failed requests, service failures, critical exceptions |
| WARN | Potentially harmful situations | Deprecated features, resource constraints, recoverable errors |
| INFO | General informational messages | Request completion, service initialization, configuration changes |
| DEBUG | Detailed information for debugging | Request parameters, decision details, configuration values |
| TRACE | Very detailed debug information | Full request and response bodies, internal state changes |

### Structured Logging Format

Implement a structured logging format with the following fields:

| Field | Description | Example |
|-------|-------------|---------|
| `timestamp` | ISO 8601 timestamp | `2025-04-20T12:34:56.789Z` |
| `level` | Log level | `INFO` |
| `service` | Service name | `RequestHandler` |
| `message` | Log message | `Request processed successfully` |
| `requestId` | Unique request ID | `550e8400-e29b-41d4-a716-446655440000` |
| `sdkKey` | SDK key (masked) | `abcd***` |
| `method` | HTTP method | `GET` |
| `path` | Request path | `/decide` |
| `duration` | Duration in ms | `42` |
| `error` | Error details | `{ "name": "ValidationError", "message": "Invalid SDK key" }` |
| `context` | Additional context | `{ "flagKey": "my-feature", "visitorId": "user-123" }` |

### Contextual Logging

Add support for contextual logging with:

1. Request context propagation
2. User context inclusion
3. Operation context tracking
4. Error context with stack traces
5. Performance context with timing information

## Implementation Steps

### 1. Metrics Adapter Enhancement

1. Create enhanced `IMetricsAdapter` interface with support for:
   - Counters
   - Gauges
   - Histograms
   - Custom dimensions (tags)

2. Implement concrete adapters for multiple environments:
   - `NoOpMetricsAdapter` for disabling metrics
   - `CloudflareMetricsAdapter` for Cloudflare Workers
   - `StandardMetricsAdapter` for generic environments

3. Add utilities for:
   - Timing operations
   - Creating tagged metrics
   - Batching metrics

### 2. Logger Adapter Enhancement

1. Enhance `ILoggerAdapter` interface with:
   - Log level support
   - Structured logging methods
   - Context support

2. Implement enhanced adapters:
   - `ConsoleLoggerAdapter` for standard environments
   - `CloudflareLoggerAdapter` for Cloudflare Workers
   - `NoOpLoggerAdapter` for disabling logging
   - `CompositeLoggerAdapter` for multi-destination logging

3. Add utilities for:
   - Log formatting
   - Log filtering
   - Context propagation

### 3. Integration with Core Services

1. Enhance `RequestHandler` with:
   - Request timing metrics
   - Error tracking metrics
   - Request/response size metrics
   - Structured logging throughout request lifecycle

2. Enhance `DecisionService` with:
   - Decision metrics
   - Cache hit/miss metrics
   - Decision timing metrics
   - Detailed decision logging

3. Enhance `EventService` with:
   - Event dispatch metrics
   - Event queue metrics
   - Event processing logging

4. Enhance `DatafileService` with:
   - Datafile size metrics
   - Sync timing metrics
   - Datafile update logging

5. Enhance `FlagStorageService` with:
   - KV operation metrics
   - Storage size metrics
   - Cleanup metrics
   - Operation timing

### 4. Configuration Options

Add the following configuration options:

#### Metrics Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enableMetrics` | boolean | `true` | Enable/disable metrics collection |
| `metricsProvider` | string | `'default'` | Metrics provider to use |
| `metricsDimensions` | object | `{}` | Additional dimensions to add to all metrics |
| `metricsPrefix` | string | `'optly_edge'` | Prefix for all metric names |
| `samplingRate` | number | `1.0` | Sampling rate for metrics (0.0-1.0) |
| `enableHistograms` | boolean | `true` | Enable/disable histogram metrics (higher overhead) |

#### Logging Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `logLevel` | string | `'INFO'` | Minimum log level to output |
| `enableStructuredLogs` | boolean | `true` | Enable structured logging format |
| `includeSensitiveData` | boolean | `false` | Include potentially sensitive data in logs |
| `logRequestBody` | boolean | `false` | Log complete request bodies |
| `logResponseBody` | boolean | `false` | Log complete response bodies |
| `logFormat` | string | `'json'` | Log format (`'json'`, `'text'`) |
| `maskSdkKey` | boolean | `true` | Mask SDK keys in logs |
| `maskVisitorIds` | boolean | `true` | Mask visitor IDs in logs |
| `logDestinations` | string[] | `['console']` | Where to send logs |

### 5. Implementation of Standardized Dashboards

Create standardized dashboard definitions for common monitoring systems:

1. Grafana dashboard templates
2. Datadog dashboard templates
3. CloudWatch dashboard templates

## Testing Strategy

1. **Unit Tests**:
   - Test metrics collection with mock adapters
   - Test log formatting and filtering
   - Test configuration options
   - Test context propagation

2. **Integration Tests**:
   - Test metrics during request processing
   - Test logging during error scenarios
   - Test dashboard templates

3. **Performance Tests**:
   - Measure overhead of metrics collection
   - Measure impact of different log levels

## Documentation Plan

1. **User Documentation**:
   - Metrics & Logging Guide with available metrics, log formats, and configuration options
   - Dashboard Setup Guide for different monitoring systems
   - Troubleshooting Guide using logs and metrics

2. **Developer Documentation**:
   - Custom Metrics Adapter Guide
   - Custom Logger Adapter Guide
   - Best Practices for Adding New Metrics and Logs

## Backward Compatibility

1. Ensure all existing logging behavior is preserved
2. Make metrics collection optional
3. Allow fallback to simple logging format

## Phase Exit Criteria

1. All planned metrics are implemented and tested
2. Enhanced logging system is implemented with all log levels
3. All configuration options are implemented and tested
4. Documentation is complete
5. Dashboard templates are created and tested

## Timeline

| Task | Duration | Dependencies |
|------|----------|--------------|
| Metrics Adapter Enhancement | 2 days | None |
| Logger Adapter Enhancement | 2 days | None |
| Core Service Integration | 3 days | Metrics Adapter, Logger Adapter |
| Configuration Options | 1 day | Core Service Integration |
| Dashboard Templates | 1 day | Core Service Integration |
| Documentation | 1 day | All implementation complete |
| Testing & Validation | 2 days | All implementation complete |

Total estimated duration: 8-10 days 