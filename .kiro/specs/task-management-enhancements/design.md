****# Design Document

## Overview

This design enhances the solomon_codes task management system by introducing project-based organization, git worktree execution environments, and multi-version task execution capabilities. The system will allow users to create projects that represent git repositories with their own configurations, execute coding agents in isolated worktrees, and manage multiple task versions for optimal results.

The design follows modern development tool patterns (similar to VS Code, GitHub Desktop, and vibe-kanban) with a focus on productivity, isolation, and quality assurance through multiple solution generation.

## Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Enhanced Task System                    │
├─────────────┬───────────────────────────────────────────────┤
│   Projects  │              Task Execution                  │
│             │                                             │
│ Project     │         Git Worktree Manager               │
│ Management  │         Multi-Version Generator             │
│ Config      │         Dependency Installer               │
│ Scripts     │         Test Runner                         │
│             │                                             │
└─────────────┴───────────────────────────────────────────────┘
```

### Data Flow

```
Project Creation → Task Creation → Worktree Setup → Agent Execution → Version Generation → Review & Selection → Integration
```

## Components and Interfaces

### 1. Project Management System

**Purpose**: Manages git repositories as projects with their own configurations and task organization.

**Project Model**:
```typescript
interface Project {
  id: string;
  name: string;
  description: string;
  repositoryUrl: string;
  repositoryPath: string;
  setupScript?: string;
  devServerScript?: string;
  buildScript?: string;
  testScript?: string;
  environmentVariables: Record<string, string>;
  configFiles: string[];
  labels: string[];
  createdAt: string;
  updatedAt: string;
  lastActivity: string;
  taskCount: number;
  completedTaskCount: number;
  status: 'active' | 'archived' | 'error';
}
```

**ProjectStore**:
```typescript
interface ProjectStore {
  projects: Project[];
  activeProject: string | null;
  createProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Project>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  setActiveProject: (id: string) => void;
  getProjectById: (id: string) => Project | undefined;
  getProjectTasks: (projectId: string) => Task[];
}
```

### 2. Enhanced Task System

**Enhanced Task Model**:
```typescript
interface EnhancedTask extends Task {
  projectId: string;
  labels: string[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  estimatedTime?: number;
  actualTime?: number;
  versions: TaskVersion[];
  selectedVersionId?: string;
  worktreeId?: string;
  reviewStatus: 'pending' | 'approved' | 'rejected' | 'needs_changes';
  testResults?: TestResult[];
  codeQualityScore?: number;
}

interface TaskVersion {
  id: string;
  taskId: string;
  worktreeId: string;
  approach: string;
  filesChanged: string[];
  linesAdded: number;
  linesRemoved: number;
  testsPassed: number;
  testsFailed: number;
  codeQualityScore: number;
  executionTime: number;
  createdAt: string;
  status: 'generating' | 'completed' | 'failed' | 'selected';
}
```

### 3. Git Worktree Manager

**Purpose**: Manages isolated git worktrees for task execution.

**Worktree Model**:
```typescript
interface Worktree {
  id: string;
  taskId: string;
  versionId: string;
  projectId: string;
  path: string;
  branch: string;
  status: 'creating' | 'ready' | 'executing' | 'completed' | 'error' | 'cleanup';
  setupCompleted: boolean;
  dependenciesInstalled: boolean;
  configurationApplied: boolean;
  createdAt: string;
  lastActivity: string;
  diskUsage: number;
}

interface WorktreeManager {
  createWorktree: (taskId: string, projectId: string, versionId: string) => Promise<Worktree>;
  setupWorktree: (worktreeId: string) => Promise<void>;
  executeInWorktree: (worktreeId: string, command: string) => Promise<ExecutionResult>;
  cleanupWorktree: (worktreeId: string) => Promise<void>;
  getWorktreeStatus: (worktreeId: string) => Promise<WorktreeStatus>;
  listWorktrees: (projectId?: string) => Promise<Worktree[]>;
}
```

### 4. Multi-Version Task Executor

**Purpose**: Generates multiple solution versions for comparison and selection.

**Version Generator**:
```typescript
interface VersionGenerator {
  generateVersions: (
    taskId: string, 
    projectId: string, 
    versionCount: number,
    approaches?: string[]
  ) => Promise<TaskVersion[]>;
  compareVersions: (versionIds: string[]) => Promise<VersionComparison>;
  selectVersion: (taskId: string, versionId: string) => Promise<void>;
  archiveVersions: (taskId: string, excludeVersionId?: string) => Promise<void>;
}

interface VersionComparison {
  versions: TaskVersion[];
  metrics: {
    codeQuality: VersionMetric[];
    performance: VersionMetric[];
    testCoverage: VersionMetric[];
    maintainability: VersionMetric[];
  };
  recommendations: {
    best: string;
    reasons: string[];
    tradeoffs: string[];
  };
}

interface VersionMetric {
  versionId: string;
  score: number;
  details: Record<string, any>;
}
```

### 5. Project Configuration System

**Purpose**: Manages project-specific setup, build, and development configurations.

**Configuration Manager**:
```typescript
interface ProjectConfiguration {
  setupScript: ScriptConfiguration;
  devServerScript: ScriptConfiguration;
  buildScript: ScriptConfiguration;
  testScript: ScriptConfiguration;
  environmentVariables: EnvironmentVariable[];
  configFiles: ConfigFile[];
  dependencies: DependencyConfiguration;
}

interface ScriptConfiguration {
  command: string;
  args: string[];
  workingDirectory?: string;
  timeout: number;
  retries: number;
  environment: Record<string, string>;
}

interface EnvironmentVariable {
  key: string;
  value: string;
  encrypted: boolean;
  required: boolean;
}

interface ConfigFile {
  source: string;
  destination: string;
  template: boolean;
  variables: Record<string, string>;
}
```

### 6. Task Review and Integration System

**Purpose**: Provides tools for reviewing, testing, and integrating task solutions.

**Review System**:
```typescript
interface TaskReview {
  taskId: string;
  versionId: string;
  reviewerId: string;
  status: 'pending' | 'approved' | 'rejected' | 'needs_changes';
  comments: ReviewComment[];
  testResults: TestResult[];
  codeQualityReport: CodeQualityReport;
  createdAt: string;
  updatedAt: string;
}

interface ReviewComment {
  id: string;
  file: string;
  line: number;
  comment: string;
  type: 'suggestion' | 'issue' | 'question' | 'praise';
  resolved: boolean;
}

interface TestResult {
  suite: string;
  test: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  output?: string;
}
```

## Data Models

### Project Database Schema

```sql
-- Projects table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  repository_url VARCHAR(500) NOT NULL,
  repository_path VARCHAR(500),
  setup_script TEXT,
  dev_server_script TEXT,
  build_script TEXT,
  test_script TEXT,
  environment_variables JSONB DEFAULT '{}',
  config_files JSONB DEFAULT '[]',
  labels JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  task_count INTEGER DEFAULT 0,
  completed_task_count INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active'
);

-- Enhanced tasks table
CREATE TABLE enhanced_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  labels JSONB DEFAULT '[]',
  priority VARCHAR(20) DEFAULT 'medium',
  estimated_time INTEGER,
  actual_time INTEGER,
  selected_version_id UUID,
  worktree_id UUID,
  review_status VARCHAR(20) DEFAULT 'pending',
  code_quality_score DECIMAL(3,2),
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_archived BOOLEAN DEFAULT FALSE
);

-- Task versions table
CREATE TABLE task_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES enhanced_tasks(id) ON DELETE CASCADE,
  worktree_id UUID,
  approach TEXT,
  files_changed JSONB DEFAULT '[]',
  lines_added INTEGER DEFAULT 0,
  lines_removed INTEGER DEFAULT 0,
  tests_passed INTEGER DEFAULT 0,
  tests_failed INTEGER DEFAULT 0,
  code_quality_score DECIMAL(3,2),
  execution_time INTEGER,
  status VARCHAR(20) DEFAULT 'generating',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Worktrees table
CREATE TABLE worktrees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES enhanced_tasks(id) ON DELETE CASCADE,
  version_id UUID REFERENCES task_versions(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  path VARCHAR(500) NOT NULL,
  branch VARCHAR(255),
  status VARCHAR(20) DEFAULT 'creating',
  setup_completed BOOLEAN DEFAULT FALSE,
  dependencies_installed BOOLEAN DEFAULT FALSE,
  configuration_applied BOOLEAN DEFAULT FALSE,
  disk_usage BIGINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Error Handling

### Project Configuration Errors
- Invalid repository URLs or access permissions
- Script execution failures during setup
- Missing or invalid environment variables
- Configuration file template errors

### Worktree Management Errors
- Disk space limitations for worktree creation
- Git repository access issues
- Dependency installation failures
- Environment setup timeouts

### Version Generation Errors
- Coding agent execution failures
- Test execution errors in worktrees
- Code quality analysis failures
- Resource exhaustion during parallel version generation

### Integration Errors
- Merge conflicts during integration
- Pull request creation failures
- Branch protection rule violations
- CI/CD pipeline failures

## Testing Strategy

### Unit Tests
- Project CRUD operations and validation
- Worktree lifecycle management
- Version generation and comparison logic
- Configuration parsing and validation

### Integration Tests
- End-to-end project creation and task execution
- Multi-version generation and selection workflows
- Git operations and worktree management
- Real-time updates and state synchronization

### Performance Tests
- Concurrent worktree creation and management
- Large project handling with many tasks
- Version generation performance with multiple approaches
- Disk usage and cleanup efficiency

### Security Tests
- Environment variable encryption and access
- Repository access permission validation
- Worktree isolation and security
- Script execution sandboxing

## Performance Considerations

### Worktree Management
- Lazy worktree creation to minimize resource usage
- Automatic cleanup of unused worktrees
- Disk usage monitoring and alerts
- Parallel worktree operations with resource limits

### Version Generation
- Configurable limits on concurrent version generation
- Resource pooling for coding agent execution
- Caching of common setup operations
- Progressive version generation with early termination

### Data Storage
- Efficient indexing for project and task queries
- Archival strategies for completed tasks and versions
- Compression for large code diffs and outputs
- Partitioning for time-based data

## Migration Strategy

### Phase 1: Project Foundation
1. Create project management system
2. Migrate existing environments to projects
3. Update task creation to require project selection
4. Implement basic project configuration

### Phase 2: Worktree Integration
1. Implement worktree manager
2. Update task execution to use worktrees
3. Add project setup script execution
4. Implement worktree cleanup processes

### Phase 3: Multi-Version System
1. Add version generation capabilities
2. Implement version comparison tools
3. Add version selection and archival
4. Create review and integration workflows

### Phase 4: Advanced Features
1. Add advanced analytics and reporting
2. Implement performance optimizations
3. Add collaborative features
4. Create comprehensive monitoring and alerting

This design provides a robust foundation for enhanced task management with project organization, isolated execution environments, and multi-version solution generation, similar to the vibe-kanban approach but tailored to the solomon_codes architecture.