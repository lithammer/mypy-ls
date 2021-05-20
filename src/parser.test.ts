import test from "ava";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver/node";

import { parseLine, parseOutput } from "./parser";

test("should parse a single line of mypy output", (t) => {
  const text =
    'foo.py:5:12: error: Incompatible return value type (got "str", expected "int")  [return-value]';
  const diagnostic = parseLine(text);
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
  t.deepEqual(diagnostic, expected);
});

test("should parse normalized mypy output", (t) => {
  const lines = [
    'foo.py:5:12: error: Incompatible return value type (got "str", expected "int")  [return-value]',
    'bar.py:5:12: error: Missing positional argument "name" in call to "hello" of "HelloWorld"  [call-arg]',
    'baz.py:5:12: error: Argument "name" to "hello" of "HelloWorld" has incompatible type "int"; expected "str"  [arg-type]',
  ];
  const diagnostics = parseOutput(lines.join("\n"));
  const expected: Diagnostic[] = [
    {
      severity: DiagnosticSeverity.Error,
      range: {
        start: { line: 4, character: 11 },
        end: { line: 4, character: 12 },
      },
      message: 'Incompatible return value type (got "str", expected "int")',
      source: "Mypy",
      code: "return-value",
    },
    {
      severity: DiagnosticSeverity.Error,
      range: {
        start: { line: 4, character: 11 },
        end: { line: 4, character: 12 },
      },
      message:
        'Missing positional argument "name" in call to "hello" of "HelloWorld"',
      source: "Mypy",
      code: "call-arg",
    },
    {
      severity: DiagnosticSeverity.Error,
      range: {
        start: { line: 4, character: 11 },
        end: { line: 4, character: 12 },
      },
      message:
        'Argument "name" to "hello" of "HelloWorld" has incompatible type "int"; expected "str"',
      source: "Mypy",
      code: "arg-type",
    },
  ];
  t.deepEqual(diagnostics, expected);
});
