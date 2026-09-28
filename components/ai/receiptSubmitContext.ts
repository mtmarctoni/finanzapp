/**
 * The receipt decision a submit has to carry, taken from the query params
 * alone.
 *
 * It lives here, as a module that imports nothing, for the same reason
 * `imageDownscale.ts` does: it cannot go in `lib/` (`.dependency-cruiser.js`
 * fails closed on `components/ -> lib/` outside a short allow-list) and it
 * cannot go in `finance-form.tsx` (importing the component to test one pure
 * function drags in `next/navigation`, `next-auth/react`, every Radix
 * primitive and, through `lib/actions.ts`, `next/cache`).
 *
 * Two facts live here that nothing else can check: a receipt save carries
 * provenance, and it carries the `learning` context `createEntry` needs. If
 * the third `createEntry` argument were ever dropped, learning would stop for
 * every user and every other test in the feature would still pass.
 */

export interface ReceiptPrefill {
  rcpt?: string;
  tipo?: string;
  comercio?: string;
  content_hash?: string;
  merchant_id?: string;
  confianza?: number;
}

export interface ReceiptSubmitContext {
  // Every field is optional because a manual entry contributes `{}`, and
  // `origen` is what turns that `{}` into a receipt row. A required `origen`
  // here would force a cast at the one call site that must not have one.
  provenance: {
    origen?: 'receipt';
    content_hash?: string;
    merchant_id?: string;
    confianza?: number;
  };
  learning?: { comercio: string; categoriaPrefill: string };
}

/**
 * What a submit has to carry, decided from the query params alone.
 *
 * `categoriaPrefill` is recorded for debugging only. `createEntry` learns
 * `formData.tipo` — the category the user actually saved — so a wrong guess
 * cannot become permanent after a single confirmation.
 */
export function buildReceiptSubmitContext(
  parsedData: ReceiptPrefill | undefined,
): ReceiptSubmitContext {
  if (parsedData?.rcpt !== '1') {
    return { provenance: {} };
  }

  return {
    provenance: {
      origen: 'receipt',
      content_hash: parsedData.content_hash,
      merchant_id: parsedData.merchant_id,
      confianza: parsedData.confianza,
    },
    learning: parsedData.comercio
      ? {
          comercio: parsedData.comercio,
          categoriaPrefill: parsedData.tipo ?? '',
        }
      : undefined,
  };
}
