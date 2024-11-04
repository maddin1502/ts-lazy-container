import { Disposable } from 'ts-lib-extended';

export type InstanceScopeHandler<T, Mode extends string> = (
  mode_: Mode,
  instance_: T
) => void;
export type InstanceScope<T, Mode extends string> = {
  readonly [key in Mode]: T;
} & {
  forEach(handler_: InstanceScopeHandler<T, Mode>): void;
};
export type InstanceScopesHandler<T, Mode extends string> = (
  scope_: InstanceScope<T, Mode>
) => void;
export type InstanceScopes<T, Mode extends string> = {
  get(id_: PropertyKey): InstanceScope<T, Mode>;
  forEach(handler_: InstanceScopesHandler<T, Mode>): void;
  forEachInstance(handler_: InstanceScopeHandler<T, Mode>): void;
};




type ScopeMode = 'inherited' | 'isolated';
type ScopeSource<
  T extends Disposable,
  Mode extends ScopeMode
> = Map<Mode, T>;
type ScopesSource<T extends Disposable> = Map<
  PropertyKey,
  Scope<T>
>;
type CreateScopedInstance<T extends Disposable> = (
  mode_: ScopeMode
) => T;

export class Scopes<T extends Disposable>
  extends Disposable
  implements InstanceScopes<T, ScopeMode>
{
  private readonly _source: ScopesSource<T>;

  constructor(private _create: CreateScopedInstance<T>) {
    super();
    this._source = new Map();

    this._disposers.push(() => {
      this._source.forEach((scope_) => scope_.dispose());
      this._source.clear();
    });
  }

  public get(id_: PropertyKey): Scope<T> {
    this.validateDisposed(this);
    let scope = this._source.get(id_);

    if (!scope) {
      scope = new Scope((...params_) => this._create(...params_));
      this._source.set(id_, scope);
    }

    return scope;
  }

  public forEach(
    handler_: InstanceScopesHandler<T, ScopeMode>
  ): void {
    this.validateDisposed(this);
    this._source.forEach((scope_) => handler_(scope_));
  }

  public forEachInstance(
    handler_: InstanceScopeHandler<T, ScopeMode>
  ) {
    this.validateDisposed(this);
    this._source.forEach((scope_) =>
      scope_.forEach((...params_) => handler_(...params_))
    );
  }
}

export class Scope<T extends Disposable>
  extends Disposable
  implements InstanceScope<T, ScopeMode>
{
  private readonly _source: ScopeSource<
    T,
    ScopeMode
  >;

  constructor(private _create: CreateScopedInstance<T>) {
    super();
    this._source = new Map();

    this._disposers.push(() => {
      this.forEach((_, instance_) => instance_.dispose());
      this._source.clear();
    });
  }

  /**
   * create/use an inherited scope that is able to access it's parent
   *
   * @public
   * @readonly
   * @returns {T}
   * @since 1.0.0
   */
  public get inherited(): T {
    this.validateDisposed(this);
    return this.getOrCreateInstance('inherited');
  }

  /**
   * create/use an isolated scope that CANNOT access its parent
   *
   * @public
   * @readonly
   * @returns {T}
   * @since 1.0.0
   */
  public get isolated(): T {
    this.validateDisposed(this);
    return this.getOrCreateInstance('isolated');
  }

  public forEach(
    handler_: InstanceScopeHandler<T, ScopeMode>
  ): void {
    this.validateDisposed(this);
    this._source.forEach((instance_, mode_) => handler_(mode_, instance_));
  }

  private getOrCreateInstance(mode_: ScopeMode): T {
    let instance = this._source.get(mode_);

    if (!instance) {
      instance = this._create(mode_);
      this._source.set(mode_, instance);
    }

    return instance;
  }
}
