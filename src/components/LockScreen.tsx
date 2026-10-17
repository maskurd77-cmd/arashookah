import React, { useState, useEffect } from 'react';
import { Lock, Delete, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

interface LockScreenProps {
  correctPin: string;
  onUnlock: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ correctPin, onUnlock }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handleNumberClick = (num: string) => {
    if (pin.length < correctPin.length) {
      setPin(prev => prev + num);
      setError(false);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (error) return;
      
      if (e.key >= '0' && e.key <= '9') {
        handleNumberClick(e.key);
      } else if (e.key === 'Backspace') {
        handleDelete();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, error, correctPin]);

  useEffect(() => {
    if (pin.length === correctPin.length) {
      if (pin === correctPin) {
        onUnlock();
      } else {
        setError(true);
        setTimeout(() => {
          setPin('');
          setError(false);
        }, 500);
      }
    }
  }, [pin, correctPin, onUnlock]);

  const numbers = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', 'delete']
  ];

  return (
    <div className="fixed inset-0 z-[100] bg-gray-900 flex flex-col items-center justify-center text-white">
      <div className="mb-8 flex flex-col items-center">
        <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mb-4">
          <Lock size={32} className="text-indigo-400" />
        </div>
        <h1 className="text-2xl font-bold mb-2">شاشە قفڵ کراوە</h1>
        <p className="text-gray-400 text-sm">تکایە پین کۆد بنووسە بۆ کردنەوە</p>
      </div>

      <motion.div 
        animate={error ? { x: [-10, 10, -10, 10, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="flex gap-4 mb-12"
      >
        {Array.from({ length: correctPin.length }).map((_, i) => (
          <div 
            key={i} 
            className={`w-4 h-4 rounded-full transition-colors duration-300 ${
              i < pin.length ? 'bg-indigo-500' : 'bg-gray-700'
            } ${error ? 'bg-red-500' : ''}`}
          />
        ))}
      </motion.div>

      <div className="grid grid-cols-3 gap-6 max-w-xs mx-auto">
        {numbers.map((row, rowIndex) => (
          <React.Fragment key={rowIndex}>
            {row.map((btn, colIndex) => {
              if (btn === '') return <div key={`empty-${rowIndex}-${colIndex}`} />;
              if (btn === 'delete') {
                return (
                  <button
                    key="delete"
                    onClick={handleDelete}
                    className="w-20 h-20 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-800 transition-colors active:bg-gray-700"
                  >
                    <Delete size={28} />
                  </button>
                );
              }
              return (
                <button
                  key={btn}
                  onClick={() => handleNumberClick(btn)}
                  className="w-20 h-20 flex items-center justify-center rounded-full text-3xl font-light hover:bg-gray-800 transition-colors active:bg-gray-700"
                >
                  {btn}
                </button>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
