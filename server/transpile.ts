import ts from 'typescript';

export interface TranspileResult {
  js?: string;
  error?: string;
}

// Strips TypeScript types so the browser can run the code. Nothing is executed on the server.
export function transpile(code: string): TranspileResult {
  const out = ts.transpileModule(code, {
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      removeComments: false,
      strict: false,
    },
  });
  const errors = (out.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  if (errors.length) {
    const first = errors[0];
    const text = ts.flattenDiagnosticMessageText(first.messageText, '\n');
    if (first.file && first.start !== undefined) {
      const { line, character } = first.file.getLineAndCharacterOfPosition(first.start);
      return { error: `Line ${line + 1}, column ${character + 1}: ${text}` };
    }
    return { error: text };
  }
  return { js: out.outputText };
}
