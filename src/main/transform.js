const ts = require('typescript');

const RESULT_FN = '__runts_result';
const CONSOLE_FN = '__runts_console';

const IGNORED_DIAGNOSTICS = new Set([1375, 1378, 1431, 1432, 2307, 2792]);

function isConsoleCall(node) {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === 'console'
  );
}

function instrumenter(context) {
  const f = context.factory;
  return (sf) => {
    const lineOf = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;

    const visit = (node) => {
      if (isConsoleCall(node)) {
        const args = node.arguments.map((a) => ts.visitNode(a, visit));
        return f.createCallExpression(f.createIdentifier(CONSOLE_FN), undefined, [
          f.createNumericLiteral(lineOf(node)),
          f.createStringLiteral(node.expression.name.text),
          ...args,
        ]);
      }
      return ts.visitEachChild(node, visit, context);
    };

    const wrapTopLevel = (stmt) => {
      if (!ts.isExpressionStatement(stmt) || isConsoleCall(stmt.expression)) {
        return ts.visitNode(stmt, visit);
      }
      const expr = stmt.expression;
      if (ts.isStringLiteral(expr) && expr.text === 'use strict') return stmt;
      return f.updateExpressionStatement(
        stmt,
        f.createCallExpression(f.createIdentifier(RESULT_FN), undefined, [
          f.createNumericLiteral(lineOf(stmt)),
          ts.visitNode(expr, visit),
        ]),
      );
    };

    return f.updateSourceFile(sf, sf.statements.map(wrapTopLevel));
  };
}

function transform(code, lang) {
  const fileName = lang === 'typescript' ? 'input.ts' : 'input.js';
  const out = ts.transpileModule(code, {
    fileName,
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      allowJs: true,
      sourceMap: true,
      inlineSources: false,
      experimentalDecorators: true,
      jsx: ts.JsxEmit.React,
    },
    transformers: { before: [instrumenter] },
  });

  const diagnostics = (out.diagnostics || [])
    .filter((d) => d.category === ts.DiagnosticCategory.Error && !IGNORED_DIAGNOSTICS.has(d.code))
    .map((d) => {
      const pos = d.file ? d.file.getLineAndCharacterOfPosition(d.start || 0) : { line: 0, character: 0 };
      return {
        line: pos.line + 1,
        column: pos.character + 1,
        message: ts.flattenDiagnosticMessageText(d.messageText, '\n'),
      };
    });

  const js = out.outputText.replace(/\n\/\/# sourceMappingURL=.*\s*$/, '\n');
  return { code: js, sourceMap: out.sourceMapText ? JSON.parse(out.sourceMapText) : null, diagnostics };
}

module.exports = { transform };
