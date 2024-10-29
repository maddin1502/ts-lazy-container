import {
  EventArgs,
  type MethodLike,
  type StandardConstructor
} from 'ts-lib-extended';

export type ResolveMode = 'singleton' | 'unique' | 'deep-unique';
export type ErrorKind = 'duplicate' | 'missing';
export type InjectionKey<T = unknown> = symbol & NonNullable<Omit<T, keyof T>>; // added "magic" that keeps it generic, otherwise T will be lost and InjectionKey<T> resolves to "symbol"
export type Identifier<T = unknown> = StandardConstructor<T> | InjectionKey<T>;

export type InstanceInstruction<T> = (mode_: ResolveMode) => T;
export type ConstructableParameters<C extends StandardConstructor> =
  Constructables<ConstructorParameters<C>>;

type Constructables<CP extends ArrayLike<unknown>> = {
  [K in keyof CP]: ConstructableValue<CP[K]>;
} extends [...infer P]
  ? P
  : never;

type ConstructableValue<CPV> = CPV extends MethodLike
  ? CPV
  : CPV extends ArrayLike<unknown>
  ? CPV
  : CPV extends object
  ? StandardConstructor<CPV> | InjectionKey<CPV>
  : CPV;

export type ProvisioningParameters<I extends Identifier> = I extends Identifier<
  infer P
>
  ? I extends StandardConstructor
    ? ConstructableParameters<I>
    : [StandardConstructor<P>]
  : never;

export class InstanceEventArgs<T> extends EventArgs<[Identifier<T>, T]> {}
