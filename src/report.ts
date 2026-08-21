/**
 * Gate output. Two rules taken from enxvo's init.sh: a failure has to name the
 * next action, and a warning must never read like a pass.
 */

const ESC = String.fromCharCode(27);
const useColor = process.env["NO_COLOR"] === undefined && process.stdout.isTTY === true;
const paint = (code: string, s: string) => (useColor ? `${ESC}[${code}m${s}${ESC}[0m` : s);

/**
 * Quiet mode writes here, and the stream is the decision.
 *
 * `mstack hook stop` runs the gate quiet and then writes its `additionalContext`
 * JSON to stdout. Failure text on that stream would be concatenated in front of
 * the JSON and the hook's structured output would stop parsing, so the one mode
 * built for a hook would break the hook. stderr is the same choice `state
 * active` makes for the same reason: stdout stays machine-consumable.
 *
 * Written through `process.stderr.write` rather than `console.error` because
 * that is the only spelling a test can intercept in both runtimes. Under bun a
 * patched `process.stderr.write` does not see `console.error` at all, so the
 * assertions that pin this output would silently measure nothing on one of the
 * two runtimes this project promises.
 */
function emit(line: string): void {
  process.stderr.write(`${line}\n`);
}

export class Report {
  #failures: string[] = [];
  #warnings: string[] = [];
  #quiet: boolean;

  constructor(options: { quiet?: boolean } = {}) {
    this.#quiet = options.quiet ?? false;
  }

  ok(message: string): void {
    if (!this.#quiet) console.log(`${paint("32", "[ok]")}    ${message}`);
  }

  /**
   * Silent under quiet, deliberately.
   *
   * Quiet is the mode the `Stop` hook runs, once at the end of every turn, and
   * the two warnings this repository produces most are "uncommitted change(s)"
   * and "on main" — both normal mid-session states. A hook that says those every
   * turn is a hook someone switches off, which costs more than the warning is
   * worth. Callers that want them still have `report.warnings`.
   */
  warn(message: string): void {
    this.#warnings.push(message);
    if (!this.#quiet) console.log(`${paint("33", "[warn]")}  ${message}`);
  }

  /**
   * @param message what is wrong. @param fix the next action, in one line.
   *
   * Quiet prints one line per failure and nothing else: no `[ok]`, no section
   * header, no warning, no summary. The fix stays on that line rather than
   * being dropped, because this module's first rule is that a failure names the
   * next action, and the mode where a reader is least able to go and ask is the
   * worst one to drop it in. The text is exactly the string `failures` holds, so
   * what a human reads on stderr and what the `Stop` hook hands the model are
   * the same bytes.
   *
   * It used to print nothing at all, while `docs/wiki/The-CLI.md` said
   * "--quiet prints failures only" — a red gate at session close whose only
   * signal was an exit code nobody displays.
   */
  fail(message: string, fix?: string): void {
    const line = fix ? `${message} -> ${fix}` : message;
    this.#failures.push(line);
    if (this.#quiet) {
      // No colour: the readers here are a hook transcript and `OUT=$(mstack
      // gate --quiet 2>&1)`, and an escape code in either is noise.
      emit(`[fail]  ${line}`);
      return;
    }
    console.log(`${paint("31", "[fail]")}  ${message}`);
    if (fix) console.log(`        fix: ${fix}`);
  }

  section(title: string): void {
    if (!this.#quiet) console.log(`\n${paint("1", `-- ${title}`)}`);
  }

  get failures(): readonly string[] {
    return this.#failures;
  }

  get warnings(): readonly string[] {
    return this.#warnings;
  }

  get failed(): boolean {
    return this.#failures.length > 0;
  }

  /**
   * The count line does not survive quiet mode. It is a summary, not a failure,
   * the exit code already carries pass/fail, and "failures and nothing else"
   * means a script can count the lines it got.
   */
  summary(): void {
    if (this.#quiet) return;
    const f = this.#failures.length;
    const w = this.#warnings.length;
    const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
    console.log(
      f > 0
        ? `\n${paint("31", "FAILED")} - ${plural(f, "failure")}, ${plural(w, "warning")}`
        : `\n${paint("32", "PASSED")} - 0 failures, ${plural(w, "warning")}`,
    );
  }
}
