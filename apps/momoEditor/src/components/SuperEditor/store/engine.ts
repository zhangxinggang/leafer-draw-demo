import localforage from 'localforage';

const allStores = new Map<string, any>();

const initStorage = (name: string) => {
  allStores.set(
    name,
    localforage.createInstance({
      storeName: name,
      name: 'super-editor',
      description: 'super-editor数据缓存',
    }),
  );
};

const getStorage = (name: string) => {
  return allStores.get(name);
};

export { getStorage, initStorage };
