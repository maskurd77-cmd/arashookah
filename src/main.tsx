import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ShiftProvider } from './context/ShiftContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <CartProvider>
        <ShiftProvider>
          <App />
        </ShiftProvider>
      </CartProvider>
    </AuthProvider>
  </StrictMode>,
);
