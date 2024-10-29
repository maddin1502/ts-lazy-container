import type { InjectionKey } from './types.js';

export function injectionKey<T>(description_?: string): InjectionKey<T> {
  return Symbol(
    description_ ?? 'injection key without description'
  ) as InjectionKey<T>;
}
