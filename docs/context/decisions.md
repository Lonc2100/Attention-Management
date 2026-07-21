# Architecture Decisions

## D001 — Incremental Electron Harness-lite

Adopt Harness governance inside the existing Electron repository. Do not regenerate the product as a Next.js project and do not reorganize source files in one pass.

## D002 — Trellis and Harness Have Different Jobs

Trellis owns tasks, PRDs, execution plans, releases and journals. Harness owns the read order, architecture map, import boundaries and verification gate.

## D003 — External Systems Are Providers

ActivityWatch, Codex app-server/CLI, Windows UI Automation, local commands and OS APIs are external providers. They must not leak into renderer UI or shared pure rules.

## D004 — Typed IPC Is the Renderer Boundary

Renderer code interacts with native capabilities only through the typed preload bridge. Browser windows remain sandboxed with context isolation and Node integration disabled.
