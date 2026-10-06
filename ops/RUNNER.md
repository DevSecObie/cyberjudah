# The agents' runner: browser tests and shared capacity

Every seat in `TEAM.md` runs on one shared Linux host. The host has no root, no
unprivileged user namespaces, and one set of limits for all seats together. That is
enough to run the app's full Playwright suite in all three engines, but only if a seat
uses the shared environment below instead of rebuilding it or declaring the runner
blocked.

Last verified 5 October 2026, for the audio work on cyberjudah-telegram.

## 1. How to run a browser suite

```sh
cd app
bash /data/.cache/playwright-sysdeps/run.sh npx playwright test --project=webkit
```

`run.sh` sources the environment, pins the suite to two CPUs, and refuses to start
when the host has no room (see §4). To get the environment without the guards:

```sh
. /data/.cache/playwright-sysdeps/env.sh
```

If `/data/.cache` is ever cleared, rebuild the whole prefix — it is idempotent and
takes a few minutes and about 1.1 GB:

```sh
bash /data/.cache/playwright-sysdeps/setup.sh
```

Browsers come from `npx playwright install`. Never `npx playwright install --with-deps`:
it shells out to `su` and fails, and the system packages it wants are already in the
prefix.

## 2. Why the prefix exists

`apt-get install` and `playwright install-deps` need root, which no seat has. They are
not needed: Debian trixie carries every package Playwright asks for, `apt-get update`
and `--print-uris` work as an ordinary user when pointed at a writable lists and cache
directory, and `dpkg -x` unpacks the archives into a prefix on `LD_LIBRARY_PATH`. All
86 packages are in `/data/.cache/playwright-sysdeps/prefix`.

Before reporting that a browser test cannot run here, read this file and try `run.sh`.

## 3. The four settings that are not obvious

Each one was a day's debugging. They are in `env.sh` with the same notes.

- **TLS in WebKit.** WebKit's network process gets TLS from GIO, which looks for its
  modules at a compiled-in `/usr/lib/x86_64-linux-gnu/gio/modules` that does not exist
  here. Every `https://` request fails with `TLS support is not available`.
  `GIO_MODULE_DIR` must point at `/data/.cache/playwright-sysdeps/gio-tls-modules`,
  which holds exactly one module: glib-networking's gnutls backend. It must **not**
  point at the prefix's own `gio/modules`, because `libgiognomeproxy.so` in there makes
  every WebKit network request fail with `WebKit encountered an internal error`
  (bisected: `libgiolibproxy.so` and `libdconfsettings.so` are harmless). Certificate
  verification is unaffected — `https://expired.badssl.com/` is still refused with
  `Unacceptable TLS certificate`, and that is the check to re-run if anyone touches
  this. Never set `ignoreHTTPSErrors`, add a proxy, or install a certificate to get a
  suite green.
- **Fonts.** The prefix's own `fonts.conf` lists `/usr/share/fonts`, which does not
  exist here, so fontconfig finds no font at all and text renders blank.
  `FONTCONFIG_FILE` must point at `/data/.cache/playwright-sysdeps/fonts.conf`, which
  lists the prefix's font directories and a writable cache directory.
- **Software rendering.** WebKit aborts on "Could not create EGL display" without
  `__EGL_VENDOR_LIBRARY_DIRS`, `LIBGL_DRIVERS_PATH` and `LIBGL_ALWAYS_SOFTWARE`.
- **The WebKit bundle's own library path.** WebKit's `MiniBrowser` launcher overwrites
  `LD_LIBRARY_PATH`, so `setup.sh` symlinks the prefix's libraries into each bundle's
  `sys/lib`. Re-run `setup.sh` after installing a new browser build.

Chromium needs no `--no-sandbox`. No seat may disable a browser sandbox to make a test
pass.

## 4. One host, shared by every seat

This is the part that looks like flaky tests and is not.

| What is shared | Limit |
|---|---|
| Processes and threads | `pids.max` 512 for all seats together |
| Memory | `memory.max` 4 GiB for all seats together, with swap |
| CPUs reported | 64, so any tool sizing a thread pool from the CPU count eats the task limit |
| User id | the same uid for every seat |
| Loopback | one `127.0.0.1`, so ports collide between seats |

Consequences a seat will meet:

- **Thread exhaustion looks like anything but itself.** At 446 of 512 tasks, unrelated
  work fails: a Paperclip API call died in `getaddrinfo` thread allocation, and `git`
  packing needed `pack.threads=1`. Keep Playwright at `workers: 1` and run under
  `run.sh`, which pins to two CPUs so the browsers, workerd and llvmpipe size their
  pools from 2 rather than 64.
- **Memory pressure is normal and swap is in use.** 4 GiB is near fully committed with
  several seats awake. Processes are slow rather than killed, and a slow browser fails
  as `Target page, context or browser has been closed`.
- **Two seats cannot run `app`'s e2e suite at once.** It uses fixed ports: 8787 the
  local Worker, 8791 the network stand-ins, 9229 wrangler's inspector. Worse,
  `app/playwright.config.ts` sets `reuseExistingServer: !process.env.CI`, so the second
  suite does not error — it silently drives the first seat's Worker, with that seat's
  storage, stand-ins and clock. `run.sh` checks all three ports and the task headroom
  and exits 75 (retry later, not a test failure) rather than start. Wait, or run the
  engines in one invocation (`--project=webkit --project=firefox`) so one Worker serves
  both.
- **Identify the holder before assuming it is your own leftovers.** A listener's owner
  is in `/proc/net/tcp`, and `/proc/<pid>/cmdline` names the run: a workerd under
  `paperclip-run-cyb-NNN-*` is that issue's run, not yours. Never kill another seat's
  process.

## 5. What this runner cannot do

Report these plainly rather than working around them.

- **No unprivileged user namespaces** (`/proc/sys/user/max_user_namespaces` is 0), so
  anything needing its own network or pid namespace is out, and Firefox logs an EPERM
  namespace warning at startup.
- **No physical Telegram client.** The suite signs its own launch data against the local
  Worker's own test bot token, which is how the Worker's real `initData` check gets
  exercised. Verification needing a real phone stays with the owner.
- **No root**, so no system package, no certificate store change, no sysctl.

A seat that hits a wall here says so in its issue and names what the owner would have
to change. It does not skip, quarantine or weaken a test, and it does not turn off a
sandbox or a certificate check.

## 6. Disk: one copy of each repository

`/data` is 27 GB for every seat together. On 6 October it reached 93% because nine
seats each held a full clone of cyberjudah (835 MB of history and 850 MB of files
apiece) and nothing removed a checkout once its work was pushed. These rules keep it
from happening again. The tool is `ops/bin/ws.sh`, installed at `/data/git/ws.sh`.

**One copy of the history.** `/data/git/cyberjudah.git` and
`/data/git/cyberjudah-telegram.git` hold each repository's history once. Every
checkout on the host borrows its objects from there instead of keeping its own, so a
checkout costs only its files. The stores are marked precious: git refuses to prune or
repack them, because every checkout depends on them. Never delete, move, `gc` or
`repack` anything under `/data/git`.

**Getting a checkout.** Use the one your workspace already has; switch branches in it.
When you truly need a second repository beside it (the Timeline researchers and the
engineers need cyberjudah next to cyberjudah-telegram):

```sh
bash /data/git/ws.sh clone cyberjudah ../cyberjudah
```

Never `gh repo clone` or `git clone` either repository on this host. A worktree off
your own checkout (`git worktree add`) is fine for a second branch at once.

**Cleaning up after yourself, before you end the run.** When your branch is pushed
and its PR is open, remove whatever you made beyond your workspace's own checkout —
an extra clone, a worktree:

```sh
bash /data/git/ws.sh done ../cyberjudah
```

`done` deletes only when everything in the directory is on GitHub. It checks against a
fresh fetch, not the checkout's own remote-tracking refs, which can be stale. If
anything is uncommitted, unpushed, stashed or half-merged it keeps the directory,
lists what is missing, and exits 3: push it or commit it, then run `done` again. Also
delete build output you made (`dist/`, coverage, Playwright reports) once you have
reported from it. Leave `node_modules` and `tindex.pkl`: they are rebuilt on the next
run, and the nightly sweep clears them when they go idle.

**Never remove another seat's directory**, and never `rm -rf` a checkout; `done` and
the sweep are the only ways a checkout leaves this host.

**The nightly sweep.** The Release manager's 02:30 sweep runs
`bash /data/git/ws.sh sweep`. For every checkout under
`/data/instances/default/workspaces` it borrows the store's objects (freeing the
checkout's own copy). For a checkout idle three days, it removes the checkout if
everything in it is on GitHub, or else removes only its `node_modules`. The
Paperclip-managed checkouts listed in `/data/git/keep` are never removed. The sweep
ends with `ws.sh report`: disk use, then every checkout's size, idle days and what
keeps it. A `DISK WARNING` line (85% or more) goes to the CEO, and the CEO puts it in
the daily report.

`bash /data/git/ws.sh report` is read-only; any seat may run it.
