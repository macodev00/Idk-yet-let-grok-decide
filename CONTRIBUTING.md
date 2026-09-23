# Contributing

When Can We is a small static site plus a command-line wrapper. Both use the same time-zone code.

## Setup

You need Node.js 20 or newer. There are no packages to install for the tests.

```sh
node --test
python3 -m http.server 4173
```

Open `http://127.0.0.1:4173/`. The single-file build is `node scripts/build-standalone.js`, which writes `dist/whencanwe.html`.

## Time zones

Changes to `src/time.js`, `src/overlap.js`, or `src/codec.js` need tests. Use fixed dates and named IANA zones. Do not assert against the machine’s local zone.

A 60-minute cell counts only when a person is inside their hours for the whole step. Overnight windows such as 22:00–06:00 belong to the day the shift starts. The missing hour on a spring-forward day is skipped. The repeated hour on a fall-back day is shown once.

## Dependencies

Do not add a network call, a font host, an analytics script, or a build tool that the page needs in order to run. The hosted page is plain HTML, CSS, and JavaScript. The standalone file must keep working offline.

## Conduct

See `CODE_OF_CONDUCT.md`.
