# Edge Case Handling Documentation

This document outlines all edge cases handled by the local development setup.

## Setup Script Edge Cases

### 1. **Wrong Directory**
**Scenario**: User runs `bun run setup` from outside the project.

**Detection**: Check for `package.json` with name `"claude-bridge-mono"`.

**Behavior**: Error and exit with clear message.

### 2. **Missing Source Template**
**Scenario**: `packages/template/user` doesn't exist.

**Detection**: Check if path exists using `[ ! -e "$SOURCE_TEMPLATE" ]`.

**Behavior**: Error with message about incorrect monorepo structure.

### 3. **Source Template is a File**
**Scenario**: `packages/template/user` exists but is a file, not a directory.

**Detection**: Check with `[ ! -d "$SOURCE_TEMPLATE" ]`.

**Behavior**: Error asking user to fix repository structure.

### 4. **Empty Source Template**
**Scenario**: `packages/template/user` exists but contains no files.

**Detection**: Check with `[ -z "$(ls -A "$SOURCE_TEMPLATE" 2>/dev/null)" ]`.

**Behavior**: Error stating template must contain files.

### 5. **Source Template Not Readable**
**Scenario**: Permission issues prevent reading source template.

**Detection**: Check with `[ ! -r "$SOURCE_TEMPLATE" ]`.

**Behavior**: Error asking user to check permissions.

### 6. **.alive Exists as File**
**Scenario**: `.alive` exists but is a file instead of directory.

**Detection**: Check with `[ -e "$ALIVE_DIR" ] && [ ! -d "$ALIVE_DIR" ]`.

**Behavior**: Error with instructions to remove the file manually.

### 7. **Cannot Create .alive Directory**
**Scenario**: Write permissions prevent creating `.alive`.

**Detection**: Check exit code of `mkdir -p "$ALIVE_DIR"`.

**Behavior**: Error about write permissions.

### 8. **template Exists as File**
**Scenario**: `.alive/template` exists but is a file, not directory.

**Detection**: Check with `[ -e "$TEMPLATE_DIR" ] && [ ! -d "$TEMPLATE_DIR" ]`.

**Behavior**: Error with removal instructions.

### 9. **Empty Template Directory**
**Scenario**: `.alive/template` exists but is empty (corrupted).

**Detection**: Check with `[ -z "$(ls -A "$TEMPLATE_DIR" 2>/dev/null)" ]`.

**Behavior**: Auto-remove and repopulate.

### 10. **Template Already Exists (Normal)**
**Scenario**: User runs setup when template already exists.

**Detection**: Check with `[ -d "$TEMPLATE_DIR" ]` and not empty.

**Behavior**: Skip copy, show instructions for reset with `--force`.

### 11. **Force Flag**
**Scenario**: User runs `bun run setup --force` to reset workspace.

**Detection**: Parse `$1` argument for `--force` or `-f`.

**Behavior**: Remove existing template and recreate.

### 12. **Copy Failure**
**Scenario**: Disk full or permission issues during copy.

**Detection**: Check exit code of `cp -r` command.

**Behavior**: Error with disk space/permission message.

### 13. **Copy Verification Failure**
**Scenario**: Copy appears successful but result is empty.

**Detection**: Verify destination exists and is not empty after copy.

**Behavior**: Error about copy verification failure.

### 14. **.env.local Missing**
**Scenario**: First time setup, no `.env.local` file exists.

**Detection**: Check with `[ -f "$ENV_FILE" ]`.

**Behavior**: Show instructions to create file with required vars.

### 15. **.env.local Misconfigured**
**Scenario**: `.env.local` exists but missing or wrong vars.

**Detection**: Grep for exact `BRIDGE_ENV=local` and correct `LOCAL_TEMPLATE_PATH`.

**Behavior**: Show update instructions with correct values.

### 16. **.env.local Correctly Configured**
**Scenario**: Everything is already set up correctly.

**Detection**: Both vars present and correct in `.env.local`.

**Behavior**: Simplified "next steps" without env config.

## Runtime (workspaceRetriever.ts) Edge Cases

### 1. **BRIDGE_ENV=local but No LOCAL_TEMPLATE_PATH**
**Scenario**: Environment flag set but path not provided.

**Detection**: Check `!templateWorkspace` after reading env var.

**Response**: 500 error with suggestion to run setup script.

### 2. **Relative Path in LOCAL_TEMPLATE_PATH**
**Scenario**: User provides `../../.alive/template` instead of absolute path.

**Detection**: Check with `!path.isAbsolute(templateWorkspace)`.

**Response**: 500 error explaining absolute paths required.

### 3. **LOCAL_TEMPLATE_PATH Doesn't Exist**
**Scenario**: Path was deleted after configuration.

**Detection**: Check with `!existsSync(templateWorkspace)`.

**Response**: 404 error with suggestion to run setup script.

### 4. **LOCAL_TEMPLATE_PATH is a File**
**Scenario**: A file exists at the path instead of directory.

**Detection**: Check with `statSync().isDirectory()` returning false.

**Response**: 500 error with removal + setup instructions.

### 5. **Cannot Stat LOCAL_TEMPLATE_PATH**
**Scenario**: Permission issues or filesystem errors.

**Detection**: Catch exception from `statSync()`.

**Response**: 500 error with permission check suggestion.

### 6. **Wrong Hostname in Terminal Mode**
**Scenario**: `terminal.*` hostname with invalid workspace param.

**Detection**: Existing validation in `getTerminalWorkspace()`.

**Response**: 400 error with clear param requirements.

### 7. **Production Mode (No BRIDGE_ENV)**
**Scenario**: Normal production operation.

**Detection**: `process.env.BRIDGE_ENV !== "local"`.

**Behavior**: Use normal workspace resolution (domain-based).

## User Workflow Edge Cases

### Multiple Clones
**Scenario**: User has multiple clones of the repo.

**Handling**: Each clone gets its own `.alive/` directory (gitignored). `.env.local` must point to correct clone's `.alive/template`.

### Template Updates
**Scenario**: `packages/template/user` is updated after `.alive/template` created.

**Handling**: User must manually reset: `bun run setup --force`.

### Concurrent Setup
**Scenario**: Multiple terminals run `bun run setup` simultaneously.

**Handling**: File system operations are atomic enough; worst case is redundant copy.

### Workspace in Use During Reset
**Scenario**: Dev server running while user runs `bun run setup --force`.

**Handling**: Files may be locked or in use. User should stop dev server first.

### Symlink Edge Cases
**Scenario**: Source template or destination contains symlinks.

**Handling**: `cp -r` preserves symlinks by default, which works correctly.

## Security Considerations

### Path Traversal
**Prevention**:
- Absolute path validation prevents `../` attacks
- `path.normalize()` used in terminal mode
- Boundary checks ensure paths stay within workspace

### Arbitrary File Access
**Prevention**:
- Local mode only works when `BRIDGE_ENV=local` (won't be set in production)
- Test credentials only work in local mode
- `.alive/` is gitignored (never deployed)

### Environment Variable Injection
**Prevention**:
- Path validated as absolute before use
- Directory existence + type checked
- No shell evaluation of env var values

## Testing Checklist

- [ ] Run setup on fresh clone
- [ ] Run setup when template exists (should skip)
- [ ] Run setup --force (should replace)
- [ ] Test with missing source template
- [ ] Test with .alive as file instead of directory
- [ ] Test with template as file instead of directory
- [ ] Test with empty template directory
- [ ] Test .env.local detection (missing, misconfigured, correct)
- [ ] Test runtime with missing LOCAL_TEMPLATE_PATH
- [ ] Test runtime with relative path
- [ ] Test runtime with non-existent path
- [ ] Test runtime with file instead of directory
- [ ] Verify .alive/ is gitignored
- [ ] Verify test credentials only work when BRIDGE_ENV=local
