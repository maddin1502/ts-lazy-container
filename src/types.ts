import {
  EventArgs,
  type MethodLike,
  type StandardConstructor
} from 'ts-lib-extended';
import type { InjectionKey } from './injectionKey.js';

export type ResolveMode = 'singleton' | 'unique' | 'deep-unique';
export type ErrorKind = 'duplicate' | 'missing';
export type Identifier<T = unknown> = StandardConstructor<T> | InjectionKey<T>;
export type Instruction<T = unknown> =
  | Identifier<T>
  | Creator<T>;

export type Creator<T = unknown> = (mode_: ResolveMode) => T;
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
