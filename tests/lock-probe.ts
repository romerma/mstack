// Child process for the withLock tests in tsv.test.ts that must observe a hang
// as a failure rather than become one. It tries the lock once and says what
// happened; the parent puts a deadline on it.
import { withLock } from "../src/tsv.ts";

const [file, timeoutMs] = process.argv.slice(2) as [string, string];

try {
  withLock(file, () => {
    console.log("ENTERED");
  }, { timeoutMs: Number(timeoutMs) });
} catch (error) {
  console.log(`THREW ${(error as Error).constructor.name} ${(error as Error).message}`);
}
