import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface ProContextType {
  isPro: boolean;
  setIsPro: (value: boolean) => void;
  upgradeToPro: () => void;
  downgradeToFree: () => void;
}

const ProContext = createContext<ProContextType | undefined>(undefined);

interface ProProviderProps {
  children: ReactNode;
}

export function ProProvider({ children }: ProProviderProps) {
  const [isPro, setIsPro] = useState(false);

  const upgradeToPro = useCallback(() => {
    setIsPro(true);
  }, []);

  const downgradeToFree = useCallback(() => {
    setIsPro(false);
  }, []);

  return (
    <ProContext.Provider value={{ isPro, setIsPro, upgradeToPro, downgradeToFree }}>
      {children}
    </ProContext.Provider>
  );
}

export function usePro(): ProContextType {
  const context = useContext(ProContext);
  if (context === undefined) {
    throw new Error('usePro must be used within a ProProvider');
  }
  return context;
}

export default ProContext;
