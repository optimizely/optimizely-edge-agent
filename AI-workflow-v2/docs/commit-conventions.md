# Commit Message Conventions

This project follows [Conventional Commits](https://www.conventionalcommits.org/) to enable automated changelog generation. Each commit message should be structured as follows:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

## Types

The `type` must be one of the following:

| Type | Description | Changelog Section |
|------|-------------|------------------|
| `feat` | A new feature | Features |
| `fix` | A bug fix | Bug Fixes |
| `docs` | Documentation only changes | Documentation |
| `style` | Changes that do not affect the meaning of the code (white-space, formatting, etc) | Styling |
| `refactor` | A code change that neither fixes a bug nor adds a feature | Code Refactoring |
| `perf` | A code change that improves performance | Performance Improvements |
| `test` | Adding missing tests or correcting existing tests | Tests |
| `build` | Changes that affect the build system or external dependencies | Build System |
| `ci` | Changes to our CI configuration files and scripts | Continuous Integration |
| `chore` | Other changes that don't modify src or test files | Chores |
| `revert` | Reverts a previous commit | Reverts |

## Scope

The `scope` is optional and should be a noun describing a section of the codebase:

- `core` - Core framework components
- `rules` - Framework rules
- `tools` - Framework tools and utilities
- `templates` - Templates
- `docs` - Documentation
- `workflow` - AI workflow specific changes
- etc.

## Examples

```
feat(rules): add new AI memory management rule

fix(tools): correct path handling in update-framework script

docs(readme): update installation instructions

refactor(core): simplify framework initialization

chore(deps): update dependency versions
```

## Breaking Changes

When a commit introduces a breaking change, the footer should include `BREAKING CHANGE:` followed by a description:

```
feat(rules): change scope control system API

BREAKING CHANGE: The scope control API has been completely revamped. Previous methods are no longer supported. See migration guide for details.
```

## Benefits of Conventional Commits

1. **Automated changelog generation**: The commit messages are parsed to generate detailed changelogs
2. **Semantic versioning determination**: Breaking changes can trigger major version increments
3. **Clear commit history**: Makes the project history navigable and useful
4. **Structured contributions**: Helps contributors understand how their changes should be categorized

## Generating the Changelog

With properly formatted commit messages, you can generate/update the changelog by running:

```bash
npm run release         # Auto-determine version based on commits
npm run release:patch   # Patch release (bug fixes)
npm run release:minor   # Minor release (new features, non-breaking)
npm run release:major   # Major release (breaking changes)
```

This will:
1. Analyze commit messages since the last tag
2. Determine the next version number
3. Update the CHANGELOG.md file
4. Create a git tag for the release
5. Create a version commit 