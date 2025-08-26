// Browser-safe xmlContentAssist.js stub for poml-browser
// This module provides XML content assistance and autocompletion features
// In browser context, this functionality is not available

export function getSuggestions(_options: any): any {
  throw new Error(
    'XML content assistance is not available in browser context. XML autocompletion requires server-side processing.',
  );
}

export function computeCompletionSyntacticContext(_options: any): any {
  throw new Error(
    'XML syntactic context computation is not available in browser context. XML parsing requires server-side libraries.',
  );
}
