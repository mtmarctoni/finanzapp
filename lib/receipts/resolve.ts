import { STANDARD_CATEGORIES, normalizeCategory } from '@/lib/categories';
import { normalizeMerchantName } from '@/lib/merchants/normalize';
import {
  findMerchantByNormalizedName,
  isTrustedMerchant,
  type MerchantRecord,
} from '@/lib/merchants/repo';

/**
 * Decide the `tipo` of a parsed receipt.
 *
 * Order of authority:
 *   1. `memory`     — the user confirmed or corrected this merchant before.
 *   2. `alias`      — the model's answer is a known synonym.
 *   3. `model`      — the model's answer is already a standard category.
 *   4. `seen_guess` — the model said nothing usable, but the merchant was seen.
 *   5. `default`    — nothing known.
 *
 * Only `model` and `alias` require the answer to survive the
 * `STANDARD_CATEGORIES` gate; memory and `seen_guess` come from the user's own
 * ledger, and `default` is a literal.
 *
 * `memory` and `seen_guess` are deliberately separated. A merchant the user
 * has never confirmed may still contribute a guess, but only where the model
 * has nothing to offer: an unverified guess must never outrank a fresh read.
 */

export interface ClassificationInput {
  userId: string;
  comercio: string;
  modelTipo: string;
  modelPlataformaPago: string;
}

export interface Classification {
  tipo: string;
  plataforma_pago: string;
  source: 'memory' | 'alias' | 'model' | 'seen_guess' | 'default';
  merchantId: string | null;
  trusted: boolean;
}

export async function resolveMerchantClassification(
  input: ClassificationInput,
): Promise<Classification> {
  const normalizedName = normalizeMerchantName(input.comercio);

  const merchant: MerchantRecord | null = normalizedName
    ? await findMerchantByNormalizedName(normalizedName, input.userId)
    : null;

  const trusted = merchant !== null && isTrustedMerchant(merchant);
  const modelTipo = input.modelTipo.trim();

  // `normalizeCategory` cannot tell us whether it recognised the input: for an
  // unknown category it logs a warning and returns the string unchanged, so a
  // truthy result only proves the model said *something*. Gate the answer on
  // membership of `STANDARD_CATEGORIES` — without this gate a hallucinated
  // "grocery" would be written to the ledger as a `tipo`, would leave the
  // `/new` form with nothing selected (its list is fixed), and would then be
  // learned as merchant memory and re-applied to every future receipt.
  const normalizedModelTipo = modelTipo ? normalizeCategory(modelTipo) : '';
  const standardModelTipo = STANDARD_CATEGORIES.find(
    (category) => category.toLowerCase() === normalizedModelTipo.toLowerCase(),
  );

  let tipo: string;
  let source: Classification['source'];

  // `merchant !== null` is spelled out because `trusted` alone does not
  // narrow the type, and `merchant.tipo` may not be nullable-safe without it.
  if (merchant !== null && trusted && merchant.tipo) {
    tipo = merchant.tipo;
    source = 'memory';
  } else if (standardModelTipo) {
    tipo = standardModelTipo;
    // Unchanged by `normalizeCategory` means the model already answered with a
    // standard category; changed means we had to map a synonym onto one.
    source =
      standardModelTipo.toLowerCase() === modelTipo.toLowerCase()
        ? 'model'
        : 'alias';
  } else if (merchant?.tipo) {
    tipo = merchant.tipo;
    source = 'seen_guess';
  } else {
    tipo = 'Otros gastos';
    source = 'default';
  }

  const printed = input.modelPlataformaPago.trim();
  const remembered = merchant?.plataforma_pago ?? '';

  return {
    tipo,
    // The receipt in front of us is the authority on how it was paid, and an
    // empty string counts as "not printed on the receipt", so `||` and not
    // `??` is the operator we want here.
    plataforma_pago: printed || remembered || '',
    source,
    merchantId: merchant?.id ?? null,
    trusted,
  };
}
