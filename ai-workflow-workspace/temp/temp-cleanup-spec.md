---
type: "specification"
purpose: "utility-design"
version: "1.0"
status: "Draft"
description: "Detailed specifications for the temp-cleanup.js utility for managing temporary files"
ai_instructions: "Use this specification when implementing the temp-cleanup.js utility"
related_files: ["enhancement-implementation-plan.md", "phase1-implementation-checklist.md"]
tags: ["specification", "temporary-files", "utility", "cleanup"]
audience: "ai-human"
dateCreated: "2025-03-22"
lastUpdated: "2025-03-22"
---

# Temporary Files Cleanup Utility Specification

## Overview

`temp-cleanup.js` is a utility for managing and cleaning up temporary files in the `.temp` directory. It identifies files older than a configurable threshold and provides options for removing them or reporting them without removal.

## Functionality Requirements

### Core Functions

1. **File Scanning**
   - Recursively scan the `.temp` directory
   - Identify all files and their modification dates
   - Support inclusion/exclusion of specific file patterns
   - Maintain directory structure (don't delete directories)

2. **Age-based Filtering**
   - Filter files based on last modified date
   - Configurable age threshold (default: 30 days)
   - Support for different time units (days, weeks, months)
   - Special handling for README.md and other permanent files

3. **Cleanup Operations**
   - Dry-run mode for previewing without deletion
   - Actual deletion mode with confirmation prompt
   - Detailed logging of actions taken
   - Summary statistics of cleanup operation

4. **Reporting**
   - List of files to be deleted
   - Size of space to be reclaimed
   - Files that will be preserved
   - Formatted output for terminal display

### Command-line Interface

The utility should support the following command-line arguments:

```
Usage: node tools/temp-cleanup.js [options]

Options:
  --age <days>         Age threshold in days (default: 30)
  --pattern <pattern>  File pattern to include (default: *)
  --exclude <pattern>  File pattern to exclude (default: README.md)
  --dry-run            Preview without deleting (default: true)
  --force              Delete without confirmation
  --verbose            Show detailed output
  --help               Display this help information
```

### Output Format

The utility should provide formatted output with:

1. **Header**
   - Tool name and version
   - Current date/time
   - Selected options

2. **File List**
   - Files to be deleted (with age and size)
   - Files to be preserved (with reason)
   - Color-coded status indicators

3. **Summary**
   - Total files scanned
   - Files to be deleted
   - Space to be reclaimed
   - Operation status

## Technical Specifications

### Implementation Details

1. **Module Structure**
   - Main module for CLI interaction
   - Core functions module for file operations
   - Utility module for common functions

2. **Dependencies**
   - Native Node.js modules only (fs, path, etc.)
   - No external dependencies required
   - Compatible with Node.js 14+ 

3. **File Operations**
   - Use asynchronous file operations where possible
   - Implement proper error handling
   - Ensure atomic operations for safety

4. **Configuration**
   - Support for command-line arguments
   - Optional configuration file for defaults
   - Environment variable support

### Integration Requirements

1. **Framework Integration**
   - Follow the framework's file structure conventions
   - Use the framework's logging patterns
   - Consistent error handling approach

2. **Documentation Integration**
   - Generate help text from code comments
   - Include usage examples
   - Document integration with other tools

## Example Usage Scenarios

### Scenario 1: Regular Cleanup

```bash
# Clean up files older than 30 days, with confirmation prompt
node tools/temp-cleanup.js
```

### Scenario 2: Deep Cleanup

```bash
# Clean up files older than 7 days, without confirmation
node tools/temp-cleanup.js --age 7 --force
```

### Scenario 3: Planning/Analysis

```bash
# Preview what would be cleaned up, with detailed output
node tools/temp-cleanup.js --dry-run --verbose
```

### Scenario 4: Targeted Cleanup

```bash
# Clean up only markdown files older than 14 days
node tools/temp-cleanup.js --age 14 --pattern "**/*.md" --exclude "README.md"
```

## Implementation Considerations

1. **Safety Measures**
   - Always preserve README.md by default
   - Confirm before actual deletion (unless --force)
   - Provide undo information in logs
   - Verify paths are within .temp directory

2. **Performance Considerations**
   - Efficient file scanning for large directories
   - Minimize memory usage for large file lists
   - Progress indication for long-running operations

3. **Output Formatting**
   - Color-coded output for terminal
   - Fallback for non-color terminals
   - Machine-readable output option (JSON)

## Testing Requirements

1. **Test Cases**
   - Scanning functionality
   - Age-based filtering
   - Pattern matching
   - Dry-run accuracy
   - Actual deletion functionality
   - Edge cases (empty directories, special files)

2. **Testing Environment**
   - Setup test directory with known structure
   - Files with various ages and sizes
   - Automated test scripts

## Deliverables

1. `tools/temp-cleanup.js` - Main script
2. Usage documentation in script comments
3. Integration with framework documentation

## Success Criteria

1. Successfully identifies and filters temporary files by age
2. Provides accurate dry-run information
3. Safely deletes files when instructed
4. Preserves important files and directories
5. Provides clear, formatted output
6. Integrates with the framework's documentation 