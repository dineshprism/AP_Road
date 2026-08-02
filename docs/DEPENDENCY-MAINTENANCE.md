# Dependency maintenance notes

Use the repository helper to list packages that npm marks as deprecated in the committed lockfiles:

```sh
node tools/check-deprecated-deps.mjs
```

The Docker build warnings distinguish two cases:

1. **Direct dependency cleanup**: remove packages that the application declares directly and no longer needs. The backend no longer declares `@types/express-rate-limit` because `express-rate-limit` ships its own types.
2. **Transitive dependency cleanup**: warnings for packages below another library need an upstream package upgrade or a replacement library. At the time of this check, the remaining deprecated packages are transitive entries from the frontend Tailwind/Sucrase chain and backend ExcelJS archive/fetch chains.

For the `npm outdated` output, prefer patch/minor updates within the existing major first. Treat the `Latest` column major-version jumps as migration work because they can require code changes, for example React 18 to 19, Express 4 to 5, React Router 6 to 7, Tailwind 3 to 4, Zod 3 to 4, and TypeScript 5 to 7.
