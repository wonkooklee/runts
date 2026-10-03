# Contributing to RunTS

Thanks for your interest in improving RunTS. Bug reports, feature ideas, and pull requests are all welcome.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Reporting bugs and requesting features

Search [existing issues](https://github.com/wonkooklee/runts/issues) first, then open a new one with the matching template. For bugs, include the code you ran, what you expected, what RunTS showed, and your macOS version and Mac model (Apple Silicon or Intel).

Please report security problems privately as described in [SECURITY.md](SECURITY.md), not in a public issue.

## Development setup

You need macOS, Node.js 22, and Yarn 4.

```bash
git clone https://github.com/wonkooklee/runts.git
cd runts
yarn
yarn dev
```

`yarn dev` bundles the renderer with esbuild and starts Electron. Changes under `src/main` take effect after restarting the app; changes under `src/renderer` need `yarn build:renderer` and a restart.

## Project layout

| Path | Purpose |
|---|---|
| `src/main/transform.js` | Instruments code with line numbers using the TypeScript compiler |
| `src/main/worker.js` | Executes instrumented code in a utility process and reports output |
| `src/main/runner.js` | Starts and stops worker processes and batches output |
| `src/main/packages.js` | Installs npm packages and collects their type definitions |
| `src/main/main.js` | Window, IPC, and file handling |
| `src/renderer/` | Editor, output pane, tabs, and dialogs |
| `build/` | App icon source and packaging resources |

## Making changes

1. Create a branch from `main`.
2. Keep each commit focused on one change, and write commit messages in the [Conventional Commits](https://www.conventionalcommits.org) style, for example `fix: keep output aligned after clearing`.
3. Run `yarn test` and check the change in the running app with `yarn dev`.
4. Open a pull request describing what changed and how you verified it. Screenshots help for UI changes.

Prefer clear names and small functions over explanatory comments, and match the style of the surrounding code.

## Building a release

```bash
yarn dist
```

This produces `release/RunTS-<version>-arm64.dmg` and `release/RunTS-<version>-x64.dmg`. Builds are ad-hoc signed and not notarized.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
