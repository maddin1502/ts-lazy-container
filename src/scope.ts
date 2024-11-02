import { Disposable } from 'ts-lib-extended';

export type ScopeMode = 'inherited' | 'isolated';
type ScopeSource<T extends Disposable> = Map<PropertyKey, Scope<T>>;
type CreateScopedInstance<T> = (scopeMode_: ScopeMode) => T;

export class Scopes<T extends Disposable> extends Disposable {
  private readonly _source: ScopeSource<T>;

  constructor(private _create: CreateScopedInstance<T>) {
    super();
    this._source = new Map();

    this._disposers.push(() => {
      this._source.forEach((scope_) => scope_.dispose());
      this._source.clear();
    });
  }

  public get(id_: PropertyKey) {
    this.validateDisposed(this);
    let scope = this._source.get(id_);

    if (!scope) {
      scope = new Scope((...params_) => this._create(...params_));
      this._source.set(id_, scope);
    }

    return scope;
  }

  public forEach(handler_: (instance_: T) => void) {
    this.validateDisposed(this);
    this._source.forEach(({ inherited, isolated }) => {
      handler_(inherited);
      handler_(isolated);
    });
  }
}

export class Scope<T extends Disposable> extends Disposable {
  private _isolated: T | undefined;
  private _inherited: T | undefined;

  constructor(private _create: CreateScopedInstance<T>) {
    super();

    this._disposers.push(() => {
      this._isolated = undefined;
      this._inherited = undefined;
    });
  }

  /**
   * create/use a sub container that is able to access instances from its parent container (can override it)
   *
   * @public
   * @readonly
   * @returns {T}
   * @since 1.0.0
   */
  public get inherited(): T {
    this.validateDisposed(this);
    return (this._inherited ??= this._create('inherited'));
  }

  /**
   * create/use a sub container that is isolated from its parent container (no access to instances)
   *
   * @public
   * @readonly
   * @returns {T}
   * @since 1.0.0
   */
  public get isolated(): T {
    this.validateDisposed(this);
    return (this._isolated ??= this._create('isolated'));
  }
}
