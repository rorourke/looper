# Contributing to Looper

Thanks for helping make Looper better.

## Before you start

- Search existing issues before opening a new one.
- For a substantial feature or user-interface change, open an issue first so the product direction and scope can be discussed before implementation.
- Do not include private `.loop` files, credentials, signing material, customer data, or generated build output in a contribution.
- Report security issues privately as described in [SECURITY.md](SECURITY.md).

## Development workflow

1. Fork the repository and create a focused branch.
2. Install dependencies in the surface you are changing (`electron/` or `web/`).
3. Make the smallest coherent change and add tests for behavior that can regress.
4. Run the relevant tests, typecheck, and production build.
5. Describe the user-visible effect, validation performed, and any platform limitations in the pull request.

All changes to the release branch go through pull requests. Maintainers review each proposal and decide whether and when it should be merged; contributors do not need direct repository access.

Electron checks:

```sh
cd electron
pnpm test
pnpm typecheck
pnpm build
```

Web checks:

```sh
cd web
pnpm test
pnpm typecheck
pnpm build
```

Please preserve Looper’s local-first contract: ordinary sheets must remain understandable, portable `.loop` files; bundled templates must remain read-only until duplicated; and public builds must not expose internal debug tools.

By contributing, you agree that your contribution is licensed under the repository’s MIT License.
