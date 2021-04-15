import test from "ava";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver/node";

import { parseLine } from "./parser";

test("shoud parse mypy error output", (t) => {
  const text =
    'foo.py:5:12: error: Incompatible return value type (got "str", expected "int")  [return-value]';
  const diagnostics = parseLine(text);
  const expected: Diagnostic = {
    severity: DiagnosticSeverity.Error,
    range: {
      start: { line: 4, character: 11 },
      end: { line: 4, character: 12 },
    },
    message: 'Incompatible return value type (got "str", expected "int")',
    source: "Mypy",
    code: "return-value",
  };
  t.deepEqual(diagnostics, expected);
});
