<p align="center">
  <img src="electron/build/icon.png" width="96" height="96" alt="Looper icon">
</p>

# Looper

Looper is an open-source notebook calculator for Mac and Windows. Write calculations in a natural, readable sheet, use the magic word `loop` to see how values change over time, and keep the result as a local `.loop` file you control.

[Download Looper](https://looper.app/download) · [Report an issue](https://github.com/rorourke/looper/issues)

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/looper-library-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="docs/screenshots/looper-library-light.png">
    <img src="docs/screenshots/looper-library-light.png" width="1200" alt="Looper's sheet library showing example calculations and planning templates">
  </picture>
</p>

<p align="center">
  <img src="docs/screenshots/looper-compound-interest.png" width="1200" alt="Looper's Compound Interest template showing balances and annual interest over time">
</p>

## Development

Prerequisites: Node.js 20.9 or newer and pnpm 11.9.

Run the Electron app:

```sh
cd electron
pnpm install
pnpm dev
```

Run the website:

```sh
cd web
pnpm install
pnpm dev
```

Run `pnpm test` or `pnpm build` from either directory to test or build that project. On macOS, `./script/build_and_run.sh` builds, packages, and opens the Electron app.

## Contributing

To contribute, submit a pull request.

## Author

Created by Ryan O'Rourke.

## License

Looper is available under the [MIT License](LICENSE).
