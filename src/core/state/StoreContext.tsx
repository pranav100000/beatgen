import React, { createContext, useContext } from 'react';
import { StoreInterface } from './store';

const StoreContext = createContext<StoreInterface | null>(null);

export const StoreProvider: React.FC<{ store: StoreInterface; children: React.ReactNode }> = ({ 
  store, 
  children 
}) => {
  return (
    <StoreContext.Provider value={store}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = (): StoreInterface => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
}; 