# Running Looper

From the repository root, run:

```bash
./script/build_and_run.sh
```

That builds the Electron app, packages a real `Looper.app`, and opens it.

To make a stable Dock version:

```bash
./script/build_and_run.sh --install
```

That copies the app to `~/Applications/Looper.app` and opens it. Once it is open, right-click the Looper icon in the Dock and choose **Options > Keep in Dock**.

Useful extras:

```bash
./script/build_and_run.sh --verify
./script/build_and_run.sh --dev
```

The packaged app is also left under `electron/release/`.
