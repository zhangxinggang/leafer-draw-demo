import { create } from 'zustand';

export interface ImageItem {
  id: string;
  name: string;
  src: string;
  category: string;
}

export interface ImageStore {
  images: ImageItem[];
  searchKeyword: string;
  selectedCategory: string;

  addImage: (image: Omit<ImageItem, 'id'>) => void;
  removeImage: (id: string) => void;
  updateImage: (id: string, updates: Partial<ImageItem>) => void;
  setSearchKeyword: (keyword: string) => void;
  setSelectedCategory: (category: string) => void;
  getFilteredImages: () => ImageItem[];
  getCategories: () => string[];
}

// 生成临时图片名称（不重复）
function generateTempImageName(existingNames: string[]): string {
  let index = 1;
  let name = `临时图片${index}`;
  while (existingNames.includes(name)) {
    index++;
    name = `临时图片${index}`;
  }
  return name;
}

const useImageStore = create<ImageStore>((set, get) => ({
  images: [],
  searchKeyword: '',
  selectedCategory: '全部',

  addImage: (image) => {
    const existingNames = get().images.map((img) => img.name);
    const name = image.name || generateTempImageName(existingNames);
    const newImage: ImageItem = {
      ...image,
      id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
    };
    set((state) => ({ images: [...state.images, newImage] }));
  },

  removeImage: (id) => {
    set((state) => ({ images: state.images.filter((img) => img.id !== id) }));
  },

  updateImage: (id, updates) => {
    set((state) => ({
      images: state.images.map((img) => (img.id === id ? { ...img, ...updates } : img)),
    }));
  },

  setSearchKeyword: (keyword) => {
    set({ searchKeyword: keyword });
  },

  setSelectedCategory: (category) => {
    set({ selectedCategory: category });
  },

  getFilteredImages: () => {
    const { images, searchKeyword, selectedCategory } = get();
    let filtered = images;

    // 按分类过滤
    if (selectedCategory && selectedCategory !== '全部') {
      filtered = filtered.filter((img) => img.category === selectedCategory);
    }

    // 按关键词搜索
    if (searchKeyword) {
      const keyword = searchKeyword.toLowerCase();
      filtered = filtered.filter(
        (img) =>
          img.name.toLowerCase().includes(keyword) || img.category.toLowerCase().includes(keyword),
      );
    }

    return filtered;
  },

  getCategories: () => {
    const { images } = get();
    const categories = new Set<string>(images.map((img) => img.category));
    return Array.from(categories);
  },
}));

export default useImageStore;
