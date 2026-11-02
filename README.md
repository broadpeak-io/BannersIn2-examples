# BannersIn2 examples

Use-case examples for the [Broadpeak SIMID controller](https://github.com/Broadpeak-tv/simid-controller), for web, Android and iOS.

## Examples

Not every example exists on every platform.

| Use case | Web | Android | iOS |
| --- | --- | --- | --- |
| [Pause ads](examples/pause-ads) | [available](examples/pause-ads/web) | planned | planned |

## Layout and conventions

Each use case lives in `examples/<use-case>/<platform>/` (`web`, `android`, `ios`).

**Every example is self-contained.** It pins its own versions of every third-party component (player, SmartLib, SIMID controller), so examples can move forward independently. There is no shared workspace and no repo-level submodule.

- **Web:** a normal npm project. Player and SmartLib versions are in its `package.json` and lockfile. The SIMID controller is not published as a package, so its git ref is pinned in `controller.json`; `npm run setup` (run automatically by `npm start` and `npm run build`) fetches and builds it from [its own repository](https://github.com/Broadpeak-tv/simid-controller) into a git-ignored `.deps/` folder.
- **Android / iOS:** to be defined with the first example on each platform. The same rule applies: pin the controller version inside the example.

**Stream URLs are never committed.** Examples take a stream URL at runtime, and each one links to a playbook on [developers.broadpeak.io](https://developers.broadpeak.io/docs/introduction) explaining how to configure a service. CI runs `node scripts/check-urls.mjs` to enforce this; legitimate non-stream URLs that trip it go in [`.url-allowlist`](.url-allowlist).

**Branding is optional.** Web examples share one look (masthead, hero, status banner, event log) kept in a `src/branding/` folder, separate from the player code in `src/player/`. Each example documents how to run full-frame or remove the branding.
