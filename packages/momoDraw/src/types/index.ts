export * from './cmp';
export * from './largeScene';
export * from './operation';

export type AnyObj = Record<string, any>;
/** 深度 Partial 属性 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
