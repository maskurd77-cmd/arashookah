// Reads the EAN-13 labels printed by a barcode printing scale (e.g. TM-30A / TM-A series).
//
// Default label layout (13 digits):
//   [flag: 2 digits][item code (PLU): 5 digits][weight in grams: 5 digits][check digit]
//   e.g. 21 00123 01250 3  ->  item 123, 1.250 kg
//
// Every part is configurable from Settings, because each scale can be programmed differently.

export interface ScaleBarcodeConfig {
  enabled: boolean;
  /** Comma-separated list of flags the scale prints at the start of the barcode, e.g. "20,21,22" */
  prefixes: string;
  /** How many digits the flag uses (usually 2) */
  flagLength: number;
  /** How many digits the item code (PLU) uses (usually 5) */
  codeLength: number;
  /** Whether the digits after the item code are the weight or the total price */
  valueType: 'weight' | 'price';
  /** Decimal places in that value: 3 for weight in grams -> kg, 0 for price in IQD */
  decimals: number;
}

export const DEFAULT_SCALE_CONFIG: ScaleBarcodeConfig = {
  enabled: true,
  prefixes: '20,21,22,23,24,25,26,27,28,29',
  flagLength: 2,
  codeLength: 5,
  valueType: 'weight',
  decimals: 3,
};

export interface ParsedScaleBarcode {
  flag: string;
  itemCode: string;
  value: number;
  valueType: 'weight' | 'price';
  checkDigitOk: boolean;
}

export const getScaleConfig = (raw: any): ScaleBarcodeConfig => ({
  ...DEFAULT_SCALE_CONFIG,
  ...(raw && typeof raw === 'object' ? raw : {}),
});

const ean13CheckDigit = (first12: string): number => {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
};

/** Returns null when the code is not a scale label */
export const parseScaleBarcode = (rawCode: string, config: ScaleBarcodeConfig): ParsedScaleBarcode | null => {
  if (!config.enabled) return null;
  const code = String(rawCode || '').trim();
  if (!/^\d{13}$/.test(code)) return null;

  const flagLength = Number(config.flagLength) || 2;
  const codeLength = Number(config.codeLength) || 5;
  if (flagLength + codeLength >= 12) return null;

  const flag = code.slice(0, flagLength);
  const prefixes = String(config.prefixes || '')
    .split(/[,\s]+/)
    .map(p => p.trim())
    .filter(Boolean);
  if (prefixes.length > 0 && !prefixes.includes(flag)) return null;

  const itemCode = code.slice(flagLength, flagLength + codeLength);
  const valueDigits = code.slice(flagLength + codeLength, 12);
  const decimals = Math.max(0, Number(config.decimals) || 0);
  const value = Number(valueDigits) / Math.pow(10, decimals);

  return {
    flag,
    itemCode,
    value,
    valueType: config.valueType === 'price' ? 'price' : 'weight',
    checkDigitOk: ean13CheckDigit(code.slice(0, 12)) === Number(code[12]),
  };
};

const stripZeros = (s: unknown) => String(s ?? '').trim().replace(/^0+/, '') || '0';

/** A weighed product matches when its "scale code" equals the item code on the label (leading zeros ignored) */
export const matchesScaleCode = (product: any, itemCode: string): boolean => {
  if (!product?.isWeighed) return false;
  const scaleCode = String(product.scaleCode ?? '').trim();
  if (!scaleCode) return false;
  return stripZeros(scaleCode) === stripZeros(itemCode);
};

/** Turns a parsed label into a quantity in kg for the given product (null if it cannot be worked out) */
export const quantityFromScaleLabel = (parsed: ParsedScaleBarcode, product: any): number | null => {
  let qty = parsed.value;
  if (parsed.valueType === 'price') {
    const unitPrice = Number(product?.price) || 0;
    if (unitPrice <= 0) return null;
    qty = parsed.value / unitPrice;
  }
  qty = Number(qty.toFixed(3));
  return qty > 0 ? qty : null;
};
