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
pids=()
trap 'kill ${pids[@]+"${pids[@]}"} 2> /dev/null; exit 1' INT TERM
for round in $(seq 1 "$1"); do
  echo "round $round start $(date -u +%T) $(uptime)" >> "$out/rounds.log"
  pids=()
  for ((i = 1; i <= ${BUN:-4}; i++)); do node "$here/run.mjs" bun "$out" "${WATCHDOG:-820}" "$round" "b$i" > /dev/null & pids+=($!); done
  for ((i = 1; i <= ${NODE:-2}; i++)); do node "$here/run.mjs" node "$out" "${WATCHDOG:-820}" "$round" "n$i" > /dev/null & pids+=($!); done
  wait "${pids[@]}"
  echo "round $round end $(date -u +%T) $(uptime)" >> "$out/rounds.log"
done
node "$here/table.mjs" "$out"
