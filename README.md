# BannersIn2 examples

Use-case examples for the [Broadpeak SIMID controller](https://github.com/Broadpeak-tv/simid-controller), for web, Android and iOS.

The controller has no published package yet, so it is included as a git submodule (`simid-controller/`) and each example references it locally.

## Getting started

```sh
git clone --recurse-submodules https://github.com/broadpeak-io/BannersIn2-examples.git
# or, if already cloned:
git submodule update --init
```

To move to a newer controller version:

```sh
git -C simid-controller fetch && git -C simid-controller checkout <tag-or-commit>
git add simid-controller && git commit -m "Bump simid-controller"
```

## Examples

Not every example exists on every platform.

| Use case | Web | Android | iOS |
|---|---|---|---|
| [Custom ad UI](examples/custom-ad-ui) | planned | planned | planned |
| [Interactive creative](examples/interactive-creative) | planned | planned | planned |
| [Custom component](examples/custom-component) | planned | planned | planned |

## Layout and conventions

Each use case lives in `examples/<use-case>/<platform>/` (`web`, `android`, `ios`) and links to the controller as follows:

- **Web:** `"@broadpeak-tv/simid-controller": "file:../../../simid-controller/web/controller"` (build the controller first with `npm install && npm run build` in `simid-controller/web/controller`).
- **Android:** `includeBuild("<relative path>/simid-controller/android")` in `settings.gradle.kts`, then depend on the `controller` module.
- **iOS:** reference `simid-controller/ios/SimidController/SimidController.xcodeproj` from the example's Xcode project or workspace.
