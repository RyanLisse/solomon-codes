# Design Document

## Overview

This design transforms the solomon_codes web application from its current centered layout into a comprehensive sidebar-based interface. The new layout will feature a collapsible sidebar containing navigation, task management, and context engine functionality, while preserving the existing AI chat interface as the main content area.

The design follows modern development tool patterns (similar to VS Code, GitHub Desktop, and Terragon) with a focus on productivity, accessibility, and seamless integration with existing features.

## Architecture

### Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Layout                      │
├─────────────┬───────────────────────────────────────────────┤
│   Sidebar   │              Main Content Area              │
│             │                                             │
│ Navigation  │         Existing AI Chat Interface         │
│ Tasks       │         (TaskForm + TaskList)              │
│ Context     │                                             │
│ Engine      │                                             │
│             │                                             │
└─────────────┴───────────────────────────────────────────────┘
```

### Component Hierarchy

```
RootLayout
├── ThemeProvider
├── QueryProvider
├── Container (Inngest subscription)
└── AppShell (NEW)
    ├── Sidebar (NEW)
    │   ├── SidebarHeader
    │   ├── NavigationSection
    │   ├── TaskManagerSection
    │   ├── ContextEngineSection
    │   └── SupportSection
    └── MainContent
        └── [existing page content]
```

## Components and Interfaces

### 1. AppShell Component

**Purpose**: Root layout component that manages sidebar state and responsive behavior.

**Props**:
```typescript
interface AppShellProps {
  children: React.ReactNode;
}
```

**State**:
```typescript
interface AppShellState {
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  activeSection: string;
}
```

**Key Features**:
- Manages sidebar collapse/expand state
- Handles responsive breakpoints
- Persists sidebar preferences to localStorage
- Provides context for child components

### 2. Sidebar Component

**Purpose**: Main sidebar container with collapsible functionality.

**Props**:
```typescript
interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  activeSection: string;
  onSectionChange: (section: string) => void;
}
```

**Sections**:
- Header with logo and collapse button
- Navigation (Home, Automations, Stats)
- Configure (Environments, Settings)
- Task Manager (Active, Archived)
- Context Engine (Project context, files)
- Support (Documentation, Feedback, etc.)

### 3. NavigationSection Component

**Purpose**: Primary navigation menu with icons and labels.

**Navigation Items**:
```typescript
interface NavigationItem {
  id: string;
  label: string;
  icon: React.ComponentType;
  href: string;
  badge?: number;
  disabled?: boolean;
}

const navigationItems: NavigationItem[] = [
  { id: 'home', label: 'Home', icon: Home, href: '/' },
  { id: 'automations', label: 'Automations', icon: Bot, href: '/automations' },
  { id: 'stats', label: 'Stats', icon: BarChart, href: '/stats' },
];
```

### 4. TaskManagerSection Component

**Purpose**: Integrated task management within the sidebar.

**Props**:
```typescript
interface TaskManagerSectionProps {
  collapsed: boolean;
}
```

**Features**:
- Displays active and archived tasks
- Shows task status indicators
- Provides quick actions (view, archive, delete)
- Groups tasks by time periods
- Real-time updates via existing Inngest integration

**Task Display Format**:
```typescript
interface TaskDisplayItem {
  id: string;
  title: string;
  status: TaskStatus;
  repository: string;
  branch: string;
  timestamp: string;
  hasChanges: boolean;
  statusIndicator: 'success' | 'error' | 'pending' | 'idle';
}
```

### 5. ContextEngineSection Component

**Purpose**: Provides contextual information and AI assistance integration.

**Props**:
```typescript
interface ContextEngineSectionProps {
  collapsed: boolean;
  currentRepository?: string;
  currentBranch?: string;
}
```

**Context Types**:
```typescript
interface ContextItem {
  id: string;
  type: 'file' | 'branch' | 'commit' | 'issue' | 'pr';
  title: string;
  subtitle?: string;
  icon: React.ComponentType;
  actions: ContextAction[];
}

interface ContextAction {
  id: string;
  label: string;
  icon: React.ComponentType;
  onClick: () => void;
}
```

**Features**:
- Current repository/branch information
- Recent file changes
- Relevant project files
- Quick actions to add context to AI chat
- Integration with existing GitHub auth

### 6. SupportSection Component

**Purpose**: Support and configuration options.

**Items**:
- Release Notes
- Documentation (links to docs app)
- Send Feedback
- Discord community
- Settings/Preferences

## Data Models

### Sidebar State Management

```typescript
interface SidebarState {
  collapsed: boolean;
  width: number;
  activeSection: string;
  preferences: {
    defaultCollapsed: boolean;
    rememberState: boolean;
    showBadges: boolean;
  };
}

// Zustand store
interface SidebarStore extends SidebarState {
  toggleCollapse: () => void;
  setActiveSection: (section: string) => void;
  updatePreferences: (preferences: Partial<SidebarState['preferences']>) => void;
  reset: () => void;
}
```

### Context Engine Data

```typescript
interface ProjectContext {
  repository: string;
  branch: string;
  recentFiles: FileInfo[];
  recentCommits: CommitInfo[];
  openIssues: IssueInfo[];
  activePRs: PRInfo[];
}

interface FileInfo {
  path: string;
  lastModified: string;
  status: 'modified' | 'added' | 'deleted';
  size: number;
}
```

## Error Handling

### Sidebar Persistence Errors
- Graceful fallback to default state if localStorage is unavailable
- Error boundaries around sidebar sections to prevent full app crashes
- Retry mechanisms for failed context data fetches

### Task Manager Integration
- Leverage existing error handling from task store
- Display error states in sidebar task list
- Fallback to cached data when real-time updates fail

### Context Engine Errors
- Handle GitHub API rate limiting gracefully
- Show loading states for slow context fetches
- Provide manual refresh options for failed context loads

## Testing Strategy

### Unit Tests
- Sidebar state management (collapse/expand, persistence)
- Navigation item rendering and interactions
- Task manager section data display
- Context engine data processing

### Integration Tests
- Sidebar integration with existing layout
- Task manager real-time updates
- Context engine GitHub integration
- Theme switching with sidebar

### E2E Tests
- Complete sidebar workflow (navigation, task management)
- Responsive behavior across breakpoints
- Keyboard navigation and accessibility
- Sidebar state persistence across sessions

### Accessibility Tests
- Screen reader compatibility
- Keyboard navigation
- Focus management
- Color contrast compliance
- ARIA labels and roles

## Performance Considerations

### Lazy Loading
- Context engine data loaded on demand
- Task manager sections virtualized for large task lists
- Navigation icons loaded asynchronously

### Memoization
- Sidebar sections memoized to prevent unnecessary re-renders
- Task list items memoized based on task ID and status
- Context items memoized based on repository and branch

### Bundle Optimization
- Sidebar components code-split from main content
- Icons tree-shaken to include only used icons
- Context engine features loaded progressively

## Migration Strategy

### Phase 1: Core Layout
1. Create AppShell component with basic sidebar
2. Move existing content to main content area
3. Implement sidebar collapse/expand functionality
4. Add basic navigation items

### Phase 2: Task Integration
1. Move task management to sidebar
2. Implement compact task display
3. Add real-time task updates to sidebar
4. Preserve existing task functionality

### Phase 3: Context Engine
1. Add context engine section
2. Implement GitHub integration for context
3. Add context actions and AI chat integration
4. Optimize performance and user experience

### Phase 4: Polish & Enhancement
1. Add support section and settings
2. Implement advanced features (badges, notifications)
3. Optimize responsive behavior
4. Add comprehensive testing

## Responsive Design

### Breakpoints
- **Desktop (≥1024px)**: Full sidebar with labels
- **Tablet (768px-1023px)**: Collapsed sidebar with icons only
- **Mobile (≤767px)**: Overlay sidebar that slides in/out

### Mobile Adaptations
- Sidebar becomes full-screen overlay on mobile
- Touch-friendly tap targets (minimum 44px)
- Swipe gestures for sidebar open/close
- Simplified context engine for mobile

## Theme Integration

### Dark/Light Mode Support
- Sidebar respects existing theme system
- Proper contrast ratios for all sidebar elements
- Smooth theme transitions
- Theme-aware icons and indicators

### Custom Properties
```css
:root {
  --sidebar-width: 280px;
  --sidebar-collapsed-width: 60px;
  --sidebar-bg: hsl(var(--background));
  --sidebar-border: hsl(var(--border));
  --sidebar-text: hsl(var(--foreground));
  --sidebar-text-muted: hsl(var(--muted-foreground));
  --sidebar-hover: hsl(var(--accent));
}
```

## Security Considerations

### Data Access
- Context engine respects existing GitHub authentication
- Task data remains in existing secure stores
- No additional API endpoints required for basic functionality

### Privacy
- Sidebar state stored locally only
- Context data cached with appropriate TTL
- User preferences respect privacy settings

This design maintains backward compatibility while providing a modern, productive interface that enhances the existing solomon_codes application functionality.