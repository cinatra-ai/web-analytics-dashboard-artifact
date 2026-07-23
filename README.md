# Web Analytics Dashboard

The web-analytics meaning pack for Cinatra: a ready-made dashboard artifact extension that ships a real Web Analytics Overview and gives every dashboard it materializes the web-analytics meaning. It is the first meaning-type pack built on the generic `@cinatra-ai/dashboard-artifact` base — a required dependency it layers on top of.

The pack declares its own namespaced meaning type, `@cinatra-ai/web-analytics-dashboard-artifact:web-analytics-dashboard`, and carries a versioned `dashboardContribution` whose sidecar is a Cinatra dashboard config (apiVersion v1.2) grounded in the platform's real analytics cubes. Installing it materializes the dashboard as a first-class artifact with its paired object twin under the artifact carrier. The authoritative manifest is the `cinatra` block in `package.json`; the TypeScript manifest in `src/index.ts` mirrors it and is pinned in agreement by `tests/manifest.test.ts` — update both in the same commit.

## Works with

- `@cinatra-ai/dashboard-artifact` — the generic dashboard base this pack requires and layers meaning onto
- The Cinatra dashboards substrate — analytics portlets over the platform's real cubes (artifacts, agent runs, LLM usage)
- Cinatra permissions, scopes, and the marketplace catalog — governs and lists the shipped dashboard like any artifact

## Capabilities

- Ship a ready-made Web Analytics Overview dashboard that materializes with its object twin
- Declare the namespaced `web-analytics-dashboard` meaning type as a first-class artifact claim
- Carry the versioned dashboard sidecar (apiVersion v1.2) the host materializer validates and mounts
- Anchor the web-analytics meaning on the materialized dashboard without changing the generic twin row type
