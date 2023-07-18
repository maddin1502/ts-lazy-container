import { ConstructorParameters, StandardConstructor } from 'ts-lib-extended';

export type InstanceInstruction<T> = () => T;
export type ConstructableParameters<
  C extends StandardConstructor,
  CP extends ConstructorParameters<C> = ConstructorParameters<C>
> = { [K in keyof CP]: StandardConstructor<CP[K]> } extends [...infer P]
  ? P
  : never;

type LazyContainerSource = {
  has<T>(constructor: StandardConstructor<T>): boolean;
  delete<C extends StandardConstructor>(constructor: C): boolean;
  get<T>(
    constructor: StandardConstructor<T>
  ): InstanceInstruction<T> | undefined;
  set<T>(
    constructor: StandardConstructor<T>,
    instruction: InstanceInstruction<T>
  ): LazyContainerSource;
};

export class LazyContainer {
  private readonly _instanceSource: LazyContainerSource;
  private readonly _instructionSource: LazyContainerSource;

  constructor() {
    this._instanceSource = new Map();
    this._instructionSource = new Map();
  }

  public instruct<T>(
    constructor_: StandardConstructor<T>,
    instruction_: InstanceInstruction<T>
  ): void | never {
    this.validateKnown(constructor_);
    this._instructionSource.set(constructor_, instruction_);
  }

  public provide<T, C extends StandardConstructor<T>>(
    constructor_: C,
    ...parameters_: ConstructableParameters<C>
  ): void | never {
    this.validateKnown(constructor_);
    const resolvedParameters = parameters_.map((parameter_) =>
      this.resolve(parameter_ as StandardConstructor<unknown>)
    ) as ConstructorParameters<C>;
    this.instruct(constructor_, () => new constructor_(...resolvedParameters));
  }

  public resolve<T>(constructor_: StandardConstructor<T>): T | never {
    const instanceGetter = this.resolveInstanceGetter<T>(constructor_);

    if (instanceGetter) {
      return instanceGetter();
    }

    throw new Error(
      `[container/resolve]: "${constructor_.name}" could not be resolved`
    );
  }

  private validateKnown<C extends StandardConstructor>(
    constructor_: C
  ): void | never {
    if (
      this._instanceSource.has<C>(constructor_) ||
      this._instructionSource.has<C>(constructor_)
    ) {
      throw new Error(
        `[container/validateKnown]: "${constructor_.name}" already configured`
      );
    }
  }

  private resolveInstanceGetter<T>(
    constructor_: StandardConstructor<T>
  ): InstanceInstruction<T> | undefined {
    return (
      this._instanceSource.get(constructor_) ??
      this.resolveInstruction(constructor_)
    );
  }

  private resolveInstruction<T>(
    constructor_: StandardConstructor<T>
  ): InstanceInstruction<T> | undefined {
    const instruction = this._instructionSource.get(constructor_);

    if (instruction) {
      const instance = instruction();
      this._instanceSource.set<T>(constructor_, () => instance);
      this._instructionSource.delete(constructor_);
      return () => instance;
    }
  }
}
