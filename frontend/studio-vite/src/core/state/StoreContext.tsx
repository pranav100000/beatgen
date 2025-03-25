import React, { createContext, useContext } from 'react';
import { Store } from './store';

const StoreContext = createContext<Store | null>(null);

export const StoreProvider: React.FC<{ store: Store; children: React.ReactNode }> = ({ 
  store, 
  children 
}) => {
  return (
    <StoreContext.Provider value={store}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = (): Store => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
}; 