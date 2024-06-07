import {
  EventArgs,
  type MethodLike,
  type StandardConstructor
} from 'ts-lib-extended';

export type ResolveMode = 'singleton' | 'unique' | 'deep-unique';
export type ErrorKind = 'duplicate' | 'missing';
export type InjectionKey<T = any> = symbol & NonNullable<Omit<T, keyof T>>; // added "magic" that keeps it generic, otherwise T will be lost and InjectionKey<T> resolves to "symbol"
export type Identifier<T = any> = StandardConstructor<T> | InjectionKey<T>;
// export type IdentifierInstanceType<ID extends Identifier> = ID extends InjectionKey<infer P> ? P : ID extends StandardConstructor<infer P> ? P : never;

export type InstanceInstruction<T> = (mode_: ResolveMode) => T;
export type ConstructableParameters<
  C extends StandardConstructor,
  CP extends ConstructorParameters<C> = ConstructorParameters<C>
> = {
  [K in keyof CP]: CP[K] extends MethodLike
    ? CP[K]
    : CP[K] extends Array<any>
    ? CP[K]
    : CP[K] extends object
    ? StandardConstructor<CP[K]> | InjectionKey<CP[K]>
    : CP[K];
} extends [...infer P]
  ? P
  : never;

export type ProvisioningParameters<I extends Identifier> = I extends Identifier<infer P> ? I extends StandardConstructor
  ? ConstructableParameters<I>
  : [StandardConstructor<P>]
  :never;

export class InstanceEventArgs<T> extends EventArgs<{
  identifier: Identifier<T>;
  instance: T;
}> {}
