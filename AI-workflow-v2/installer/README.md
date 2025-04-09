# AI Workflow Installer

This directory contains the installer script for the AI Workflow Framework.

## How the Installer Works

The installer follows a simple workflow:

1. **Clone Repository**: Clone the AI Workflow repository from GitHub (v2 branch)
2. **Copy Framework Files**: Copy AI-workflow-v2 directory and files to the project
3. **Copy Workspace Files**: Handle the workspace directory with special care:
   - For clean installs: Full recursive copy of all workspace files
   - For updates: **NON-DESTRUCTIVE by default** - only adds new files, preserves ALL existing customer files (including files in subdirectories)
   - For force refresh: **SMART REFRESH** - updates framework files while preserving your custom content
4. **Copy Cursor Rules**: Convert framework rules to .mdc format and copy to .cursor/rules directory (always updated to latest version)
5. **Update Ignore Files**: Update .gitignore and .cursorignore to exclude framework files
6. **Clean Up**: Remove temporary files and complete installation

## Enhanced Content Protection

The installer implements different protection mechanisms for different types of content:

- **Framework Files**: Core framework files are updated according to specified flags
- **Cursor Rules**: Always updated to the latest version for optimal AI assistance
- **Customer Workspace Files**: All existing files in `ai-workflow-workspace` are preserved by default, including those in:
  - Top-level directories
  - Subdirectories (like extensions/repository-profiles)
  - Deeply nested directory structures
- **Custom Content**: Special directories (like extensions/repository-profiles/*) are automatically detected and provided extra protection

### Smart Force Refresh

When using `--force-refresh`, the installer:
- Updates all framework files and Cursor rules to the latest version
- Detects and marks custom content in your workspace directories
- Selectively refreshes only standard framework files
- **NEVER deletes custom content** such as your custom rules, profiles, plans, or other files

This smart refresh ensures you get the latest framework updates without losing your custom implementations.

## Command Line Options

- `--force-refresh` or `-f`: Smart refresh of framework files (preserves all custom content)
- `--update` or `-u`: **USE WITH CAUTION** - Enables overwriting existing workspace files (bypasses some non-destructive safeguards)
- `--verbose` or `-v`: Show detailed messages during installation
- `--help`: Show help information

## When to Use Each Mode

- **Default Mode**: For regular updates - adds new files without changing existing ones
- **Force Refresh Mode** (`--force-refresh`): When you want to update framework files to the latest version while preserving custom content
- **Update Mode** (`--update`): Only when you deliberately want to replace existing workspace files with newer versions

In most cases, the default mode or force refresh mode are recommended.

## Troubleshooting

If you encounter issues during installation:

1. Check the logs for error messages
2. Ensure you have write permissions for the destination directories
3. Make sure you have Git installed and available in your PATH
4. If updating, back up your workspace directory before running the installer
5. Use the `--verbose` flag to see detailed information about file operations

## Manual Installation

You can also manually install by cloning the repository and running:

```bash
node get-ai-workflow.js
```

## Contributing

If you find issues or have suggestions for improvements, please open an issue or pull request on the GitHub repository. 