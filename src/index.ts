import type { SemanticArtifactManifest } from "@cinatra-ai/sdk-extensions";

// `@cinatra-ai/web-analytics-dashboard-artifact` — the FIRST dashboardContribution
// meaning pack (epic cinatra#1883; follow-on of cinatra#1896). It layers the
// web-analytics MEANING onto the generic, meaning-free
// `@cinatra-ai/dashboard-artifact` base (a REQUIRED dependency), and ships a
// ready-made dashboard the host materializes.
//
// What this pack ships (MANIFEST + TYPE + SIDECAR):
//   - a REQUIRED runtime dependency on `@cinatra-ai/dashboard-artifact` (the
//     generic base whose one `:dashboard` object type every dashboard twin row
//     carries);
//   - `accepts.dashboard: true` — the formless, viewSpec-backed dashboard
//     representation form the substrate models (NOT an uploaded blob);
//   - ONE namespaced MEANING type,
//     `@cinatra-ai/web-analytics-dashboard-artifact:web-analytics-dashboard`.
//     This is the pack's meaning CLAIM. A dashboard's "web-analytics" meaning is
//     an eligible `authoring_skill` semantic assertion minted at materialization
//     (the paired cinatra core delta for cinatra#1896), NOT a distinct twin row
//     type — the twin ALWAYS stays the generic `:dashboard` type;
//   - a `templates[]` entry with `form:"dashboard"` + the versioned
//     `cinatra.dashboardContribution` carrier (cinatra#2005), both pointing at
//     the `./cinatra/dashboard.json` sidecar: a real Web Analytics Overview
//     dashboard (apiVersion 1.2) whose widget set + data contract are grounded
//     in the merged dashboards substrate (the `analytics` portlet kind over the
//     platform's real bundled cubes: agent_runs, artifacts, llm_usage).
//
// Deliberately NOT shipped here:
//   - NO renderer / `ui` bundle. The first-party dashboard representation viewer
//     is a HOST registration; a per-pack semantic renderer for the base rows is
//     the cross-namespace bridge (cinatra#2010), out of scope to ship here.
//   - NO twin writer / materializer. Those are host-side (already merged).
//
// The AUTHORITATIVE manifest is the `cinatra` block in `package.json` (what the
// host install pipeline + the marketplace publish gate read). This module
// re-declares the `artifact` descriptor as a typed value for programmatic use;
// the two are pinned in agreement by `tests/manifest.test.ts`.

/**
 * The published dashboard representation media type — the envelope-versioned
 * (`v12`) media type the base `@cinatra-ai/dashboard-artifact` twin rows carry
 * and the host representation viewer registers against.
 */
export const DASHBOARD_ARTIFACT_MEDIA_TYPE =
  "application/vnd.cinatra.dashboard.v12+json" as const;

/**
 * The generic base object type every dashboard twin row carries (owned by the
 * REQUIRED `@cinatra-ai/dashboard-artifact` base). This pack's meaning attaches
 * to rows of THIS type via an assertion; it never mints a distinct row type.
 */
export const BASE_DASHBOARD_OBJECT_TYPE =
  "@cinatra-ai/dashboard-artifact:dashboard" as const;

/** The REQUIRED generic-base dependency this meaning pack layers on top of. */
export const REQUIRED_BASE_EXTENSION = "@cinatra-ai/dashboard-artifact" as const;

/**
 * This pack's namespaced MEANING type (self-registered under this package's
 * namespace). The dedicated claim reserves it; the materialization meaning
 * assertion binds a materialized dashboard's twin to this pack.
 */
export const WEB_ANALYTICS_DASHBOARD_MEANING_TYPE =
  "@cinatra-ai/web-analytics-dashboard-artifact:web-analytics-dashboard" as const;

/** The author-local `cinatra.dashboardContribution` key (strict lowercase kebab). */
export const WEB_ANALYTICS_CONTRIBUTION_KEY = "web-analytics" as const;

export const webAnalyticsDashboardArtifactManifest: SemanticArtifactManifest = {
  accepts: {
    dashboard: true,
  },
  templates: [
    {
      id: "web-analytics-overview",
      form: "dashboard",
      mimeType: DASHBOARD_ARTIFACT_MEDIA_TYPE,
      path: "./cinatra/dashboard.json",
      default: true,
    },
  ],
  objectTypes: [
    {
      type: WEB_ANALYTICS_DASHBOARD_MEANING_TYPE,
      claim: "dedicated",
      // Mirrors the base generic dashboard row's dispositions: an artifact-safe,
      // metadata-snapshotted, non-pinnable record. No `mutability` class is
      // declared — a dashboard twin is a LIVING record the host twin writer
      // updates on every dashboard mutation; pinning it immutable would be wrong.
      dispositions: {
        projection: "artifact-safe",
        pinnable: false,
        snapshotPolicy: "metadata",
        sensitivity: "normal",
      },
      schema: {
        type: "object",
        properties: {
          artifactType: { type: "string" },
          title: { type: "string" },
          dashboardId: { type: "string" },
          status: { type: "string" },
          entityRef: { type: "string" },
          mime: { type: "string", const: DASHBOARD_ARTIFACT_MEDIA_TYPE },
          size: { type: "number" },
          originKind: { type: "string" },
          latestRepresentationRevisionId: { type: "string" },
          latestDigest: { type: "string" },
          viewerHint: { type: "string" },
          excerpt: { type: "string" },
        },
        required: [
          "artifactType",
          "dashboardId",
          "status",
          "mime",
          "size",
          "originKind",
          "latestRepresentationRevisionId",
        ],
        additionalProperties: true,
      },
    },
  ],
};
