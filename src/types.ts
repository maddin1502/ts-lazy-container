import {
  EventArgs,
  type MethodLike,
  type StandardConstructor
} from 'ts-lib-extended';
import type { InjectionKey } from './injectionKey.js';

export type InjectionMode = 'singleton' | 'unique' | 'deep-unique';
export type ErrorKind = 'duplicate' | 'missing';
export type Identifier<T = unknown> = StandardConstructor<T> | InjectionKey<T>;
export type Instruction<T> = Identifier<T> | Resolver<T>;
export type IdentifierInstruction<I extends Identifier> = I extends Identifier<
  infer T
>
  ? Instruction<T>
  : never;

export type Resolver<T = unknown> = (mode_: InjectionMode) => T;
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
  ? Identifier<CPV>
  : CPV;

export type ProvisioningParameters<I extends Identifier> = I extends Identifier<
  infer T
>
  ? I extends StandardConstructor
    ? ConstructableParameters<I>
    : [StandardConstructor<T>]
  : never;

export class InstanceEventArgs<T> extends EventArgs<[Identifier<T>, T]> {}
