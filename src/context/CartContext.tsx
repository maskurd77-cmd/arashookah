import React, { createContext, useContext, useState, useEffect } from 'react';

export interface CartItem {
  id: string;
  name: string;
  price: number; // Retail price
  wholesalePrice: number;
  packSize: number;
  costPrice: number;
  wholesaleCost: number;
  quantity: number;
  barcode: string;
  isWeighed?: boolean;
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
  clearCart: () => void;
  discount: number;
  setDiscount: (discount: number) => void;
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
  clearCart: () => {},
  discount: 0,
  setDiscount: () => {},
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
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>([]);

  // Load cart from localStorage
  useEffect(() => {
    const savedCart = localStorage.getItem('pos-cart');
    const savedDiscount = localStorage.getItem('pos-discount');
    const savedHeldCarts = localStorage.getItem('pos-held-carts');
    if (savedCart) setCart(JSON.parse(savedCart));
    if (savedDiscount) setDiscount(Number(savedDiscount));
    if (savedHeldCarts) setHeldCarts(JSON.parse(savedHeldCarts));
  }, []);

  // Save cart to localStorage
  useEffect(() => {
    localStorage.setItem('pos-cart', JSON.stringify(cart));
    localStorage.setItem('pos-discount', discount.toString());
    localStorage.setItem('pos-held-carts', JSON.stringify(heldCarts));
  }, [cart, discount, heldCarts]);

  const addToCart = (product: any, quantity = 1) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item
        );
      }
      return [...prev, { 
        id: product.id, 
        name: product.name, 
        price: product.price, 
        wholesalePrice: product.wholesalePrice || 0,
        packSize: product.packSize || 1,
        costPrice: product.costPrice || 0, 
        wholesaleCost: product.wholesaleCost || 0,
        quantity, 
        barcode: product.barcode, 
        isWeighed: product.isWeighed 
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

  const clearCart = () => {
    setCart([]);
    setDiscount(0);
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
      setHeldCarts(heldCarts.filter(hc => hc.id !== id));
    }
  };

  const removeHeldCart = (id: string) => {
    setHeldCarts(heldCarts.filter(hc => hc.id !== id));
  };

  const subtotal = Math.round(cart.reduce((acc, item) => {
    if (item.isWeighed || item.packSize <= 1 || !item.wholesalePrice) {
      return acc + item.price * item.quantity;
    }
    const packs = Math.floor(item.quantity / item.packSize);
    const pieces = item.quantity % item.packSize;
    return acc + (packs * item.wholesalePrice) + (pieces * item.price);
  }, 0));
  
  const total = Math.round(Math.max(0, subtotal - discount));

  return (
    <CartContext.Provider
      value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart, discount, setDiscount, subtotal, total, heldCarts, holdCart, resumeCart, removeHeldCart }}
    >
      {children}
    </CartContext.Provider>
  );
};

