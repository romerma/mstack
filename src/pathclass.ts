/**
 * Classify a repository-relative path as test, doc or code. A leaf module.
 *
 * Hand-written glob matching: `path.matchesGlob` is experimental on node 22 and
 * warns on stderr. `**` crosses `/` (and `**` followed by `/` may match nothing);
 * `*` stays inside one path segment.
 */

export type PathClass = "test" | "doc" | "code";

export const TEST_PATTERNS: readonly string[] = [
  "tests/**", "test/**", "**/__tests__/**", "**/*.test.*", "**/*.spec.*",
  "**/test_*.py", "**/*_test.py", "**/*_test.go",
];
export const DOC_PATTERNS: readonly string[] = ["**/*.md", "docs/**", "LICENSE*", "CHANGELOG*"];

export interface PatternOverrides {
  readonly test?: readonly string[];
  readonly doc?: readonly string[];
}

function globToRegExp(glob: string): RegExp {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i] as string;
    if (c === "*" && glob[i + 1] === "*") {
      const slash = glob[i + 2] === "/";
      re += slash ? "(?:.*/)?" : ".*";
      i += slash ? 2 : 1;
    } else if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

export function matchesGlob(path: string, glob: string): boolean {
  return globToRegExp(glob).test(path);
}

/** Test patterns win over doc patterns: `tests/README.md` is a test fixture's neighbour, not a doc. */
export function classifyPath(relPath: string, overrides: PatternOverrides = {}): PathClass {
  const path = relPath.replace(/^\.\//, "");
  if ((overrides.test ?? TEST_PATTERNS).some((g) => matchesGlob(path, g))) return "test";
  if ((overrides.doc ?? DOC_PATTERNS).some((g) => matchesGlob(path, g))) return "doc";
  return "code";
}
