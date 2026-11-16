// Reads the EAN-13 labels printed by a barcode printing scale (e.g. TM-30A / TM-A / TM-30Ab series).
//
// Common label layouts (13 digits):
//   Weight embedded (e.g. flag 21):
//     [flag: 2 digits][item code / PLU: 5 digits][weight in grams: 5 digits][check digit]
//     e.g. 21 00123 01250 3  ->  item 123, 1.250 kg
//
//   Price embedded (e.g. flag 02 or 22):
//     [flag: 2 digits][item code / PLU: 5 digits][total price: 5 digits][check digit]
//     e.g. 02 20101 00270 7  ->  item 20101, total price $2.70
//
// Every part is configurable from Settings, with smart auto-detection by default.

export type WeighedRoundingMode = 'nearest' | 'floor' | 'ceil' | 'none';

export interface WeighedRoundingConfig {
  /** Whether automatic IQD rounding is enabled */
  enabled: boolean;
  /** Cash denomination step: 250 (standard in Iraq), 500, or 1000 */
  step: number;
  /** Rounding mode: 'nearest' (1050->1000, 2700->2750), 'floor' (always down), 'ceil' (always up), or 'none' */
  mode: WeighedRoundingMode;
}

export const DEFAULT_ROUNDING_CONFIG: WeighedRoundingConfig = {
  enabled: true,
  step: 250,
  mode: 'nearest',
};

export interface RoundingResult {
  rounded: number;
  raw: number;
  difference: number;
}

/** Reads the active rounding config synchronously from localStorage or fallback */
export const getActiveRoundingConfig = (): WeighedRoundingConfig => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem('pos-scale-rounding');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return {
            ...DEFAULT_ROUNDING_CONFIG,
            ...parsed,
          };
        }
      }
    }
  } catch (e) {
    // Ignore storage parse errors
  }
  return { ...DEFAULT_ROUNDING_CONFIG };
};

/** Rounds a raw IQD price according to Iraqi cash denominations (e.g. 1,050 -> 1,000 IQD, 2,700 -> 2,750 IQD) */
export const roundWeighedPrice = (
  rawPrice: number,
  config?: Partial<WeighedRoundingConfig>
): RoundingResult => {
  const cfg: WeighedRoundingConfig = {
    ...DEFAULT_ROUNDING_CONFIG,
    ...(config || {}),
  };
  const raw = Math.round(Number(rawPrice) || 0);

  if (!cfg.enabled || !cfg.step || cfg.step <= 0 || cfg.mode === 'none') {
    return { rounded: raw, raw, difference: 0 };
  }

  const step = Number(cfg.step) || 250;
  let rounded = raw;

  switch (cfg.mode) {
    case 'floor':
      rounded = Math.floor(raw / step) * step;
      break;
    case 'ceil':
      rounded = Math.ceil(raw / step) * step;
      break;
    case 'nearest':
    default:
      rounded = Math.round(raw / step) * step;
      break;
  }

  // If item had price > 0, don't round down to 0
  if (rounded === 0 && raw > 0) {
    rounded = step;
  }

  return {
    rounded,
    raw,
    difference: rounded - raw,
  };
};

export interface ScaleBarcodeConfig {
  enabled: boolean;
  /** Comma-separated list of flags the scale prints at the start of the barcode, e.g. "02,20,21,22,23,24,25,26,27,28,29" */
  prefixes: string;
  /** How many digits the flag uses (usually 2) */
  flagLength: number;
  /** How many digits the item code (PLU) uses (usually 5) */
  codeLength: number;
  /** Whether the digits after the item code are the weight, total price, or auto-detected from flag */
  valueType: 'weight' | 'price' | 'auto';
  /** Decimal places in that value: 3 for weight (grams -> kg), 2 for USD ($2.70), 0 for IQD */
  decimals: number;
  /** Automatic rounding configuration for weighed items */
  rounding?: WeighedRoundingConfig;
}

export const DEFAULT_SCALE_CONFIG: ScaleBarcodeConfig = {
  enabled: true,
  prefixes: '02,03,20,21,22,23,24,25,26,27,28,29',
  flagLength: 2,
  codeLength: 5,
  valueType: 'auto',
  decimals: 3,
  rounding: DEFAULT_ROUNDING_CONFIG,
};

export interface ParsedScaleBarcode {
  flag: string;
  itemCode: string;
  value: number;
  valueType: 'weight' | 'price';
  checkDigitOk: boolean;
  rawCode: string;
}

export const getScaleConfig = (raw: any): ScaleBarcodeConfig => {
  const cfg: ScaleBarcodeConfig = {
    ...DEFAULT_SCALE_CONFIG,
    ...(raw && typeof raw === 'object' ? raw : {}),
    rounding: {
      ...DEFAULT_ROUNDING_CONFIG,
      ...(raw?.rounding && typeof raw.rounding === 'object' ? raw.rounding : {}),
    },
  };

  // Ensure '02' and '03' are included in prefixes even if older saved database config lacked them
  const prefixList = String(cfg.prefixes || '')
    .split(/[,\s]+/)
    .map(p => p.trim())
    .filter(Boolean);
  for (const requiredPrefix of ['03', '02']) {
    if (!prefixList.includes(requiredPrefix)) {
      prefixList.unshift(requiredPrefix);
    }
  }
  cfg.prefixes = prefixList.join(',');

  return cfg;
};

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

  // Clean input: remove spaces, newlines, scanner prefixes
  let code = String(rawCode || '').replace(/\D/g, '');

  // If 12 digits starting with '2', barcode scanner may have dropped the leading '0' of '02...'
  if (code.length === 12 && code.startsWith('2')) {
    code = '0' + code;
  }

  if (code.length !== 13) return null;

  const flagLength = Number(config.flagLength) || 2;
  const codeLength = Number(config.codeLength) || 5;
  if (flagLength + codeLength >= 12) return null;

  const flag = code.slice(0, flagLength);
  const prefixes = String(config.prefixes || '')
    .split(/[,\s]+/)
    .map(p => p.trim())
    .filter(Boolean);
  if (prefixes.length > 0 && !prefixes.includes(flag)) return null;

  // Auto-detect or use configured value type:
  // - Flags '02' and '22' are retail standard for price-embedded barcodes
  // - Flag '21' is retail standard for weight-embedded barcodes
  let effectiveType: 'weight' | 'price' = 'weight';
  if (config.valueType === 'price') {
    effectiveType = 'price';
  } else if (config.valueType === 'weight') {
    effectiveType = 'weight';
  } else {
    // 'auto' mode
    if (flag === '02' || flag === '03' || flag === '22') {
      effectiveType = 'price';
    } else {
      effectiveType = 'weight';
    }
  }

  const itemCode = code.slice(flagLength, flagLength + codeLength);
  const valueDigits = code.slice(flagLength + codeLength, 12);

  let decimals = Number(config.decimals);
  if (isNaN(decimals) || decimals < 0) {
    decimals = effectiveType === 'weight' ? 3 : 2;
  }
  // In auto mode, if flag is '02', '03', or '22' and default decimals is 3, use 2 for USD price ($2.70 / $7.02)
  if (config.valueType === 'auto' && (flag === '02' || flag === '03' || flag === '22') && decimals === 3) {
    decimals = 2;
  }

  const value = Number(valueDigits) / Math.pow(10, decimals);

  return {
    flag,
    itemCode,
    value,
    valueType: effectiveType,
    checkDigitOk: ean13CheckDigit(code.slice(0, 12)) === Number(code[12]),
    rawCode: code,
  };
};

const stripZeros = (s: unknown) => String(s ?? '').trim().replace(/^0+/, '') || '0';

/** A weighed product matches when its "scale code" equals or maps to the item code on the label */
export const matchesScaleCode = (product: any, itemCode: string): boolean => {
  if (!product) return false;
  const isWeighed = Boolean(product.isWeighed);
  const scaleCode = String(product.scaleCode ?? '').trim();
  const barcode = String(product.barcode ?? '').trim();

  // Must either be marked weighed or have a scale code assigned
  if (!isWeighed && !scaleCode) return false;

  const cleanItem = stripZeros(itemCode);

  if (scaleCode) {
    const cleanScale = stripZeros(scaleCode);
    if (cleanScale === cleanItem) return true;
    // Substring / department matching (e.g. itemCode "20101" maps to scaleCode "101")
    if (cleanItem.length > cleanScale.length && cleanItem.endsWith(cleanScale)) return true;
    if (cleanScale.length > cleanItem.length && cleanScale.endsWith(cleanItem)) return true;
  }

  if (barcode) {
    const cleanBarcode = stripZeros(barcode);
    if (cleanBarcode === cleanItem) return true;
    if (cleanItem.length > cleanBarcode.length && cleanItem.endsWith(cleanBarcode)) return true;
  }

  return false;
};

/** Turns a parsed label into a quantity in kg for the given product (null if it cannot be worked out) */
export const quantityFromScaleLabel = (
  parsed: ParsedScaleBarcode,
  product: any,
  usdExchangeRate: number = 1500
): number | null => {
  let qty = parsed.value;

  if (parsed.valueType === 'price') {
    const isUsd = Boolean(product?.isUsdMode);
    const usdPrice = Number(product?.usdPrice) || 0;
    const unitPriceIqd = Number(product?.price) || 0;
    const rate = Number(usdExchangeRate) || 1500;

    if (isUsd && usdPrice > 0) {
      // Product priced in USD (e.g. $45 / kg)
      if (parsed.value < 500) {
        // Label total price is in USD ($2.70)
        qty = parsed.value / usdPrice;
      } else {
        // Label total price was in IQD
        const usdVal = parsed.value / rate;
        qty = usdVal / usdPrice;
      }
    } else if (unitPriceIqd > 0) {
      // Product priced in IQD (e.g. 26,000 IQD / kg)
      if (parsed.value < 500) {
        // Scale entered in thousands (e.g. 26.00 = 26,000 IQD, 7.02 = 7,020 IQD)
        const totalIqd = parsed.value * 1000;
        qty = totalIqd / unitPriceIqd;
      } else {
        // Label total price is already in IQD
        qty = parsed.value / unitPriceIqd;
      }
    } else if (usdPrice > 0) {
      qty = parsed.value / usdPrice;
    } else {
      return null;
    }
  }

  qty = Number(qty.toFixed(3));
  return qty > 0 ? qty : null;
};

/** Computes the raw line price in IQD for a parsed scale barcode and product */
export const rawIqdPriceFromScaleLabel = (
  parsed: ParsedScaleBarcode,
  product: any,
  qty: number,
  isWholesale: boolean = false,
  usdExchangeRate: number = 1500
): number => {
  if (parsed.valueType === 'price') {
    if (product?.isUsdMode) {
      return parsed.value < 500 ? parsed.value * (usdExchangeRate || 1500) : parsed.value;
    }
    // IQD-priced product: values < 500 on scale label represent thousands (e.g. 7.02 -> 7,020 IQD)
    return parsed.value < 500 ? parsed.value * 1000 : parsed.value;
  }
  const unitPrice = isWholesale ? (product?.wholesalePrice || product?.price || 0) : (product?.price || 0);
  return unitPrice * qty;
};
