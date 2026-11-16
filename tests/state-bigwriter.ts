// Child process for the file-size-limit test in state.test.ts. It runs a real
// `updateState` that sets the first item's title to a long string, and reports
// how it ended on stdout: `wrote`, or `threw <UserError | other>: <message>`.
// The test runs it under `ulimit -f`, where the write cannot complete.
import { UserError } from "../src/paths.ts";
import { updateState } from "../src/state.ts";

const [file, size] = process.argv.slice(2) as [string, string];

try {
  updateState(file, (state) => {
    state.items[0]!.title = "x".repeat(Number(size));
  });
  process.stdout.write("wrote\n");
} catch (error) {
  const kind = error instanceof UserError ? "UserError" : "other";
  process.stdout.write(`threw ${kind}: ${(error as Error).message}\n`);
  process.exitCode = 2;
}
