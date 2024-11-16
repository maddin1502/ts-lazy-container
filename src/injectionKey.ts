const INJECTION_KEY_IDENTIFIER = Symbol();

export type InjectionKey<T = unknown> = {
  /**
   * locked marker for injection key identification
   * required for typescript to keep the injection key type info
   * is ALWAYS undefined
   *
   * @readonly
   * @type {?T}
   * @since 1.0.0
   */
  readonly [INJECTION_KEY_IDENTIFIER]?: T;
  /**
   * unique identifier to differ injections keys from each other
   *
   * @readonly
   * @type {symbol}
   * @since 1.0.0
   */
  readonly id: symbol;
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
    id: Symbol(name_ ?? 'unnamed'),
    [INJECTION_KEY_IDENTIFIER]: undefined
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
    value_[INJECTION_KEY_IDENTIFIER] === undefined
  );
}
