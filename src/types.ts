import type { MethodLike, StandardConstructor } from 'ts-lib-extended';

export type ErrorKind = 'duplicate' | 'missing';
export type InstanceInstruction<T> = () => T;
export type ConstructableParameters<
  C extends StandardConstructor,
  CP extends ConstructorParameters<C> = ConstructorParameters<C>
> = {
  [K in keyof CP]: CP[K] extends MethodLike
    ? CP[K]
    : CP[K] extends Array<any>
    ? CP[K]
    : CP[K] extends object
    ? StandardConstructor<CP[K]>
    : CP[K];
} extends [...infer P]
  ? P
  : never;
