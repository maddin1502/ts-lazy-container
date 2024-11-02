const INJECTION_KEY_IDENTIFIER = Symbol();

export type InjectionKeyId<T> = symbol & NonNullable<Omit<T, keyof T>>; // added "magic" that keeps it generic, otherwise T will be lost and InjectionKey<T> resolves to "symbol"
export type InjectionKey<T = unknown> = {
  readonly [INJECTION_KEY_IDENTIFIER]: true;
  readonly id: InjectionKeyId<T>;
};

/**
 * create a typed symbol/identifier to be used with provideKey()
 *
 * @export
 * @template T
 * @param {?string} [name_]
 * @returns {InjectionKey<T>}
 * @since 1.0.0
 */
export function injectionKey<T>(name_?: string): InjectionKey<T> {
  return {
    id: Symbol(name_ ?? 'unnamed') as InjectionKeyId<T>,
    [INJECTION_KEY_IDENTIFIER]: true
  };
}

export function isInjectionKey<T = unknown>(
  value_: unknown
): value_ is InjectionKey<T> {
  return (
    value_ !== null &&
    typeof value_ === 'object' &&
    'id' in value_ &&
    INJECTION_KEY_IDENTIFIER in value_ &&
    typeof value_.id === 'symbol' &&
    value_[INJECTION_KEY_IDENTIFIER] === true
  );
}
