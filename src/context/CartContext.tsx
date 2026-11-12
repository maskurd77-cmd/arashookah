import React, { createContext, useContext, useState, useEffect } from 'react';
import { roundWeighedPrice, getActiveRoundingConfig } from '../utils/scaleBarcode';

export interface CartItem {
  id: string;
  originalId?: string;
  name: string;
  price: number; // Retail price
  wholesalePrice: number;
  packSize: number;
  costPrice: number;
  wholesaleCost: number;
  quantity: number;
  barcode: string;
  isWeighed?: boolean;
  isWholesale?: boolean;
  isGift?: boolean;
  linePrice?: number; // Rounded line total in IQD
  rawLinePrice?: number; // Exact raw line total before rounding
  category?: string;
  returnedQuantity?: number;
  itemDiscount?: number; // Discount applied specifically to this item in IQD
}

export interface AddToCartOptions {
  linePrice?: number;
  rawLinePrice?: number;
  forceSeparateLine?: boolean;
  itemDiscount?: number;
}

export interface HeldCart {
  id: string;
  timestamp: number;
  items: CartItem[];
  discount: number;
  name: string;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: any, quantity?: number, options?: AddToCartOptions) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  setItemDiscount: (id: string, discount: number) => void;
  toggleGift: (id: string) => void;
  clearCart: () => void;
  discount: number;
  setDiscount: (discount: number) => void;
  additionalCharge: number;
  setAdditionalCharge: (charge: number) => void;
  subtotal: number;
  total: number;
  heldCarts: HeldCart[];
  holdCart: (name: string) => void;
  resumeCart: (id: string) => void;
  removeHeldCart: (id: string) => void;
}

const CartContext = createContext<CartContextType>({
  cart: [],
  addToCart: () => {},
  removeFromCart: () => {},
  updateQuantity: () => {},
  setItemDiscount: () => {},
  toggleGift: () => {},
  clearCart: () => {},
  discount: 0,
  setDiscount: () => {},
  additionalCharge: 0,
  setAdditionalCharge: () => {},
  subtotal: 0,
  total: 0,
  heldCarts: [],
  holdCart: () => {},
  resumeCart: () => {},
  removeHeldCart: () => {},
});

export const useCart = () => useContext(CartContext);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [additionalCharge, setAdditionalCharge] = useState(0);
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>([]);

  // Load cart from localStorage
  useEffect(() => {
    const savedCart = localStorage.getItem('pos-cart');
    const savedDiscount = localStorage.getItem('pos-discount');
    const savedCharge = localStorage.getItem('pos-additional-charge');
    const savedHeldCarts = localStorage.getItem('pos-held-carts');
    if (savedCart) setCart(JSON.parse(savedCart));
    if (savedDiscount) setDiscount(Number(savedDiscount));
    if (savedCharge) setAdditionalCharge(Number(savedCharge));
    if (savedHeldCarts) setHeldCarts(JSON.parse(savedHeldCarts));
  }, []);

  // Save cart to localStorage
  useEffect(() => {
    localStorage.setItem('pos-cart', JSON.stringify(cart));
    localStorage.setItem('pos-discount', discount.toString());
    localStorage.setItem('pos-additional-charge', additionalCharge.toString());
    localStorage.setItem('pos-held-carts', JSON.stringify(heldCarts));
  }, [cart, discount, additionalCharge, heldCarts]);

  const addToCart = (product: any, quantity = 1, options?: AddToCartOptions) => {
    setCart((prev) => {
      const isAddingGift = product.isGift || false;
      const isWholesale = product.isWholesale || false;
      const isWeighed = Boolean(product.isWeighed);
      const originalId = product.originalId || product.id;

      // Weighed items with specific price/sticker are kept as individual lines
      const forceSeparate = Boolean(options?.forceSeparateLine || (isWeighed && (options?.linePrice !== undefined || product.scaleCode)));
      const targetId = forceSeparate
        ? `${originalId}-weighed-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        : `${originalId}${isWholesale ? '-wholesale' : ''}${isAddingGift ? '-gift' : ''}`;
      
      const existing = !forceSeparate ? prev.find((item) => item.id === targetId) : null;
      if (existing) {
        const newQty = existing.quantity + quantity;
        let linePrice = existing.linePrice;
        let rawLinePrice = existing.rawLinePrice;

        if (existing.isWeighed && !existing.isGift) {
          const unitPrice = existing.isWholesale ? (existing.wholesalePrice || existing.price) : existing.price;
          const raw = (unitPrice || 0) * newQty;
          const res = roundWeighedPrice(raw, getActiveRoundingConfig());
          linePrice = res.rounded;
          rawLinePrice = res.raw;
        }

        return prev.map((item) =>
          item.id === targetId
            ? { ...item, quantity: newQty, linePrice, rawLinePrice } 
            : item
        );
      }
      
      let linePrice = options?.linePrice ?? product.linePrice;
      let rawLinePrice = options?.rawLinePrice ?? product.rawLinePrice;

      if (linePrice === undefined && isWeighed && !isAddingGift) {
        const unitPrice = isWholesale ? (product.wholesalePrice || product.price) : product.price;
        const raw = (unitPrice || 0) * quantity;
        const res = roundWeighedPrice(raw, getActiveRoundingConfig());
        linePrice = res.rounded;
        rawLinePrice = res.raw;
      }

      return [...prev, { 
        id: targetId, 
        originalId: originalId, // Keep original ID for inventory updates
        name: product.name || '', 
        price: product.price || 0, 
        wholesalePrice: product.wholesalePrice || 0,
        packSize: product.packSize || 1,
        costPrice: product.costPrice || 0, 
        wholesaleCost: product.wholesaleCost || 0,
        quantity, 
        barcode: product.barcode || '', 
        isWeighed: isWeighed,
        isWholesale: isWholesale,
        isGift: isAddingGift,
        linePrice: isAddingGift ? 0 : linePrice,
        rawLinePrice: isAddingGift ? 0 : rawLinePrice,
        itemDiscount: isAddingGift ? 0 : (options?.itemDiscount ?? product.itemDiscount ?? 0),
      }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const setItemDiscount = (id: string, discount: number) => {
    setCart((prev) => prev.map((item) => {
      if (item.id !== id) return item;
      const clean = Math.max(0, Math.round(Number(discount) || 0));
      return { ...item, itemDiscount: clean };
    }));
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(id);
      return;
    }
    setCart((prev) => prev.map((item) => {
      if (item.id !== id) return item;

      let linePrice = item.linePrice;
      let rawLinePrice = item.rawLinePrice;

      if (item.isWeighed && !item.isGift) {
        const unitPrice = item.isWholesale ? (item.wholesalePrice || item.price) : item.price;
        const raw = (unitPrice || 0) * quantity;
        const res = roundWeighedPrice(raw, getActiveRoundingConfig());
        linePrice = res.rounded;
        rawLinePrice = res.raw;
      }

      return { ...item, quantity, linePrice, rawLinePrice };
    }));
  };

  const toggleGift = (id: string) => {
    setCart((prev) => {
      const itemToToggle = prev.find(item => item.id === id);
      if (!itemToToggle) return prev;

      const newIsGift = !itemToToggle.isGift;
      const baseId = itemToToggle.originalId || itemToToggle.id.replace('-wholesale', '').replace('-gift', '');
      const newId = `${baseId}${itemToToggle.isWholesale ? '-wholesale' : ''}${newIsGift ? '-gift' : ''}`;

      const existingTarget = prev.find(item => item.id === newId);

      if (existingTarget) {
        // Merge quantities if the target state already exists
        return prev
          .map(item => item.id === newId ? { ...item, quantity: item.quantity + itemToToggle.quantity } : item)
          .filter(item => item.id !== id);
      } else {
        // Just update the current item's id and status
        return prev.map(item => item.id === id ? { ...item, id: newId, isGift: newIsGift } : item);
      }
    });
  };

  const clearCart = () => {
    setCart([]);
    setDiscount(0);
    setAdditionalCharge(0);
  };

  const holdCart = (name: string) => {
    if (cart.length === 0) return;
    const newHeldCart: HeldCart = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      items: [...cart],
      discount,
      name: name || `کڕیاری ${heldCarts.length + 1}`
    };
    setHeldCarts([...heldCarts, newHeldCart]);
    clearCart();
  };

  const resumeCart = (id: string) => {
    const heldCart = heldCarts.find(hc => hc.id === id);
    if (heldCart) {
      setCart(heldCart.items);
      setDiscount(heldCart.discount);
      setAdditionalCharge(0);
      setHeldCarts(heldCarts.filter(hc => hc.id !== id));
    }
  };

  const removeHeldCart = (id: string) => {
    setHeldCarts(heldCarts.filter(hc => hc.id !== id));
  };

  const subtotal = Math.round(cart.reduce((acc, item) => {
    if (item.isGift) return acc;
    
    let lineTotal = 0;
    // Weighed item with cash rounding to nearest 250 IQD
    if (item.linePrice !== undefined && item.linePrice !== null) {
      lineTotal = item.linePrice;
    } else if (item.isWholesale) {
      lineTotal = (item.wholesalePrice || item.price) * item.quantity;
    } else {
      lineTotal = item.price * item.quantity;
    }

    const itemDisc = Math.max(0, Number(item.itemDiscount) || 0);
    const effectiveTotal = Math.max(0, lineTotal - itemDisc);

    return acc + effectiveTotal;
  }, 0));
  
  const total = Math.round(Math.max(0, subtotal - discount + additionalCharge));

  return (
    <CartContext.Provider
      value={{ cart, addToCart, removeFromCart, updateQuantity, setItemDiscount, toggleGift, clearCart, discount, setDiscount, additionalCharge, setAdditionalCharge, subtotal, total, heldCarts, holdCart, resumeCart, removeHeldCart }}
    >
      {children}
    </CartContext.Provider>
  );
};

