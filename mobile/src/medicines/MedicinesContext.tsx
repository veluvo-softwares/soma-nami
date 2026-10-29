import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { MedicineStore, MemoryMedicineStorage, type MedicineStorage, type SavedMedicine } from './medicines';

const Ctx = createContext<{ store: MedicineStore; items: readonly SavedMedicine[] } | null>(null);

/** Loads Dawa zangu once and re-renders whoever shows it when it changes. */
export function MedicinesProvider({ storage, children }: { storage: MedicineStorage; children: ReactNode }) {
  const store = useMemo(() => new MedicineStore(storage), [storage]);
  const [items, setItems] = useState<readonly SavedMedicine[]>([]);
  useEffect(() => {
    const off = store.subscribe(() => setItems(store.list()));
    void store.load();
    return off;
  }, [store]);
  const value = useMemo(() => ({ store, items }), [store, items]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

const fallbackStore = new MedicineStore(new MemoryMedicineStorage());

/** Outside a provider (screen tests) the list is empty and lives in memory. */
export function useMedicines() {
  return useContext(Ctx) ?? { store: fallbackStore, items: [] as readonly SavedMedicine[] };
}
