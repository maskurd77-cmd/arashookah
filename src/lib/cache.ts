// Professional High-Performance Cache & Delta Sync Manager
// Eliminates read amplification and handles incremental updates via docChanges()

interface CacheStore {
  companies: any[] | null;
  categories: string[] | null;
  settings: Record<string, any>;
  productsBySection: Map<string, Map<string, any>>;
  debtsMap: Map<string, any> | null;
}

const store: CacheStore = {
  companies: null,
  categories: null,
  settings: {},
  productsBySection: new Map(),
  debtsMap: null,
};

export const cacheManager = {
  // Companies Cache
  getCompanies: (): any[] | null => store.companies,
  setCompanies: (companies: any[]) => {
    store.companies = companies;
  },
  invalidateCompanies: () => {
    store.companies = null;
  },

  // Categories Cache
  getCategories: (): string[] | null => store.categories,
  setCategories: (categories: string[]) => {
    store.categories = categories;
  },

  // Settings Cache
  getSetting: (key: string): any => store.settings[key],
  setSetting: (key: string, val: any) => {
    store.settings[key] = val;
  },

  // Incremental Product Cache (using snapshot.docChanges())
  getSectionProducts: (section: string): any[] | null => {
    const secMap = store.productsBySection.get(section);
    return secMap ? Array.from(secMap.values()) : null;
  },

  // Delta Sync: Processes only modified/added/deleted docs from Firestore snapshot
  applyProductSnapshotChanges: (section: string, snapshot: any): any[] => {
    if (!store.productsBySection.has(section)) {
      store.productsBySection.set(section, new Map());
    }
    const secMap = store.productsBySection.get(section)!;

    snapshot.docChanges().forEach((change: any) => {
      const id = change.doc.id;
      if (change.type === 'added' || change.type === 'modified') {
        secMap.set(id, { id, ...change.doc.data() });
      } else if (change.type === 'removed') {
        secMap.delete(id);
      }
    });

    return Array.from(secMap.values());
  },

  // Optimistic local updates for zero-latency UI
  upsertProduct: (section: string, product: any) => {
    if (!store.productsBySection.has(section)) {
      store.productsBySection.set(section, new Map());
    }
    store.productsBySection.get(section)!.set(product.id, product);
  },

  removeProduct: (section: string, productId: string) => {
    const secMap = store.productsBySection.get(section);
    if (secMap) {
      secMap.delete(productId);
    }
  },

  // Debts Cache
  getDebts: (): any[] | null => {
    return store.debtsMap ? Array.from(store.debtsMap.values()) : null;
  },
  applyDebtSnapshotChanges: (snapshot: any): any[] => {
    if (!store.debtsMap) {
      store.debtsMap = new Map();
    }
    snapshot.docChanges().forEach((change: any) => {
      const id = change.doc.id;
      if (change.type === 'added' || change.type === 'modified') {
        store.debtsMap!.set(id, { id, ...change.doc.data() });
      } else if (change.type === 'removed') {
        store.debtsMap!.delete(id);
      }
    });
    return Array.from(store.debtsMap.values());
  },

  clearAll: () => {
    store.companies = null;
    store.categories = null;
    store.settings = {};
    store.productsBySection.clear();
    store.debtsMap = null;
  }
};
