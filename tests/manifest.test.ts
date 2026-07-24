// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  BASE_DASHBOARD_OBJECT_TYPE,
  DASHBOARD_ARTIFACT_MEDIA_TYPE,
  REQUIRED_BASE_EXTENSION,
  WEB_ANALYTICS_CONTRIBUTION_KEY,
  WEB_ANALYTICS_DASHBOARD_MEANING_TYPE,
  webAnalyticsDashboardArtifactManifest,
} from "../src/index";

const readJson = (rel: string) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8"));

const pkg = readJson("../package.json") as {
  name: string;
  cinatra: {
    apiVersion: string;
    kind: string;
    displayName: string;
    vendor: { key: string; name: string };
    dependencies: Array<{
      packageName: string;
      edgeType: string;
      versionConstraint: { kind: string; range?: string; version?: string };
      requirement: string;
      kind?: string;
    }>;
    artifact: {
      accepts: { dashboard?: true; file?: unknown; connectorRef?: unknown };
      templates?: Array<{ id: string; form: string; mimeType: string; path: string; default?: boolean }>;
      objectTypes?: Array<{
        type: string;
        claim: string;
        dispositions?: Record<string, unknown>;
        schema?: { type?: string; properties?: Record<string, unknown>; required?: string[] };
      }>;
    };
    dashboardContribution?: {
      abiVersion: number;
      sdkAbiRange: string;
      contributionVersion: number;
      contributionKey: string;
      sidecar?: string;
      adopts?: unknown[];
    };
  };
};

// Host allowlist (packages/extensions/src/artifact-handler.validate) — the
// dashboardContribution carrier key (cinatra#2005) is admitted alongside views +
// fieldRenderers.
const ARTIFACT_ALLOWED_CINATRA_KEYS = new Set([
  "kind",
  "apiVersion",
  "artifact",
  "dependencies",
  "roles",
  "displayName",
  "vendor",
  "views",
  "fieldRenderers",
  "dashboardContribution",
]);

// The bundled (host-owned, always-present) cube catalog — the cube guard admits
// exactly these without a runtime-cube-registry alias.
const BUNDLED_CUBES = new Set([
  "agent_runs",
  "projects",
  "teams",
  "organizations",
  "artifacts",
  "llm_usage",
]);

describe("package.json manifest — the web-analytics meaning pack identity", () => {
  it("names the package per the @cinatra-ai/<slug>-artifact convention", () => {
    expect(pkg.name).toBe("@cinatra-ai/web-analytics-dashboard-artifact");
  });

  it("declares the first-party artifact identity", () => {
    expect(pkg.cinatra.kind).toBe("artifact");
    expect(pkg.cinatra.apiVersion).toBe("cinatra.ai/v1");
    expect(pkg.cinatra.displayName).toBe("Web Analytics Dashboard");
    expect(pkg.cinatra.vendor).toEqual({ key: "cinatra-ai", name: "Cinatra" });
  });

  it("declares only the allowed cinatra.* keys", () => {
    for (const k of Object.keys(pkg.cinatra)) {
      expect(ARTIFACT_ALLOWED_CINATRA_KEYS.has(k)).toBe(true);
    }
  });

  it("REQUIRES the generic base @cinatra-ai/dashboard-artifact", () => {
    const dep = pkg.cinatra.dependencies.find((d) => d.packageName === REQUIRED_BASE_EXTENSION);
    expect(dep).toBeDefined();
    expect(dep!.requirement).toBe("required");
    expect(dep!.edgeType).toBe("runtime");
    expect(dep!.kind).toBe("artifact");
    expect(dep!.versionConstraint.kind).toBe("semver-range");
    expect(typeof dep!.versionConstraint.range).toBe("string");
    expect((dep!.versionConstraint.range as string).length).toBeGreaterThan(0);
  });

  it("accepts EXACTLY the dashboard representation form", () => {
    expect(pkg.cinatra.artifact.accepts).toEqual({ dashboard: true });
  });

  it("ships a form:\"dashboard\" template pointing at the sidecar", () => {
    const templates = pkg.cinatra.artifact.templates ?? [];
    expect(templates).toHaveLength(1);
    const [t] = templates;
    expect(t.form).toBe("dashboard");
    expect(t.id).toBe("web-analytics-overview");
    expect(t.mimeType).toBe(DASHBOARD_ARTIFACT_MEDIA_TYPE);
    expect(t.path).toBe("./cinatra/dashboard.json");
    expect(t.default).toBe(true);
  });

  it("DECLARES exactly one namespaced meaning-type claim (self-registered)", () => {
    const claims = pkg.cinatra.artifact.objectTypes ?? [];
    expect(claims).toHaveLength(1);
    const [claim] = claims;
    expect(claim.type).toBe(WEB_ANALYTICS_DASHBOARD_MEANING_TYPE);
    expect(claim.type.startsWith(`${pkg.name}:`)).toBe(true);
    expect(claim.claim).toBe("dedicated");
    // The meaning type is a NEW namespaced type, distinct from the generic base
    // twin type it asserts meaning over.
    expect(claim.type).not.toBe(BASE_DASHBOARD_OBJECT_TYPE);
    expect(claim.dispositions).toEqual({
      projection: "artifact-safe",
      pinnable: false,
      snapshotPolicy: "metadata",
      sensitivity: "normal",
    });
    expect(claim.schema?.type).toBe("object");
  });

  it("carries a valid v1 dashboardContribution pointing at the sidecar", () => {
    const dc = pkg.cinatra.dashboardContribution;
    expect(dc).toBeDefined();
    expect(dc!.abiVersion).toBe(1);
    expect(dc!.contributionVersion).toBe(1);
    expect(dc!.contributionKey).toBe(WEB_ANALYTICS_CONTRIBUTION_KEY);
    // strict lowercase kebab (CONTRIBUTION_KEY_RE)
    expect(dc!.contributionKey).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(dc!.sidecar).toBe("./cinatra/dashboard.json");
    // sdkAbiRange is the generated caret pin over the canonical SDK ABI.
    expect(dc!.sdkAbiRange).toMatch(/^\^\d+\.\d+\.\d+$/);
  });

  it("keeps the typed src manifest in agreement with package.json", () => {
    expect(webAnalyticsDashboardArtifactManifest.accepts).toEqual(pkg.cinatra.artifact.accepts);
    expect(webAnalyticsDashboardArtifactManifest.templates).toEqual(pkg.cinatra.artifact.templates);
    expect(webAnalyticsDashboardArtifactManifest.objectTypes).toEqual(pkg.cinatra.artifact.objectTypes);
    expect(DASHBOARD_ARTIFACT_MEDIA_TYPE).toBe("application/vnd.cinatra.dashboard.v12+json");
  });
});

describe("cinatra/dashboard.json — the shipped Web Analytics Overview (apiVersion 1.2)", () => {
  const config = readJson("../cinatra/dashboard.json") as {
    apiVersion: string;
    scopeLevel: string;
    portlets: Array<{
      instanceId: string;
      kind: string;
      version: string;
      slot: string;
      config: { dashboard?: { portlets?: Array<Record<string, unknown>> } };
    }>;
  };

  it("is an apiVersion 1.2 extension dashboard config", () => {
    expect(config.apiVersion).toBe("v1.2");
    expect(["user", "team", "organization", "workspace", "project"]).toContain(config.scopeLevel);
    expect(Array.isArray(config.portlets)).toBe(true);
    expect(config.portlets.length).toBeGreaterThan(0);
  });

  it("mounts an analytics portlet embedding a real widget set", () => {
    const analytics = config.portlets.find((p) => p.kind === "analytics");
    expect(analytics).toBeDefined();
    expect(analytics!.slot).toBe("fixed");
    expect(analytics!.version).toBe("1.0.0");
    const widgets = analytics!.config.dashboard?.portlets ?? [];
    expect(widgets.length).toBeGreaterThanOrEqual(3);
    for (const w of widgets) {
      expect(typeof w.id).toBe("string");
      expect(typeof w.title).toBe("string");
    }
  });

  it("references ONLY host-bundled cubes (cube guard passes at materialization)", () => {
    const cubePrefix = (member: unknown): string | undefined =>
      typeof member === "string" && member.includes(".") ? member.split(".")[0] : undefined;
    const collectCubes = (q: unknown, into: Set<string>) => {
      if (typeof q !== "object" || q === null) return;
      const query = q as Record<string, unknown>;
      for (const key of ["measures", "dimensions"]) {
        const arr = query[key];
        if (Array.isArray(arr)) for (const m of arr) { const c = cubePrefix(m); if (c) into.add(c); }
      }
      if (query.order && typeof query.order === "object") {
        for (const k of Object.keys(query.order as Record<string, unknown>)) { const c = cubePrefix(k); if (c) into.add(c); }
      }
    };
    const analytics = config.portlets.find((p) => p.kind === "analytics")!;
    const widgets = analytics.config.dashboard?.portlets ?? [];
    const cubes = new Set<string>();
    for (const w of widgets) {
      const ac = (w as Record<string, unknown>).analysisConfig as Record<string, unknown> | undefined;
      collectCubes(ac?.query, cubes);
      // KPI widgets must stay single-cube (issue #1512).
      const perWidget = new Set<string>();
      collectCubes(ac?.query, perWidget);
      expect(perWidget.size).toBeLessThanOrEqual(1);
    }
    for (const c of cubes) expect(BUNDLED_CUBES.has(c)).toBe(true);
    expect(cubes.size).toBeGreaterThan(0);
  });
});
