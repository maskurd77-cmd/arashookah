export interface PosShortcutsConfig {
  // Main POS screen
  posSearch: string;
  openCheckout: string;
  posFastCode: string;
  toggleWholesale: string;
  holdCart: string;
  openHeldCarts: string;

  // Checkout / Payment modal
  methodCash: string;
  methodFib: string;
  methodDebt: string;
  toggleDebtCustomer: string;
  currencyIqd: string;
  currencyUsd: string;
  fillExact: string;
  clearAmount: string;
  addTripleZero: string;
  quickAmount1: string;
  quickAmount2: string;
  quickAmount3: string;
  quickAmount4: string;
  quickAmount5: string;
  checkoutComplete: string;
  checkoutThermal: string;
  checkoutA4: string;
  closeCheckout: string;
}

export type ShortcutActionId = keyof PosShortcutsConfig;
export type ShortcutGroup = 'checkout' | 'main';

export interface ShortcutMeta {
  id: ShortcutActionId;
  group: ShortcutGroup;
  label: string;
  description: string;
}

export const DEFAULT_POS_SHORTCUTS: PosShortcutsConfig = {
  // Main POS screen
  posSearch: 'F1',
  openCheckout: 'F2',
  posFastCode: 'F3',
  toggleWholesale: 'F4',
  holdCart: 'F6',
  openHeldCarts: 'F7',

  // Checkout / Payment modal
  methodCash: 'F1',
  methodFib: 'F2',
  methodDebt: 'F3',
  toggleDebtCustomer: 'Alt+N',
  currencyIqd: 'F4',
  currencyUsd: 'F6',
  fillExact: 'F7',
  clearAmount: 'Del',
  addTripleZero: '*',
  quickAmount1: 'Alt+1',
  quickAmount2: 'Alt+2',
  quickAmount3: 'Alt+3',
  quickAmount4: 'Alt+4',
  quickAmount5: 'Alt+5',
  checkoutComplete: 'F8',
  checkoutThermal: 'F9',
  checkoutA4: 'F10',
  closeCheckout: 'Esc',
};

export const SHORTCUT_METADATA: ShortcutMeta[] = [
  // Checkout / Payment Modal shortcuts
  { id: 'methodCash', group: 'checkout', label: 'پارەدان بە نەقد', description: 'هەڵبژاردنی شێوازی نەقد لە پەنجەرەی پارەداندا' },
  { id: 'methodFib', group: 'checkout', label: 'پارەدان بە FIB', description: 'هەڵبژاردنی شێوازی FIB لە پەنجەرەی پارەداندا' },
  { id: 'methodDebt', group: 'checkout', label: 'پارەدان بە قەرز', description: 'هەڵبژاردنی شێوازی قەرز لە پەنجەرەی پارەداندا' },
  { id: 'toggleDebtCustomer', group: 'checkout', label: 'کڕیاری پێشوو / نوێ', description: 'گۆڕینی نێوان کڕیاری پێشوو و کڕیاری نوێ لە دۆخی قەرزدا' },
  { id: 'currencyIqd', group: 'checkout', label: 'دراوی دینار (IQD)', description: 'گۆڕینی دراوی پارەدان بۆ دینار' },
  { id: 'currencyUsd', group: 'checkout', label: 'دراوی دۆلار ($ USD)', description: 'گۆڕینی دراوی پارەدان بۆ دۆلار' },
  { id: 'fillExact', group: 'checkout', label: 'پارەی تەواو', description: 'پڕکردنەوەی تەواوی بڕی داواکاری بە یەک کلیک' },
  { id: 'clearAmount', group: 'checkout', label: 'سڕینەوەی بڕی پارە (C)', description: 'سفرکردنەوەی پارەی وەرگیراو' },
  { id: 'addTripleZero', group: 'checkout', label: 'زیادکردنی 000', description: 'زیادکردنی سێ سفر لە کیپادی دیناردا' },
  { id: 'quickAmount1', group: 'checkout', label: 'بڕی خێرا ١ (+5,000 / +$5)', description: 'زیادکردنی یەکەم دوگمەی بڕی خێرا' },
  { id: 'quickAmount2', group: 'checkout', label: 'بڕی خێرا ٢ (+10,000 / +$10)', description: 'زیادکردنی دووەم دوگمەی بڕی خێرا' },
  { id: 'quickAmount3', group: 'checkout', label: 'بڕی خێرا ٣ (+25,000 / +$20)', description: 'زیادکردنی سێیەم دوگمەی بڕی خێرا' },
  { id: 'quickAmount4', group: 'checkout', label: 'بڕی خێرا ٤ (+50,000 / +$50)', description: 'زیادکردنی چوارەم دوگمەی بڕی خێرا' },
  { id: 'quickAmount5', group: 'checkout', label: 'بڕی خێرا ٥ (+$100)', description: 'زیادکردنی پێنجەم دوگمەی بڕی خێرا (دۆلار)' },
  { id: 'checkoutComplete', group: 'checkout', label: 'تەواوکردن (بێ چاپ)', description: 'تەواوکردنی فرۆشتن بە بێ دەرکردنی وەسڵ' },
  { id: 'checkoutThermal', group: 'checkout', label: 'وەسڵی بچووک (Thermal)', description: 'تەواوکردن و چاپکردنی وەسڵی کاشێر' },
  { id: 'checkoutA4', group: 'checkout', label: 'وەسڵی A4', description: 'تەواوکردن و چاپکردنی وەسڵی A4' },
  { id: 'closeCheckout', group: 'checkout', label: 'پاشگەزبوونەوە / داخستن', description: 'داخستنی پەنجەرەی پارەدان' },

  // Main POS screen shortcuts
  { id: 'openCheckout', group: 'main', label: 'کردنەوەی پارەدان', description: 'کردنەوەی پەنجەرەی پارەدان لە شاشەی کاشێر' },
  { id: 'posSearch', group: 'main', label: 'گەڕانی کاڵا', description: 'چوونە سەر خانەی گەڕان بە ناو یان بارکۆد' },
  { id: 'posFastCode', group: 'main', label: 'کۆدی خێرا / بارکۆد', description: 'چوونە سەر خانەی کۆدی خێرا' },
  { id: 'toggleWholesale', group: 'main', label: 'مفرد ↔ جملە', description: 'گۆڕینی نرخی فرۆشتن نێوان تاک و کۆ' },
  { id: 'holdCart', group: 'main', label: 'ڕاگرتنی سەبەتە', description: 'هەڵپەساردنی سەبەتەی ئێستا بۆ دواتر' },
  { id: 'openHeldCarts', group: 'main', label: 'سەبەتە ڕاگیراوەکان', description: 'کردنەوەی لیستی سەبەتە ڕاگیراوەکان' },
];

export const getPosShortcuts = (raw: any): PosShortcutsConfig => {
  const result: PosShortcutsConfig = { ...DEFAULT_POS_SHORTCUTS };
  if (raw && typeof raw === 'object') {
    for (const key of Object.keys(DEFAULT_POS_SHORTCUTS) as ShortcutActionId[]) {
      if (typeof raw[key] === 'string') {
        result[key] = raw[key];
      }
    }
    return result;
  }
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const cached = window.localStorage.getItem('pos-shortcuts');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object') {
          for (const key of Object.keys(DEFAULT_POS_SHORTCUTS) as ShortcutActionId[]) {
            if (typeof parsed[key] === 'string') {
              result[key] = parsed[key];
            }
          }
        }
      }
    }
  } catch {
    // ignore storage errors
  }
  return result;
};

const MODIFIER_ONLY_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta', 'OS']);

/** Converts a KeyboardEvent to a canonical layout-independent shortcut string, or null if unsupported */
export const eventToShortcutCombo = (e: KeyboardEvent): string | null => {
  if (MODIFIER_ONLY_KEYS.has(e.key)) return null;

  let baseKey = '';

  if (/^F([1-9]|1[0-2])$/.test(e.key)) {
    baseKey = e.key;
  } else if (e.key === 'Escape') {
    baseKey = 'Esc';
  } else if (e.key === 'Enter' || e.code === 'NumpadEnter') {
    baseKey = 'Enter';
  } else if (e.code === 'Space' || e.key === ' ') {
    baseKey = 'Space';
  } else if (e.key === 'Backspace') {
    baseKey = 'Backspace';
  } else if (e.key === 'Delete') {
    baseKey = 'Del';
  } else if (e.key === 'Insert') {
    baseKey = 'Ins';
  } else if (e.key === 'Home') {
    baseKey = 'Home';
  } else if (e.key === 'End') {
    baseKey = 'End';
  } else if (e.key === 'PageUp') {
    baseKey = 'PgUp';
  } else if (e.key === 'PageDown') {
    baseKey = 'PgDn';
  } else if (e.key === 'ArrowUp') {
    baseKey = 'Up';
  } else if (e.key === 'ArrowDown') {
    baseKey = 'Down';
  } else if (e.key === 'ArrowLeft') {
    baseKey = 'Left';
  } else if (e.key === 'ArrowRight') {
    baseKey = 'Right';
  } else if (e.key === '*' || e.code === 'NumpadMultiply') {
    baseKey = '*';
  } else if (e.key === '+' || e.code === 'NumpadAdd') {
    baseKey = '+';
  } else if (e.key === '-' || e.code === 'NumpadSubtract') {
    baseKey = '-';
  } else if (e.key === '/' || e.code === 'NumpadDivide') {
    baseKey = '/';
  } else if (/^(Digit|Numpad)([0-9])$/.test(e.code)) {
    baseKey = e.code.slice(-1);
  } else if (/^Key([A-Z])$/.test(e.code)) {
    baseKey = e.code.slice(3);
  } else if (e.key.length === 1) {
    baseKey = e.key.toUpperCase();
  } else {
    return null;
  }

  const parts: string[] = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  // Avoid adding Shift+ when user pressed '*' on main keyboard (Shift+8 produces '*')
  if (e.shiftKey && baseKey !== '*' && baseKey !== '+') {
    parts.push('Shift');
  }
  parts.push(baseKey);
  return parts.join('+');
};

/** Checks whether a KeyboardEvent matches a configured shortcut string */
export const matchesShortcut = (e: KeyboardEvent, combo: string | undefined): boolean => {
  const target = (combo || '').trim();
  if (!target) return false;
  const pressed = eventToShortcutCombo(e);
  return pressed !== null && pressed.toLowerCase() === target.toLowerCase();
};

/** True when a shortcut uses modifiers, an F-key, or Esc (safe to fire even inside text inputs) */
export const isGlobalSafeShortcut = (combo: string | undefined): boolean => {
  const s = (combo || '').trim();
  if (!s) return false;
  return /^(Ctrl\+|Alt\+)/i.test(s) || /^F([1-9]|1[0-2])$/i.test(s) || /^Esc$/i.test(s);
};
