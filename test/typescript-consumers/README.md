# TypeScript consumer projects

TypeScript 7 projects that use the published package the way users do: a `serverless.ts`
service configuration and a plugin, type checked against `dist/` with `strict` on and
`skipLibCheck` off, with only the runtime dependencies of osls installed.

- `esm`: ES module project, `module: nodenext`
- `cjs`: CommonJS project, `module: nodenext`
- `bundler`: `module: preserve`, `moduleResolution: bundler`

`scripts/check-typescript-consumers.ts` runs them (after `pnpm run build`). It also type checks
every published declaration file from each project. `@ts-expect-error` lines guard against
public types silently degrading to `any`.
