/**
 * Gate output. Two rules taken from enxvo's init.sh: a failure has to name the
 * next action, and a warning must never read like a pass.
 */

const ESC = String.fromCharCode(27);
const useColor = process.env["NO_COLOR"] === undefined && process.stdout.isTTY === true;
const paint = (code: string, s: string) => (useColor ? `${ESC}[${code}m${s}${ESC}[0m` : s);

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

  warn(message: string): void {
    this.#warnings.push(message);
    if (!this.#quiet) console.log(`${paint("33", "[warn]")}  ${message}`);
  }

  /** @param message what is wrong. @param fix the next action, in one line. */
  fail(message: string, fix?: string): void {
    this.#failures.push(fix ? `${message} -> ${fix}` : message);
    if (!this.#quiet) {
      console.log(`${paint("31", "[fail]")}  ${message}`);
      if (fix) console.log(`        fix: ${fix}`);
    }
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
