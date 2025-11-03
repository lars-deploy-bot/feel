# GitHub Integration: Bidirectional Synchronization

## Overview

Lovable provides seamless two-way synchronization with GitHub, enabling collaborative development across platforms.

## Automatic Synchronization

### How It Works
- **Lovable → GitHub**: Changes made in Lovable automatically push to GitHub
- **GitHub → Lovable**: Changes pushed to GitHub automatically sync to Lovable
- **Real-time**: No manual pull or push operations required

## Initial Setup

### Connecting GitHub

1. Navigate to GitHub button in Lovable editor
2. Click "Connect to GitHub"
3. Authorize the Lovable GitHub App on GitHub
4. Select target GitHub account or organization
5. Click "Create Repository" in Lovable

**Important**: Only one GitHub account can be connected per Lovable account.

## Import Limitations

### Current Constraints
Lovable does not currently support direct import of existing GitHub repositories.

### Workarounds
1. **Manual Copy Method**:
   - Create new Lovable project
   - Connect to GitHub
   - Manually copy code from existing repository

2. **Code Snippet Transfer**:
   - For smaller projects, copy code snippets directly into Lovable
   - Suitable for quick prototypes or small codebases

## Version Control Features

### Built-in Version History
- **Google Docs-style versioning**: Browse and restore previous states
- **Non-technical rollback**: Revert changes without Git knowledge
- **Visual timeline**: See all project changes chronologically

### Git Branches (Experimental)
Limited branch support available:
- Enable in Account Settings → Labs → GitHub Branch Switching
- Experimental feature with ongoing improvements
- Not recommended for production workflows yet

## Parallel Development Workflows

### Simultaneous Development
You can work in both Lovable and local IDE concurrently:

1. **Local Development**:
   - Clone repository locally
   - Make changes in your preferred IDE
   - Push changes to GitHub
   - Changes automatically sync to Lovable

2. **Feature Branches**:
   - Create branches for new features
   - Review via GitHub pull requests
   - Merge to default branch
   - Lovable reflects merged changes

3. **CI/CD Integration**:
   - Use GitHub Actions for automated testing
   - Continue development in Lovable
   - Deployment pipelines work independently

## Self-Hosting Options

### Hosting Independence
After GitHub connection, your code becomes portable:

- **Standard Web Application**: Code in GitHub is standard React/TypeScript
- **Deploy Anywhere**: Use any hosting provider
- **Continue Using Lovable**: Keep Lovable as development environment
- **Environment Management**: Configure variables in hosting platform

### Flexible Architecture
- Develop in Lovable for speed and AI assistance
- Host on your infrastructure for control
- Maintain version control through GitHub
- Deploy via CI/CD pipelines

## Best Practices

### Development Workflow
1. Make changes in Lovable for AI-assisted development
2. Review changes in GitHub commits
3. Use pull requests for code review
4. Merge to main branch for deployment
5. Monitor deployments through hosting platform

### Collaboration
- Lovable changes appear as GitHub commits
- Team members can review via GitHub interface
- Merge conflicts resolved through standard Git workflows
- Non-technical team members use Lovable
- Technical team members can use traditional tools

---

**Key Advantage**: Lovable's GitHub integration bridges the gap between AI-assisted development and traditional software engineering workflows.
