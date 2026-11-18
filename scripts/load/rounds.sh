#!/bin/bash
# usage: scripts/load/rounds.sh <rounds> <out-dir>
# Runs <rounds> rounds back to back. A round starts BUN (default 4) bun suites and NODE (default 2)
# node suites together, each under a SIGKILL watchdog of WATCHDOG seconds (default 820), and waits
# on their pids. Rows go to <out-dir>/results.tsv; tabulate with scripts/load/table.mjs <out-dir>.
set -u
if [ $# -ne 2 ]; then echo "usage: scripts/load/rounds.sh <rounds> <out-dir>" >&2; exit 2; fi
here="$(cd "$(dirname "$0")" && pwd)"
out="$2"
mkdir -p "$out"
for round in $(seq 1 "$1"); do
  echo "round $round start $(date -u +%T) $(uptime)" >> "$out/rounds.log"
  pids=()
  for i in $(seq 1 "${BUN:-4}"); do node "$here/run.mjs" bun "$out" "${WATCHDOG:-820}" "$round" "b$i" > /dev/null & pids+=($!); done
  for i in $(seq 1 "${NODE:-2}"); do node "$here/run.mjs" node "$out" "${WATCHDOG:-820}" "$round" "n$i" > /dev/null & pids+=($!); done
  wait "${pids[@]}"
  echo "round $round end $(date -u +%T) $(uptime)" >> "$out/rounds.log"
done
node "$here/table.mjs" "$out"
