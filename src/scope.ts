import { Disposable } from 'ts-lib-extended';

export type InstanceScope<T, Shape extends string = 'get'> = {
  readonly [key in Shape]: T;
} & {
  instances: T[];
};
export interface ScopedInstance<Shape extends string = 'get'> {
  scope(id_: PropertyKey): InstanceScope<this, Shape>;
  scopes: InstanceScope<this, Shape>[];
}

export type LazyContainerShape = 'inherited' | 'isolated';
type ScopeSource<T extends Disposable, Shape extends LazyContainerShape> = Map<
  Shape,
  T
>;
type ScopesSource<T extends Disposable> = Map<
  PropertyKey,
  LazyContainerScope<T>
>;
type CreateScopedInstance<T> = (shape_: LazyContainerShape) => T;

export abstract class ScopedLazyContainer
  extends Disposable
  implements ScopedInstance<LazyContainerShape>
{
  private readonly _source: ScopesSource<this>;

  constructor() {
    super();
    this._source = new Map();

    this._disposers.push(() => {
      this._source.forEach((scope_) => scope_.dispose());
      this._source.clear();
    });
  }

  protected abstract createScopeInstance(shape_: LazyContainerShape): this;

  public scope(id_: PropertyKey): LazyContainerScope<this> {
    this.validateDisposed(this);
    let scope = this._source.get(id_);

    if (!scope) {
      scope = new LazyContainerScope((...params_) =>
        this.createScopeInstance(...params_)
      );
      this._source.set(id_, scope);
    }

    return scope;
  }

  public get scopes(): LazyContainerScope<this>[] {
    this.validateDisposed(this);
    return [...this._source.values()];
  }

  // public forEachScopeInstance(
  //   callbackFn_: ShapedInstanceCallback<this, LazyContainerShape>
  // ) {
  //   this.validateDisposed(this);
  //   this._source.forEach((scope_) =>
  //     scope_.forEach((...params_) => callbackFn_(...params_))
  //   );
  // }
}

export class LazyContainerScope<T extends Disposable>
  extends Disposable
  implements InstanceScope<T, LazyContainerShape>
{
  private readonly _source: ScopeSource<T, LazyContainerShape>;

  constructor(private _create: CreateScopedInstance<T>) {
    super();
    this._source = new Map();

    this._disposers.push(() => {
      this.instances.forEach((instance_) => instance_.dispose());
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

  public get instances(): T[] {
    this.validateDisposed(this);
    return [...this._source.values()];
  }

  private getOrCreateInstance(shape_: LazyContainerShape): T {
    let instance = this._source.get(shape_);

    if (!instance) {
      instance = this._create(shape_);
      this._source.set(shape_, instance);
    }

    return instance;
  }
}
