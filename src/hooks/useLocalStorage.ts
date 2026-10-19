import { useState, useEffect, Dispatch, SetStateAction } from 'react';

/**
 * Custom hook para sincronizar estado do React com o localStorage do navegador.
 * Lê do localStorage no mount e grava imediatamente a cada alteração.
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, Dispatch<SetStateAction<T>>] {
  // Inicialização preguiçosa: lê do localStorage se existir
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      if (typeof window === 'undefined') {
        return initialValue;
      }
      const item = window.localStorage.getItem(key);
      if (item !== null) {
        return JSON.parse(item) as T;
      }
    } catch (error) {
      console.error(`[useLocalStorage] Erro ao ler a chave "${key}":`, error);
    }
    return initialValue;
  });

  // Atualiza o estado React e grava imediatamente no localStorage
  const setValue: Dispatch<SetStateAction<T>> = (valueAction) => {
    setStoredValue((prev) => {
      const nextValue =
        typeof valueAction === 'function'
          ? (valueAction as (prevState: T) => T)(prev)
          : valueAction;

      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(nextValue));
        }
      } catch (err) {
        console.error(`[useLocalStorage] Erro ao gravar na chave "${key}":`, err);
      }

      return nextValue;
    });
  };

  // Garante sincronização contínua mesmo se o estado for alterado externamente
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(storedValue));
      }
    } catch (error) {
      console.error(`[useLocalStorage] Erro ao sincronizar chave "${key}":`, error);
    }
  }, [key, storedValue]);

  return [storedValue, setValue];
}
