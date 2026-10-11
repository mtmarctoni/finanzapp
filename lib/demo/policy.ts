/**
 * Server-trusted deployment policy. Like other lib internals, this module is
 * excluded from client imports by the fail-closed dependency-cruiser boundary.
 * Read at request time so the policy never depends on client input or identity.
 */
export function isPreviewDemo(): boolean {
  return process.env.VERCEL_ENV === 'preview';
}

/** Call only after authentication, before parsing or any AI feature work. */
export function previewAiDisabledResponse(): Response | null {
  if (!isPreviewDemo()) return null;

  const message =
    'La IA está deshabilitada en esta demo. Puedes añadir la entrada o los datos del recibo manualmente.';
  return Response.json(
    { error: message, message, code: 'PREVIEW_AI_DISABLED' },
    { status: 403 },
  );
}
