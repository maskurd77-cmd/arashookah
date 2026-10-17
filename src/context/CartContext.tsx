import React, { createContext, useContext, useState, useEffect } from 'react';

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
  addToCart: (product: any, quantity?: number) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
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

  const addToCart = (product: any, quantity = 1) => {
    setCart((prev) => {
      const isAddingGift = product.isGift || false;
      const isWholesale = product.isWholesale || false;
      const originalId = product.originalId || product.id;
      const targetId = `${originalId}${isWholesale ? '-wholesale' : ''}${isAddingGift ? '-gift' : ''}`;
      
      const existing = prev.find((item) => item.id === targetId);
      if (existing) {
        return prev.map((item) =>
          item.id === targetId
            ? { ...item, quantity: item.quantity + quantity } 
            : item
        );
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
        isWeighed: product.isWeighed || false,
        isWholesale: isWholesale,
        isGift: isAddingGift
      }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(id);
      return;
    }
    setCart((prev) => prev.map((item) => (item.id === id ? { ...item, quantity } : item)));
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
    
    // If it's explicitly added as wholesale, use wholesale price directly for the quantity
    if (item.isWholesale) {
      return acc + (item.wholesalePrice || item.price) * item.quantity;
    }

    // If it's a retail item, don't automatically convert to wholesale packs
    // Just use the retail price
    return acc + item.price * item.quantity;
  }, 0));
  
  const total = Math.round(Math.max(0, subtotal - discount + additionalCharge));

  return (
    <CartContext.Provider
      value={{ cart, addToCart, removeFromCart, updateQuantity, toggleGift, clearCart, discount, setDiscount, additionalCharge, setAdditionalCharge, subtotal, total, heldCarts, holdCart, resumeCart, removeHeldCart }}
    >
      {children}
    </CartContext.Provider>
  );
};

