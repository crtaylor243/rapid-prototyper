import { transformAsync } from '@babel/core';
import presetReact from '@babel/preset-react';

export async function compileJsxToSandboxedJs(jsxSource: string): Promise<string> {
  const result = await transformAsync(jsxSource, {
    presets: [[presetReact, { runtime: 'automatic', development: false }]],
    filename: 'codex-component.jsx'
  });

  if (!result?.code) {
    throw new Error('Babel was unable to compile the Codex JSX output');
  }

  return sanitizeCompiledJs(result.code);
}

export function sanitizeCompiledJs(bundle: string): string {
  return bundle.replace(/<\/?script/gi, '').trim();
}
