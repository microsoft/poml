---
allowed-tools: ide - getDiagnostics
---

# Browser RPC Registry Management

The POML browser extension uses an RPC system with `everywhere()` functions that need to be properly registered in:

- `GlobalFunctions` interface in `common/types.ts`
- Worker-specific registry files (`background/registry.ts`, `contentScript/registry.ts`, `ui/registry.ts`)
- Test helpers for proper testing

## Stepwise Instructions

### 1. Find Functions with `everywhere()`

```bash
# Command to find all everywhere() usage:
grep -rn "everywhere(" packages/poml-browser --include="*.ts" | grep -v node_modules
```

### 2. Find `GlobalFunctions` Interface within `common/types.ts` and Update GlobalFunctions Interface

1. Add missing function signatures to `common/types.ts`
2. Import required option types from their respective modules
3. Ensure all `everywhere()` functions have corresponding type definitions
4. All types in `GlobalFunctions` must be async

### 3. Update Registry Files and Test Helpers

Consider the following registry files:

1. `contentScript/registry.ts`
2. `ui/registry.ts`
3. `background/registry.ts`

You should add missing functions to `__TEST_BUILD__` blocks in each registry, and ensure all RPC functions are available for testing in their appropriate contexts.
