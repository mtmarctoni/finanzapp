/**
 * Feature folders under `components/` are independent slices. They may share
 * code ONLY through the shared layers (`components/ui`, `hooks/`, `lib/`,
 * `config/`, `types/`) — never by importing each other. That is what prevents
 * accidental cross-feature coupling and duplicated helper functions.
 *
 * Generated per-feature so the `from`/`to` regexes stay simple (no look-behind,
 * which dependency-cruiser's ReDoS-protected regex engine rejects).
 */
const COMPONENT_FEATURES = [
  'ai',
  'analytics',
  'context',
  'crypto',
  'recurring',
];

const featureIsolationRules = COMPONENT_FEATURES.map((feature) => ({
  name: `no-cross-import-from-${feature}`,
  severity: 'error',
  comment:
    `Feature "${feature}" must not import from other feature folders. ` +
    'Move shared logic into the shared layers (`components/ui`, `hooks/`, ' +
    '`lib/`, `config/`, `types/`).',
  from: {
    path: `^components/${feature}/`,
  },
  to: {
    path: `^components/(${COMPONENT_FEATURES.filter((f) => f !== feature).join('|')})/`,
  },
}));

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    /* ------------------------------------------------------------------ *
     * 1. Structural integrity
     * ------------------------------------------------------------------ */

    // Cyclic dependencies are the single biggest source of subtle
    // runtime bugs and import-time deadlocks. ESLint's `import-x/no-cycle`
    // only catches obvious cases; this rule sees the full module graph.
    {
      name: 'no-circular',
      severity: 'error',
      comment:
        'Circular dependencies make modules hard to reason about, test, and ' +
        'can cause subtle initialization-order bugs. Break the cycle.',
      from: {},
      to: {
        circular: true,
      },
    },

    // Orphan modules that nothing imports are dead code. (Still emitted as
    // 'info', not an error, so entry points / intentionally-unused libs are
    // not falsely flagged.)
    {
      name: 'no-orphans',
      severity: 'info',
      comment:
        'This module is never imported anywhere. If it is intentional (a CLI ' +
        'script or test bootstrap), add it to `options.doNotFollow` or scope ' +
        'the rule; otherwise it is dead code.',
      from: {
        orphan: true,
        pathNot: [
          '\\.d\\.ts$',
          '\\.test\\.ts$',
          '\\.test\\.tsx$',
          '\\.spec\\.ts$',
          '^scripts/',
          '^db/',
          '^docs/',
          '^__tests__/',
          '^e2e/',
          // Everything under `app/` is a Next.js entrypoint (page.tsx,
          // layout.tsx, route.ts, loading.tsx, error.tsx, ...). These are
          // auto-registered by the framework and never imported by siblings,
          // so orphan detection there is always noise.
          '^app/',
          '^\\.dependency-cruiser\\.js$',
        ],
      },
      to: {},
    },

    /* ------------------------------------------------------------------ *
     * 2. Client / Server boundary (the critical Next.js safety rule)
     *
     * In an App Router project "server-only" modules must never end up in
     * the browser bundle. Client code reaching straight into the DB layer
     * would leak connection pooling, session scoping, or API secrets into
     * the client bundle. All client->data traffic must go through the
     * `use server` action boundary (`lib/actions.ts` and friends).
     *
     * The rule below is fail-closed: client-oriented code (`components/`,
     * `hooks/`, and the client-side fetch wrappers `lib/data.ts` /
     * `lib/crypto-data.ts`) may import NOTHING from `lib/` except the
     * explicitly allow-listed safe modules. Server components (app page.tsx
     * files and API route.ts handlers) are intentionally excluded from the
     * rule - they run server-side and are the correct place to query the DB
     * via repos/server-data.
     * ------------------------------------------------------------------ */
    {
      name: 'no-server-side-code-in-client-boundary',
      severity: 'error',
      comment:
        'Client-oriented code must not import server-only modules. The default ' +
        'state of `lib/` is "server-trusted": only the explicitly allow-listed ' +
        'modules below (pure helpers, client fetch wrappers, the server-action ' +
        'boundary) are safe for the browser bundle. Everything else in `lib/` ' +
        '(db pool, server-data, repositories, API-key/auth internals, AI tool ' +
        'runners) is off-limits. Reach those via `lib/actions.ts` / ' +
        '`lib/*Actions.ts` instead.',
      from: {
        path: [
          '^components/',
          '^hooks/',
          '^lib/data\\.ts$',
          '^lib/crypto-data\\.ts$',
        ],
      },
      to: {
        // Fail closed: forbid ALL of `lib/` except the safe allow-list.
        path: '^lib/',
        pathNot: [
          // Pure, isomorphic helpers safe for any bundle.
          '^lib/utils\\.ts$',
          '^lib/logger\\.ts$',
          '^lib/analytics-charts\\.ts$',
          '^lib/categories\\.ts$',
          '^lib/crypto/price-input\\.ts$',
          // Typedefs re-exported from types/.
          '^lib/definitions\\.ts$',
          // Client-side fetch wrappers (talk to /api/*).
          '^lib/data\\.ts$',
          '^lib/crypto-data\\.ts$',
          // The server-action boundary (intentionally callable from the client).
          '^lib/actions\\.ts$',
          '^lib/recurringActions\\.ts$',
          '^lib/cryptoActions\\.ts$',
        ],
      },
    },

    // The repository / DB layer must not depend on UI, pages, or config.
    // It is the bottom of the data stack.
    {
      name: 'no-data-layer-does-not-depend-on-ui',
      severity: 'error',
      comment:
        'The data layer (db, repos, server-data, actions) must never import ' +
        'from `app/`, `components/` or `hooks/`. Keep infrastructure ' +
        'independent so it stays framework-agnostic and trivially testable.',
      from: {
        path: '^lib/',
      },
      to: {
        path: ['^app/', '^components/', '^hooks/'],
      },
    },

    // `app/` is the composition root. Nothing below it (components, hooks,
    // lib, config, types) may reach up into pages, layouts, or API routes.
    // If lower layers "need" something from `app/`, it belongs in a lower
    // layer instead.
    {
      name: 'no-app-imported-from-below',
      severity: 'error',
      comment:
        '`app/` is the composition root. Only code inside `app/` may import ' +
        'from `app/`. Anything a lower layer needs belongs in components, ' +
        'hooks, lib, config, or types.',
      from: {
        pathNot: [
          '^app/',
          '^__tests__/',
          '^e2e/',
          '\\.test\\.tsx?$',
          '\\.spec\\.tsx?$',
        ],
      },
      to: {
        path: '^app/',
      },
    },

    // API route handlers are pure backend: they run server-side, receive
    // HTTP requests, and talk to the data layer directly. They must never
    // bootstrap as if they were a UI page (importing components/hooks) and
    // never call the client-side fetch wrappers (which would make them
    // re-enter the app over HTTP instead of using the repos available to
    // them server-side).
    {
      name: 'no-api-routes-depend-on-ui-or-client-data',
      severity: 'error',
      comment:
        '`app/api/**` route handlers are backend-only. They must not import ' +
        'UI (`components/`, `hooks/`) or the client fetch wrappers ' +
        '(`lib/data.ts` / `lib/crypto-data.ts`). Prefer `lib/server-data.ts`, ' +
        'repos, and server actions.',
      from: {
        path: '^app/api/',
      },
      to: {
        path: [
          '^components/',
          '^hooks/',
          '^lib/data\\.ts$',
          '^lib/crypto-data\\.ts$',
        ],
      },
    },

    // None-----------------------------------------------------------------
    // Server-side `lib/` modules must not use the client fetch wrappers.
    // Server modules have direct access to the repos and DB pool; importing
    // `lib/data.ts`/`lib/crypto-data.ts` would round-trip through HTTP to
    // the app's own API, duplicating the data-access path.
    {
      name: 'no-server-lib-imports-client-data',
      severity: 'error',
      comment:
        'Server-side `lib/` modules must not import the client fetch ' +
        'wrappers. They already run with direct access to repos and the DB; ' +
        'a fetch through `/api/...` would duplicate the data path and add a ' +
        'pointless HTTP round-trip.',
      from: {
        path: '^lib/',
      },
      to: {
        path: ['^lib/data\\.ts$', '^lib/crypto-data\\.ts$'],
      },
    },

    /* ------------------------------------------------------------------ *
     * 3. Layering / architecture
     * ------------------------------------------------------------------ */

    // `config/` and `types/` are leaf modules. Nothing should place
    // business logic under these, and they should never reach back into
    // the rest of the source tree.
    {
      name: 'no-leaf-modules-import-internals',
      severity: 'error',
      comment:
        '`config/` and `types/` are leaf modules. They must not import from ' +
        'app, components, or lib.',
      from: {
        path: '^(config|types)/',
      },
      to: {
        path: '^(app|components|lib)/',
      },
    },

    // `lib/utils.ts` is a dependency-free pure-helper module; keep it that
    // way so every layer can safely use it.
    {
      name: 'no-utils-imports-internals',
      severity: 'error',
      comment:
        '`lib/utils.ts` is the shared pure-utility module. It must remain ' +
        'dependency-free so any layer can import it.',
      from: {
        path: '^lib/utils\\.ts$',
      },
      to: {
        pathNot: '^(node_modules|types/)',
      },
    },

    // `components/ui/` are presentation primitives. They should only depend
    // on UI peers, styling helpers and the leaf modules — never on feature
    // components, app pages, or the data layer.
    {
      name: 'no-ui-primitives-depend-on-features',
      severity: 'error',
      comment:
        'UI primitives in `components/ui/` must stay presentation-only. ' +
        'They may only import other ui components, `@/lib/utils`, `@/config` ' +
        'and types.',
      from: {
        path: '^components/ui/',
      },
      to: {
        path: [
          '^components/(?!ui/)',
          '^app/',
          '^lib/(?!utils\\.ts$|data\\.ts$|crypto-data\\.ts$)',
        ],
      },
    },

    // UI primitives must not depend on hooks, with a single sanctioned
    // exception: `components/ui/toaster.tsx` bridges shadcn-style `use-toast`.
    // That keeps hooks out of the presentation layer while acknowledging the
    // toast wiring seam.
    {
      name: 'no-ui-primitives-depend-on-hooks',
      severity: 'error',
      comment:
        'UI primitives in `components/ui/` must not import `hooks/`. The ' +
        'only exception is `components/ui/toaster.tsx` -> `@/hooks/use-toast`, ' +
        'which is the toast wiring seam.',
      from: {
        path: '^components/ui/',
      },
      to: {
        path: '^hooks/',
        pathNot: '^hooks/(use-toast|use-toaster)\\.ts$',
      },
    },

    // Hooks are client-side logic. They may use UI types, the client-safe
    // `lib/` surface, config, and types — but they must not import feature
    // components or app code.
    {
      name: 'no-hooks-depend-on-features-or-app',
      severity: 'error',
      comment:
        '`hooks/` must stay logic-only. They may import UI **types** from ' +
        '`components/ui/`, the client-safe `lib/` surface, `config/`, and ' +
        '`types/` — never feature components or `app/` code.',
      from: {
        path: '^hooks/',
      },
      to: {
        path: ['^app/', '^components/(?!ui/)'],
      },
    },

    // Feature folders under `components/` are independent slices.
    ...featureIsolationRules,

    /* ------------------------------------------------------------------ *
     * 4. Hygiene / quality
     * ------------------------------------------------------------------ */

    // Importing test utilities or fixtures into production code masks real
    // coupling and accidentally ships test helpers.
    {
      name: 'no-tests-in-production',
      severity: 'error',
      comment: 'Production modules must not depend on test code.',
      from: {
        pathNot: [
          '^__tests__/',
          '^e2e/',
          '\\.test\\.tsx?$',
          '\\.spec\\.tsx?$',
          '^scripts/',
        ],
      },
      to: {
        path: ['^__tests__/', '^e2e/'],
      },
    },
  ],

  options: {
    // Where to look for modules. Everything under the repo root is
    // analysed, except the noise we call out below.
    doNotFollow: {
      // Follow node_modules for external->internal edges, but do not comb
      // through the dependency source of every package.
      path: ['node_modules'],
    },

    // Files we never want to see reported as isolated dead code:
    // config files, tests, DB migrations, generated/build output and docs.
    exclude: {
      path: [
        '^\\.github/',
        '^\\.next/',
        '^node_modules/',
        '^public/',
        '^docs/',
        '^assessment/',
        '^coverage/',
        '^playwright-report/',
        '^test-results/',
        '\\.config\\.(js|mjs|cjs|ts)$',
        '\\.d\\.ts$',
      ],
    },

    // Enable TypeScript path-alias support: `@/...` imports are resolved to
    // repo-root-relative paths through tsconfig "paths", so the `from`/`to`
    // path patterns above match the aliased imports in the source.
    tsConfig: {
      fileName: 'tsconfig.json',
    },

    tsPreCompilationDeps: true,

    moduleSystems: ['es6', 'cjs'],

    enhancedResolveOptions: {
      exportsFields: ['exports'],
    },

    // Summarised output is the human-friendly default for `pnpm depcruise`.
    reporterOptions: {
      dot: {
        collapsePattern: 'node_modules/[^/]+',
      },
      archi: {
        collapsePattern:
          '^(node_modules|packages|src|lib|app|components|config|types)/[^/]+',
      },
      text: {
        highlightFocused: true,
      },
    },
  },
};
