# Feature Parity Implementation Reference

## Important Notice for AI Agents

If you are an AI agent continuing work on the Optimizely Edge Agent re-architecture project, **please be aware of the comprehensive Feature Parity Guide** that has been created specifically to assist with implementation.

## Feature Parity Guide Location

The complete AI Feature Parity Guide is located at:

```
docs/architecture/ai-feature-parity.md
```

## Purpose of the Feature Parity Guide

This guide provides:

1. Detailed explanations of the two operational modes:
   - **Edge Mode** (GET requests)
   - **Agent Mode** (POST requests)

2. Comprehensive documentation of all features that must be maintained, including:
   - cdnVariationSettings handling
   - URL matching and routing
   - Visitor identification and bucketing
   - Caching behavior
   - Decision making and execution
   - Cookie and header management
   - Request and response handling
   - Event tracking and dispatch
   - KV store integration
   - RequestConfig handling

3. Implementation plans for each feature area

4. Mode-specific implementation details

5. CDN-specific implementation considerations

## How to Use the Guide

Before implementing any functionality for the Cloudflare adapter (or any other CDN adapter), consult the AI Feature Parity Guide to:

1. Understand the complete functionality requirements
2. Follow the recommended implementation approach
3. Ensure consistency with the original implementation
4. Verify your implementation meets all requirements

## Implementation Priority

As documented in the master plan, our current focus is on achieving feature parity for Cloudflare first, which will then serve as a reference implementation for other CDN environments.

Please update this reference document as needed to reflect any changes or additions to the implementation strategy. 