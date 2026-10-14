# Next lint directory lookup

This private development-only adapter replaces the `fast-glob` dependency of
`@next/eslint-plugin-next@16.3.8`. The pinned plugin only calls
`globSync(pattern, { onlyDirectories: true })` in `getRootDirs`.

The original dependency pulled in `braces`, affected by
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), with
no published patched version on 2026-10-14. The adapter actually removes that
implementation, rather than changing its version label or filtering the audit.
Glob matching uses [tinyglobby](https://github.com/SuperchupuDev/tinyglobby) 0.2.17.

Compatibility details:

- Directory expansion is disabled to preserve fast-glob's root matching.
- Literal directories are checked directly, including the current working
  directory, which tinyglobby otherwise normalizes to an empty pattern.
- Unsupported call shapes throw rather than silently skipping lint rules.
- The override is scoped to the pinned Next plugin version. Review it when
  upgrading Next; this is not a general replacement for all fast-glob APIs.
- `tests/lint-dependencies.test.cjs` checks dependency removal, literal/glob/array
  roots, missing paths, file exclusion and actual Next lint rule findings.
- The root development dependency and `$fast-glob` override intentionally share
  one local package resolution. `npm ci` must pass on both Windows and Linux.

Keep the existing Next/React/TypeScript lint rules and full `npm audit` check.
Remove this override once a compatible upstream dependency chain is fixed.
