import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver/node";
import { isNotNull } from "./typeUtils";

type Severity = "error" | "note";

const severityMap = {
  error: DiagnosticSeverity.Error,
  note: DiagnosticSeverity.Information,
};

// foo.py:5:12: error: Incompatible return value type (got "str", expected "int")  [return-value]
const pattern = /([^:]+):(\d+):(\d+): (\w+): (.+) \[([a-z-]+)\]/;

export const parseLine = (line: string): Diagnostic | null => {
  const match = line.trim().match(pattern);
  if (!match) {
    return null;
  }

  // const filename = match[1];
  const row = parseInt(match[2], 10);
  const col = parseInt(match[3], 10);
  const severity = match[4] as Severity;
  const message = match[5].trim();
  const code = match[6];

  return {
    severity: severityMap[severity],
    range: {
      start: { line: row - 1, character: col - 1 },
      end: { line: row - 1, character: col },
    },
    message: message,
    source: "Mypy",
    code: code,
  };
};

/**
 * Parse normalized Mypy output.
 *
 * @param stdout Normalized output from running `mypy`.
 */
export const parseOutput = (stdout: string): Diagnostic[] =>
  stdout.trim().split("\n").map(parseLine).filter(isNotNull);
