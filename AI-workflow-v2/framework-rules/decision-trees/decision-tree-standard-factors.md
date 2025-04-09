---
type: "decision-factors"
purpose: "standard-evaluation-criteria"
version: "1.0"
status: "Active"
description: "Standardized evaluation criteria for common decision factors across the framework"
ai_instructions: "Reference these standardized factors when making decisions to ensure consistency"
dateCreated: "2025-03-25"
lastUpdated: "2025-03-25"
---

# Standard Decision Factors

## 1. Environment Type Classification

1.1. Production Environment [ENV-PROD]:
   - Customer-facing systems
   - Revenue-generating systems
   - Systems with sensitive data
   - Business-critical infrastructure
   - Audit-controlled systems
   - Regulatory-controlled systems

1.2. Staging/Pre-Production Environment [ENV-STAGE]:
   - Final testing before production
   - Integration environments
   - User acceptance testing environments
   - Performance testing environments
   - Release candidate environments

1.3. Development Environment [ENV-DEV]:
   - Local development
   - Testing environments
   - Internal tools
   - Isolated development instances
   - CI/CD pipeline environments

## 2. Implementation Complexity Classification

2.1. High Complexity [COMP-HIGH]:
   - Multiple interacting components
   - Complex algorithms or logic
   - Distributed systems
   - Many integration points
   - Advanced architectural patterns
   - Multiple technology stacks
   - Complex state management

2.2. Medium Complexity [COMP-MED]:
   - Several related components
   - Multiple files or modules
   - Standard architectural patterns
   - Moderate state management
   - Typical integration requirements
   - Common technology stack

2.3. Low Complexity [COMP-LOW]:
   - Single component changes
   - Simple logic modifications
   - Isolated functionality
   - Minimal state management
   - Few or no integration points
   - Well-understood patterns

## 3. Risk Level Classification

3.1. Critical Risk [RISK-CRIT]:
   - Could cause system outage
   - Could impact revenue
   - Could affect customer data
   - Could breach security
   - Could violate compliance
   - Difficult to roll back
   - Wide system impact

3.2. High Risk [RISK-HIGH]:
   - Significant functionality impact
   - Multiple component changes
   - Core business logic changes
   - Notable performance impact
   - Visible to end users
   - Requires careful rollout

3.3. Medium Risk [RISK-MED]:
   - Moderate functionality impact
   - Contained to specific features
   - Limited user visibility
   - Standard rollback options
   - Predictable outcomes
   - Well-understood changes

3.4. Low Risk [RISK-LOW]:
   - Minimal functionality impact
   - Isolated changes
   - No direct user impact
   - Easy to roll back
   - Well-tested patterns
   - Documentation or UI changes

## 4. Component Type Classification

4.1. Critical Component [COMP-CRIT]:
   - Core system functionality
   - High availability requirements
   - Security-related functionality
   - Data integrity systems
   - Authentication/authorization
   - Financial or transactional
   - Regulatory-controlled functionality

4.2. Standard Component [COMP-STD]:
   - Business logic implementation
   - Standard application features
   - User-facing functionality
   - Standard data processing
   - Integration interfaces
   - Typical workflow implementation

4.3. Auxiliary Component [COMP-AUX]:
   - Helper functionality
   - Utilities
   - Development tools
   - Non-essential features
   - Documentation
   - UI enhancements
   - Convenience features

## 5. Protection Requirements Classification

5.1. Maximum Protection [PROT-MAX]:
   - Strict change control
   - Comprehensive testing required
   - Multiple approval gates
   - Complete documentation
   - Formal verification
   - Audit trail requirements
   - Component snapshots

5.2. High Protection [PROT-HIGH]:
   - Strong change control
   - Thorough testing required
   - Specific approval process
   - Detailed documentation
   - Verification requirements
   - Change logging

5.3. Standard Protection [PROT-STD]:
   - Normal change control
   - Standard testing required
   - Team approval process
   - Standard documentation
   - Basic verification
   - Basic change logging

5.4. Basic Protection [PROT-BASIC]:
   - Minimal change control
   - Basic testing required
   - Self or peer review
   - Simple documentation
   - Manual verification
   - Change notification

## 6. Data Sensitivity Classification

6.1. Highly Sensitive Data [DATA-HIGH]:
   - Personally identifiable information (PII)
   - Financial data
   - Healthcare information
   - Authentication credentials
   - Encryption keys
   - Regulatory-protected information

6.2. Business Sensitive Data [DATA-BUS]:
   - Internal business metrics
   - Competitive information
   - Strategic planning data
   - Unreleased product information
   - Customer relationship data
   - Operational statistics

6.3. Internal Data [DATA-INT]:
   - Internal processes
   - Non-sensitive configurations
   - Team documentation
   - Development artifacts
   - Test data (anonymized)
   - Internal reporting

6.4. Public Data [DATA-PUB]:
   - Published information
   - Marketing content
   - General documentation
   - Open-source components
   - Public APIs
   - Demo content

## 7. Implementation Phase Classification

7.1. Planning Phase [PHASE-PLAN]:
   - Requirements gathering
   - Architecture design
   - Implementation planning
   - Risk assessment
   - Scope definition
   - Mode selection

7.2. Preparation Phase [PHASE-PREP]:
   - Environment setup
   - Structure creation
   - Initial file setup
   - Dependency configuration
   - Tool configuration
   - Framework application

7.3. Implementation Phase [PHASE-IMPL]:
   - Active coding
   - Component development
   - Feature implementation
   - Bug fixing
   - Refactoring
   - Integration tasks

7.4. Verification Phase [PHASE-VER]:
   - Testing
   - Quality verification
   - Validation
   - Performance assessment
   - Security review
   - Standard compliance

7.5. Documentation Phase [PHASE-DOC]:
   - Code documentation
   - User documentation
   - API documentation
   - Implementation records
   - Decision documentation
   - Handover preparation

7.6. Completion Phase [PHASE-COMP]:
   - Final review
   - Handover
   - Deployment preparation
   - Status updates
   - Lessons learned
   - Closure documentation 