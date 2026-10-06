#!/usr/bin/env bash
# One copy of each repository on the agents' host, shared by every seat.
# Why and how to use it: ops/RUNNER.md §6.
#
#   ws.sh setup                  create the shared stores in $CJ_GIT_STORE (once, idempotent)
#   ws.sh fetch                  bring both stores up to date with GitHub
#   ws.sh clone <repo> <dir>     a new checkout that borrows the store's objects
#   ws.sh attach <checkout>      make an existing checkout borrow the store (frees its copy)
#   ws.sh done <dir>             remove a checkout or worktree you made, only if nothing is lost
#   ws.sh report                 disk use and every checkout's state (read-only)
#   ws.sh sweep                  nightly: attach, drop stale node_modules, remove stale safe checkouts
#
# <repo> is cyberjudah or cyberjudah-telegram. Nothing here deletes work that is
# not on GitHub: a dirty, unpushed, stashed or half-merged checkout is always kept.
set -euo pipefail

STORE=${CJ_GIT_STORE:-/data/git}
WORKSPACES=${CJ_WORKSPACES:-/data/instances/default/workspaces}
REMOTE=${CJ_REMOTE_BASE:-https://github.com/DevSecObie}
STALE_DAYS=${CJ_STALE_DAYS:-3}
DISK_WARN=${CJ_DISK_WARN:-85}
REPOS="cyberjudah cyberjudah-telegram"
export GIT_TERMINAL_PROMPT=0

die() { echo "ws: $*" >&2; exit 1; }
say() { echo "ws: $*" >&2; }

# git with the run's GitHub token as the credential when one is in the
# environment. The token is read by the helper at call time and never printed.
g() {
  if [ -n "${GH_TOKEN:-${GITHUB_TOKEN:-}}" ]; then
    git -c credential.helper= \
        -c 'credential.helper=!f() { echo username=x-access-token; echo "password=${GH_TOKEN:-$GITHUB_TOKEN}"; }; f' "$@"
  else
    git "$@"
  fi
}

mtime() { stat -c %Y "$1" 2>/dev/null || stat -f %m "$1" 2>/dev/null || echo 0; }
abspath() { (cd "$1" && pwd -P); }
store_of() { echo "$STORE/$1.git"; }

check_repo() {
  case "$1" in cyberjudah|cyberjudah-telegram) ;; *) die "repo must be cyberjudah or cyberjudah-telegram, not '$1'" ;; esac
}

# Which repository a checkout is, from its origin URL (never printed: it may carry a token).
repo_of() {
  local url
  url=$(git -C "$1" remote get-url origin 2>/dev/null) || return 1
  url=${url%/}; url=${url%.git}; url=${url##*/}
  case "$url" in cyberjudah|cyberjudah-telegram) echo "$url" ;; *) return 1 ;; esac
}

common_dir() { (cd "$1" && cd "$(git rev-parse --git-common-dir)" && pwd -P); }
git_dir() { (cd "$1" && cd "$(git rev-parse --git-dir)" && pwd -P); }

with_lock() {
  local lock=$1; shift
  if command -v flock >/dev/null 2>&1; then
    ( flock -w 600 9 || exit 1; "$@" ) 9>"$lock"
  else
    "$@"
  fi
}

fetch_one() {
  local s; s=$(store_of "$1")
  [ -d "$s" ] || die "no store at $s; run: ws.sh setup"
  with_lock "$s/ws.lock" g -C "$s" fetch --quiet --prune origin \
    || say "could not fetch $1; the store is unchanged and still usable"
}

cmd_setup() {
  mkdir -p "$STORE"
  local r s
  for r in $REPOS; do
    s=$(store_of "$r")
    if [ ! -d "$s" ]; then
      say "creating $s (one full copy; every checkout borrows from it)"
      g clone --quiet --bare "$REMOTE/$r.git" "$s"
    fi
    git -C "$s" config remote.origin.fetch '+refs/heads/*:refs/heads/*'
    git -C "$s" config pack.threads 1
    git -C "$s" config gc.auto 0
    # Checkouts borrow these objects, so the store must never drop one.
    # preciousObjects makes git refuse to prune or repack -d here.
    git -C "$s" config core.repositoryformatversion 1
    git -C "$s" config extensions.preciousObjects true
  done
  local self; self="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/$(basename "${BASH_SOURCE[0]}")"
  [ "$self" = "$STORE/ws.sh" ] || install -m 755 "$self" "$STORE/ws.sh"
  [ -f "$STORE/keep" ] || printf '%s\n' \
    '# Checkouts the sweep never removes (one absolute path per line):' \
    '# the directories Paperclip itself manages for each seat.' > "$STORE/keep"
  cmd_fetch
  say "ready: $STORE"
}

cmd_fetch() {
  local r
  for r in $REPOS; do fetch_one "$r"; done
}

cmd_clone() {
  [ $# -eq 2 ] || die "usage: ws.sh clone <repo> <dir>"
  check_repo "$1"
  [ -e "$2" ] && die "$2 already exists; use it, or ws.sh done it first"
  fetch_one "$1"
  g clone --quiet --reference "$(store_of "$1")" "$REMOTE/$1.git" "$2"
  git -C "$2" config pack.threads 1
  say "cloned $1 into $2 (objects borrowed from the store)"
}

cmd_attach() {
  [ $# -eq 1 ] || die "usage: ws.sh attach <checkout>"
  local d r s c alt before after
  d=$(abspath "$1") || die "no such directory: $1"
  r=$(repo_of "$d") || die "$d is not a checkout of cyberjudah or cyberjudah-telegram"
  s=$(store_of "$r"); [ -d "$s" ] || die "no store at $s; run: ws.sh setup"
  c=$(common_dir "$d")
  fetch_one "$r"
  alt="$c/objects/info/alternates"
  if ! grep -qxF "$s/objects" "$alt" 2>/dev/null; then
    mkdir -p "$c/objects/info"
    echo "$s/objects" >> "$alt"
  fi
  before=$(du -sk "$c/objects" | cut -f1)
  # -l keeps only what the store lacks (unpushed commits, staged files, stashes).
  # Unreachable objects from the last two weeks are kept loose, as git gc would.
  git -C "$d" -c pack.threads=1 repack -A -d -l -q --unpack-unreachable=2.weeks.ago
  git -C "$d" prune-packed
  # Loose objects the store already holds are duplicates; the store never drops one.
  (cd "$c/objects" && find . -path './[0-9a-f][0-9a-f]/*' -type f | sed 's#^\./##; s#/##') |
    git -C "$s" cat-file --batch-check='%(objectname) %(objecttype)' |
    awk '$2 != "missing" { print $1 }' |
    while read -r o; do rm -f "$c/objects/${o:0:2}/${o:2}"; done
  after=$(du -sk "$c/objects" | cut -f1)
  say "attached $d: $((before / 1024)) MB -> $((after / 1024)) MB"
}

# Tips that are not on GitHub, judged against the freshly fetched store
# (never against the checkout's own remote-tracking refs, which can be stale
# or narrowed). Prints one line per unpushed ref; returns 2 if it cannot tell.
unpushed() {
  local d=$1 r s refs
  r=$(repo_of "$d") || return 2
  s=$(store_of "$r")
  refs=$(git -C "$s" for-each-ref --format='^%(objectname)' refs/heads) || return 2
  # Let the checkout see the store's objects for this check without changing it.
  export GIT_ALTERNATE_OBJECT_DIRECTORIES="$s/objects"
  git -C "$d" for-each-ref --format='%(refname:short) %(objectname)' refs/heads |
  while read -r name sha; do
    if ! out=$(printf '%s\n%s\n' "$sha" "$refs" | git -C "$d" rev-list --stdin -n 1 2>/dev/null); then
      echo "$name (cannot verify)"
    elif [ -n "$out" ]; then
      echo "$name"
    fi
  done
  local head
  if ! git -C "$d" symbolic-ref -q HEAD >/dev/null; then
    head=$(git -C "$d" rev-parse HEAD)
    out=$(printf '%s\n%s\n' "$head" "$refs" | git -C "$d" rev-list --stdin -n 1 2>/dev/null) || { echo "detached HEAD (cannot verify)"; return 0; }
    [ -z "$out" ] || echo "detached HEAD ${head:0:9}"
  fi
  return 0
}

# Why a checkout must be kept; empty output means it is safe to remove.
reasons_to_keep() {
  local d=$1 gd c n
  gd=$(git_dir "$d"); c=$(common_dir "$d")
  n=$(git -C "$d" status --porcelain --untracked-files=normal 2>/dev/null | wc -l | tr -d ' ')
  [ "$n" = 0 ] || echo "$n uncommitted file(s)"
  for f in MERGE_HEAD CHERRY_PICK_HEAD REVERT_HEAD rebase-merge rebase-apply; do
    [ -e "$gd/$f" ] && echo "a merge or rebase is in progress ($f)"
  done
  if [ "$gd" = "$c" ]; then
    [ -z "$(git -C "$d" stash list 2>/dev/null)" ] || echo "has a stash"
    n=$(git -C "$d" worktree list --porcelain | grep -c '^worktree ' || true)
    [ "$n" -le 1 ] || echo "has $((n - 1)) other worktree(s)"
    unpushed "$d" | sed 's/^/not on GitHub: /'
  else
    # A worktree's branch stays in its main checkout; only a detached HEAD can be lost.
    if ! git -C "$d" symbolic-ref -q HEAD >/dev/null; then
      unpushed "$d" | grep '^detached' | sed 's/^/not on GitHub: /' || true
    fi
  fi
  return 0
}

last_used_days() {
  local gd newest=0 t f
  gd=$(git_dir "$1")
  for f in "$gd/index" "$gd/HEAD" "$gd/logs/HEAD" "$gd/FETCH_HEAD" "$gd/ORIG_HEAD"; do
    [ -e "$f" ] || continue
    t=$(mtime "$f"); [ "$t" -gt "$newest" ] && newest=$t
  done
  echo $(( ( $(date +%s) - newest ) / 86400 ))
}

remove_checkout() {
  local d=$1 gd c
  gd=$(git_dir "$d"); c=$(common_dir "$d")
  if [ "$gd" != "$c" ]; then
    git -C "$(dirname "$c")" worktree remove --force "$d"
    git -C "$(dirname "$c")" worktree prune
  else
    rm -rf "$d"
  fi
}

kept_by_list() {
  [ -f "$STORE/keep" ] && grep -v '^#' "$STORE/keep" | grep -qxF "$1"
}

cmd_done() {
  [ $# -eq 1 ] || die "usage: ws.sh done <dir>"
  local d r why
  d=$(abspath "$1") || die "no such directory: $1"
  r=$(repo_of "$d") || die "$d is not a checkout of cyberjudah or cyberjudah-telegram"
  kept_by_list "$d" && die "$d is a Paperclip-managed checkout (in $STORE/keep); it stays"
  case "$PWD/" in "$d"/*) die "you are inside $d; cd out of it first" ;; esac
  fetch_one "$r"
  why=$(reasons_to_keep "$d")
  if [ -n "$why" ]; then
    say "kept $d:"; printf '  %s\n' "$why" >&2
    say "push or commit what is listed, then run ws.sh done again"
    exit 3
  fi
  remove_checkout "$d"
  say "removed $d (everything in it is on GitHub)"
}

checkouts() {
  [ -d "$WORKSPACES" ] || return 0
  find "$WORKSPACES" -maxdepth 4 -name node_modules -prune -o -name .git -print 2>/dev/null |
    while read -r g; do dirname "$g"; done | sort
}

disk_line() {
  df -P "$1" 2>/dev/null | awk 'NR==2 { gsub("%","",$5); printf "%s %d %d\n", $6, $5, $4/1048576 }'
}

cmd_report() {
  local mount pct free
  read -r mount pct free < <(disk_line "${WORKSPACES%/*}" || echo "? 0 0")
  echo "disk $mount: ${pct}% used, ${free} GB free"
  [ "${pct:-0}" -lt "$DISK_WARN" ] || echo "DISK WARNING: ${pct}% used (limit ${DISK_WARN}%)"
  for r in $REPOS; do
    s=$(store_of "$r")
    [ -d "$s" ] && echo "store $r: $(du -sh "$s" | cut -f1)" || echo "store $r: MISSING (run ws.sh setup)"
  done
  echo
  printf '%-70s %-7s %-6s %-5s %s\n' CHECKOUT SIZE IDLE SHARED STATE
  local d r alt why
  checkouts | while read -r d; do
    r=$(repo_of "$d") || continue
    alt=no; grep -qs . "$(common_dir "$d")/objects/info/alternates" && alt=yes
    why=$(reasons_to_keep "$d" | paste -sd ';' - | sed 's/;/; /g')
    kept_by_list "$d" && why="paperclip-managed${why:+; $why}"
    printf '%-70s %-7s %-6s %-5s %s\n' "${d#"$WORKSPACES"/}" "$(du -sh "$d" 2>/dev/null | cut -f1)" \
      "$(last_used_days "$d")d" "$alt" "${why:-clean, all on GitHub}"
  done
}

cmd_sweep() {
  cmd_fetch
  local d r days why nm remove=yes
  # Until the keep list names Paperclip's own checkouts, the sweep removes nothing.
  if ! grep -qv '^#' "$STORE/keep" 2>/dev/null; then
    remove=no; say "$STORE/keep lists no Paperclip-managed checkout; removing none this sweep"
  fi
  checkouts | while read -r d; do
    r=$(repo_of "$d") || continue
    [ -d "$d" ] || continue                       # removed with its parent this sweep
    if [ "$(git_dir "$d")" = "$(common_dir "$d")" ]; then
      ( cmd_attach "$d" ) || say "could not attach $d; left as it is"
    fi
    days=$(last_used_days "$d")
    [ "$days" -ge "$STALE_DAYS" ] || continue
    why=$(reasons_to_keep "$d")
    if [ "$remove" = yes ] && [ -z "$why" ] && ! kept_by_list "$d"; then
      remove_checkout "$d"; say "removed $d (idle ${days}d, all on GitHub)"
      continue
    fi
    # Kept checkouts lose only what npm rebuilds.
    find "$d" -maxdepth 3 -name node_modules -type d -prune 2>/dev/null | while read -r nm; do
      rm -rf "$nm"; say "removed $nm (idle ${days}d)"
    done
  done
  cmd_report
}

case "${1:-}" in
  setup)  shift; cmd_setup "$@" ;;
  fetch)  shift; cmd_fetch "$@" ;;
  clone)  shift; cmd_clone "$@" ;;
  attach) shift; cmd_attach "$@" ;;
  done)   shift; cmd_done "$@" ;;
  report) shift; cmd_report "$@" ;;
  sweep)  shift; cmd_sweep "$@" ;;
  *) sed -n '2,15p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 64 ;;
esac
