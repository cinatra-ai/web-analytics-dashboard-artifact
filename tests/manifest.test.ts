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

  // The renderer contract: every widget's `chartConfig` must carry what the
  // chart type's RENDERER reads. A renderer reads only its own keys — a member
  // parked under a key that type never reads is invisible to it, and a key the
  // renderer requires but finds empty yields a "Configuration Error" card in
  // place of the chart. The host validates the dashboard STRUCTURE and the
  // QUERIES (packages/dashboards portlet kinds) and deliberately leaves chart
  // semantics to the renderer, so this contract is the pack's own to hold.
  describe("chartConfig satisfies the renderer contract", () => {
    type AcceptType = "measure" | "dimension" | "timeDimension";
    type ConfigKey = {
      key: string;
      /** The RENDERER refuses to draw without it (not the editor's `mandatory` flag). */
      required: boolean;
      accepts: AcceptType[];
      maxItems?: number;
    };

    // Transcribed from drizzle-cube 0.6.4 (the version the host resolves). Two
    // sources per chart type, and the RENDERER is the binding one:
    //   - `charts/<Chart>.config.ts` `dropZones` — which keys exist for a type,
    //     what member class each accepts, and any `maxItems`;
    //   - the renderer itself — which of those it refuses to draw without.
    // They differ: `Bar.config.ts` marks `xAxis` non-mandatory (the editor lets
    // you drop it later), but every axis-resolved chart runs
    // `charts/chartAxisResolution.ts`, which yields `errorCode:"axisInvalid"`
    // unless BOTH `xAxis` and `yAxis` are present. `KpiNumber` resolves only
    // `chartConfig.yAxis` and shows `configErrorHint.noMeasures` when it is
    // empty; `DataTable` reads an optional `xAxis` column list and falls back to
    // the query's own fields when absent.
    const CHART_CONFIG_KEYS: Record<string, ConfigKey[]> = {
      kpiNumber: [{ key: "yAxis", required: true, accepts: ["measure"], maxItems: 1 }],
      bar: [
        // `maxItems: 1` on xAxis is the RESOLVER's rule, not the drop zone's:
        // `resolveChartAxisFields` takes `chartConfig.xAxis[0]` and ignores the
        // rest, so a second category parked here is dead config.
        { key: "xAxis", required: true, accepts: ["dimension", "timeDimension"], maxItems: 1 },
        { key: "yAxis", required: true, accepts: ["measure"] },
        // KNOWN GAP, deliberately not encoded: when `series`
        // is non-empty the bar renderer derives its series from the DIMENSION and
        // plots `yAxis[0]` only, so extra `yAxis` measures and any
        // `yAxisAssignment` routing go unread. This pack ships no bar `series`, so
        // a combination rule here would be untested speculation — the same stance
        // the multi-query rebuttal takes below. A future widget that populates
        // `series` must extend this table with that rule, deliberately.
        { key: "series", required: false, accepts: ["dimension"] },
      ],
      table: [{ key: "xAxis", required: false, accepts: ["dimension", "timeDimension", "measure"] }],
    };

    // Not every key a renderer reads is a member DROP ZONE. `ChartAxisConfig`
    // (drizzle-cube `client/types.ts`) also carries per-measure axis routing:
    //   yAxisAssignment?: Record<string, 'left' | 'right'>
    // — an OBJECT, read by the axis-resolved renderers (bar/line/area), absent
    // from any `dropZones` list. Treating it as "a key this chart type never
    // reads" would reject legitimate config, so the recognised
    // non-zone keys are enumerated here with the shape each renderer expects.
    type ObjectConfigKey = {
      key: string;
      /** Legal values, checked exactly — the renderer routes on the string. */
      values: string[];
      /**
       * The chart key whose members the OBJECT'S KEYS must come from. Narrower
       * than "any measure the query selects": the renderer looks an assignment
       * up per PLOTTED series, i.e. per member of `chartConfig.yAxis`, so an
       * assignment keyed off a measure that is queried but not plotted is
       * silently ignored. Indirecting through the chart key also
       * keeps this transitively query-checked — `yAxis` itself is validated
       * against the widget's query by the array branch below.
       */
      keysFrom: string;
    };
    const CHART_OBJECT_CONFIG_KEYS: Record<string, ObjectConfigKey[]> = {
      kpiNumber: [],
      bar: [{ key: "yAxisAssignment", values: ["left", "right"], keysFrom: "yAxis" }],
      table: [],
    };

    // The widget set this pack ships, pinned by STABLE id (the identity the host
    // and any later migration key off) plus the chart type each renders with AND
    // the view that comes up first. `activeView` is pinned per widget, not merely
    // constrained to the legal pair: flipping the KPI widget to `"table"` would
    // keep every other assertion green while the KPI card the pack exists to show
    // never renders.
    const SHIPPED_WIDGETS: Record<string, { chartType: string; activeView: "table" | "chart" }> = {
      "wa-runs-kpi": { chartType: "kpiNumber", activeView: "chart" },
      "wa-content-by-type": { chartType: "bar", activeView: "chart" },
      "wa-top-agents": { chartType: "table", activeView: "table" },
      "wa-model-usage": { chartType: "table", activeView: "table" },
    };

    const ANALYSIS_TYPES = ["query", "funnel", "flow", "retention"];

    /** A cube member reference — `<cube>.<member>`, both segments non-empty. A
     *  chart key holding `null`/`""`/`"agent_runs."` resolves to nothing at
     *  render, so "is an array of the right length" is not enough to assert. */
    const MEMBER_REF = /^[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*$/;

    const isPlainObject = (v: unknown): v is Record<string, unknown> =>
      typeof v === "object" && v !== null && !Array.isArray(v);

    /** Every widget, read the way the renderer reads it. Read STRICTLY: each hop
     *  is asserted present and object-shaped rather than defaulted, because a
     *  `?? {}` fallback would turn a MISSING `analysisConfig` / `chartConfig` /
     *  `query` into a silently green contract check. */
    const widgetsWithCharts = () => {
      // EVERY analytics portlet, not just the first: `find` would inspect one and
      // leave a second portlet's widgets entirely unchecked while the exact-set
      // assertion below still matched.
      const analyticsPortlets = config.portlets.filter((p) => p.kind === "analytics");
      expect(analyticsPortlets.length, "no portlet with kind:\"analytics\"").toBeGreaterThan(0);
      const widgets: Array<Record<string, unknown>> = [];
      for (const portlet of analyticsPortlets) {
        const own = portlet.config.dashboard?.portlets as unknown;
        expect(
          Array.isArray(own),
          `analytics portlet ${portlet.instanceId}: config.dashboard.portlets`,
        ).toBe(true);
        widgets.push(...(own as Array<Record<string, unknown>>));
      }
      return widgets.map((w) => {
        const id = String(w.id);
        expect(isPlainObject(w.analysisConfig), `widget ${id}: analysisConfig`).toBe(true);
        const ac = w.analysisConfig as Record<string, unknown>;
        const analysisType = ac.analysisType as string | undefined;
        expect(isPlainObject(ac.charts), `widget ${id}: analysisConfig.charts`).toBe(true);
        const charts = ac.charts as Record<string, unknown>;
        const mode = (analysisType !== undefined ? charts[analysisType] : undefined) as
          | Record<string, unknown>
          | undefined;
        expect(isPlainObject(mode), `widget ${id}: charts.${analysisType}`).toBe(true);
        expect(isPlainObject(mode!.chartConfig), `widget ${id}: charts.${analysisType}.chartConfig`).toBe(true);
        // The pack ships only SINGLE-query widgets. The multi-query form
        // (`{ queries: [...] }`) is deliberately NOT accepted here: eligibility
        // would have to be resolved per sub-query (a chart key drawing its
        // members from two different sub-queries has no coherent result shape),
        // and asserting a rule no shipped widget exercises would be untested
        // speculation. A future multi-query widget must extend this
        // check deliberately rather than inherit a blind union.
        expect(isPlainObject(ac.query), `widget ${id}: analysisConfig.query`).toBe(true);
        expect((ac.query as Record<string, unknown>).queries, `widget ${id}: analysisConfig.query.queries`)
          .toBeUndefined();
        return {
          id,
          version: ac.version,
          analysisType,
          activeView: ac.activeView,
          chartType: mode!.chartType as string | undefined,
          chartConfig: mode!.chartConfig as Record<string, unknown>,
          query: ac.query as Record<string, unknown>,
        };
      });
    };

    /** The members a chart key may legally reference: those the widget's own
     *  query selects, of the member classes that key accepts. */
    const queryMembers = (query: Record<string, unknown>, accepts: AcceptType[]): string[] => {
      const out: string[] = [];
      if (accepts.includes("measure") && Array.isArray(query.measures)) {
        out.push(...(query.measures as string[]));
      }
      if (accepts.includes("dimension") && Array.isArray(query.dimensions)) {
        out.push(...(query.dimensions as string[]));
      }
      if (accepts.includes("timeDimension") && Array.isArray(query.timeDimensions)) {
        for (const td of query.timeDimensions as Array<Record<string, unknown>>) {
          if (typeof td?.dimension === "string") out.push(td.dimension);
        }
      }
      return out;
    };

    it("ships EXACTLY the pinned widget set, each with its pinned chart type + first view", () => {
      // Compared as a PAIR LIST, not an object: `Object.fromEntries` would fold a
      // duplicated widget id into one entry and let an id collision pass — and
      // widget ids are the identity the host and any later migration key off.
      const rendered = widgetsWithCharts().map(
        (w) => [w.id, { chartType: w.chartType, activeView: w.activeView }] as const,
      );
      expect(rendered.map(([id]) => id)).toEqual([...new Set(rendered.map(([id]) => id))]);
      expect(Object.fromEntries(rendered)).toEqual(SHIPPED_WIDGETS);
      expect(rendered.length).toBe(Object.keys(SHIPPED_WIDGETS).length);
    });

    it("declares the analysis discriminator each renderer dispatches on", () => {
      for (const w of widgetsWithCharts()) {
        expect(w.version, `widget ${w.id}: analysisConfig.version`).toBe(1);
        expect(ANALYSIS_TYPES, `widget ${w.id}: analysisConfig.analysisType`).toContain(w.analysisType);
        expect(["table", "chart"], `widget ${w.id}: analysisConfig.activeView`).toContain(w.activeView);
        // `charts[analysisType]` is what the container renders; a chart entry
        // filed under any other mode is never reached.
        expect(w.chartType, `widget ${w.id}: charts.${w.analysisType}.chartType`).toBeTypeOf("string");
        expect(Object.keys(CHART_CONFIG_KEYS), `widget ${w.id}`).toContain(w.chartType);
      }
    });

    it("selects at least one member per widget, every one a well-formed cube reference", () => {
      // Guards a vacuity trap: a widget whose query
      // selected nothing (or selected `null`) would otherwise satisfy every
      // membership assertion below by having nothing to check.
      for (const w of widgetsWithCharts()) {
        const selected = queryMembers(w.query, ["measure", "dimension", "timeDimension"]);
        expect(selected.length, `widget ${w.id}: analysisConfig.query selects no members`).toBeGreaterThan(0);
        for (const member of selected) {
          expect(member, `widget ${w.id}: query member`).toMatch(MEMBER_REF);
        }
      }
    });

    it("fills every key its renderer REQUIRES (an empty one draws a Configuration Error card)", () => {
      for (const w of widgetsWithCharts()) {
        for (const spec of CHART_CONFIG_KEYS[w.chartType!].filter((k) => k.required)) {
          const value = w.chartConfig[spec.key];
          expect(Array.isArray(value), `widget ${w.id}: chartConfig.${spec.key}`).toBe(true);
          expect((value as string[]).length, `widget ${w.id}: chartConfig.${spec.key}`).toBeGreaterThan(0);
          if (spec.maxItems !== undefined) {
            expect((value as string[]).length, `widget ${w.id}: chartConfig.${spec.key}`).toBeLessThanOrEqual(
              spec.maxItems,
            );
          }
        }
      }
    });

    it("parks members ONLY under keys the chart type reads, sourced from the widget's own query", () => {
      for (const w of widgetsWithCharts()) {
        const specs = CHART_CONFIG_KEYS[w.chartType!];
        const objectSpecs = CHART_OBJECT_CONFIG_KEYS[w.chartType!];
        for (const key of Object.keys(w.chartConfig)) {
          const objectSpec = objectSpecs.find((s) => s.key === key);
          if (objectSpec) {
            // A recognised non-drop-zone key (e.g. bar's per-measure
            // `yAxisAssignment`): an OBJECT keyed by the members actually
            // PLOTTED under the chart key it routes, valued from the renderer's
            // exact routing vocabulary.
            const value = w.chartConfig[key];
            expect(isPlainObject(value), `widget ${w.id}: chartConfig.${key}`).toBe(true);
            const routedFrom = w.chartConfig[objectSpec.keysFrom];
            const eligible = Array.isArray(routedFrom) ? (routedFrom as string[]) : [];
            for (const [member, routed] of Object.entries(value as Record<string, unknown>)) {
              expect(member, `widget ${w.id}: chartConfig.${key} key`).toMatch(MEMBER_REF);
              expect(eligible, `widget ${w.id}: chartConfig.${key} key "${member}"`).toContain(member);
              expect(objectSpec.values, `widget ${w.id}: chartConfig.${key}["${member}"]`).toContain(routed);
            }
            continue;
          }
          const spec = specs.find((s) => s.key === key);
          // A key the chart type never reads is dead config: the member parked
          // there is silently dropped at render.
          expect(spec, `widget ${w.id}: chartType "${w.chartType}" reads no "${key}" key`).toBeDefined();
          const eligible = queryMembers(w.query, spec!.accepts);
          const value = w.chartConfig[key];
          expect(Array.isArray(value), `widget ${w.id}: chartConfig.${key}`).toBe(true);
          for (const member of value as string[]) {
            // Typed BEFORE membership: `toContain` would happily match a `null`
            // parked in both the chart key and the query.
            expect(member, `widget ${w.id}: chartConfig.${key} member`).toMatch(MEMBER_REF);
            expect(eligible, `widget ${w.id}: chartConfig.${key} member "${member}"`).toContain(member);
          }
        }
      }
    });
  });
});
