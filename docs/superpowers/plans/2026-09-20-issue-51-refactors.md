# Issue 51 Refactors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete issues #126, #127, and #128 without changing public behavior.

**Architecture:** Existing route response helpers become the consistent boundary for JSON, 400, 404, and empty 204 responses. New typed KV primitives accept complete keys and prefixes while repositories retain key construction and specialized behavior. The client API is split into domain modules and recomposed behind the existing `api` export.

**Tech Stack:** Deno, Fresh 2, TypeScript, Deno KV

**Spec:** GitHub issues #126, #127, and #128

## Global Constraints

- Preserve route URLs, methods, status codes, bodies, authorization, and validation.
- Preserve household-scoped KV key layouts and all repository public contracts.
- Preserve every `api.<domain>.<operation>` signature and failure value.
- Run `deno task check` and `deno task test` before completion.

---

### Task 1: Standardize API responses

**Files:**
- Modify: legacy handlers under `routes/api/`
- Test: their existing adjacent route tests

**Interfaces:**
- Consumes: `json`, `badRequest`, `notFound`, and `noContent` from `utils/http.ts`
- Produces: unchanged endpoint contracts with consistent JSON content types

- [ ] Add assertions that representative legacy JSON responses carry the JSON content type.
- [ ] Run the targeted tests and confirm the new assertions fail.
- [ ] Replace semantically equivalent manual responses with shared helpers.
- [ ] Run all route tests.

### Task 2: Extract KV primitives

**Files:**
- Create: `database/kv.ts`
- Create: `database/kv.test.ts`
- Modify: straightforward repository implementations under `database/`
- Modify: `database/index.ts`

**Interfaces:**
- Produces: `getKvValue<T>(key): Promise<T | null>`, `listKvValues<T>(prefix): Promise<T[]>`, `setKvValue<T>(key, value)`, and `deleteKvValue(key)`
- Repositories continue to construct complete keys and prefixes.

- [ ] Write tests for typed read, prefix isolation, set, and delete.
- [ ] Run the helper tests and confirm failure because the module is absent.
- [ ] Implement the minimal helpers.
- [ ] Adopt them only for straightforward primitive operations; retain atomic/specialized operations locally.
- [ ] Run repository tests.

### Task 3: Split the client API

**Files:**
- Create: focused modules under `services/api/`
- Modify: `services/api.ts`
- Test: existing service and feature tests

**Interfaces:**
- Produces: domain objects composed into the existing exported `api` object.
- Preserves all existing namespace names, operation names, signatures, and request behavior.

- [ ] Add a contract test that imports the composed API and exercises representative namespaces.
- [ ] Run it before extraction to capture current behavior.
- [ ] Move namespaces into focused modules and share only genuinely cross-domain request helpers.
- [ ] Recompose the unchanged `api` object in `services/api.ts`.
- [ ] Run service and feature tests.

### Task 4: Final verification

- [ ] Run `deno task check`.
- [ ] Run `deno task test`.
- [ ] Review the diff against all three issue briefs and remove unrelated changes.
