# Core Package Test Agent

## Scope

- **Domain**: `/packages/@solomon/core/` test suite
- **Responsibility**: Fix all Solomon core package tests
- **Independence**: Complete autonomy over core package test files

## Key Tasks

1. Fix SwarmCoordinator test failures (critical priority)
2. Fix LangGraph integration tests
3. Fix agent tests (Queen Agent, etc.)
4. Fix base graph tests
5. Ensure all core tests pass with 0 failures

## Test Files

- `/packages/@solomon/core/tests/swarm/swarm-coordinator.test.ts`
- `/packages/@solomon/core/tests/agents/queen-agent-langgraph.test.ts`
- `/packages/@solomon/core/tests/graphs/base-graph.test.ts`
- All test doubles and supporting files

## Commands

- `cd packages/@solomon/core && bun test`
- `cd packages/@solomon/core && bun run test:coverage`

## Success Criteria

- All core package tests pass (0 failures)
- No skipped tests
- SwarmCoordinator agent limit bug fixed
- LangGraph integration working
