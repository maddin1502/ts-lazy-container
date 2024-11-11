import { type InstanceScope, InstanceScopeCore } from 'ts-lib-extended';
import type { LazyContainer } from './container.js';

export type LazyContainerVariants = 'inherited' | 'isolated';
export type CreateInstance<T> = (variant_: LazyContainerVariants) => T;

export class LazyContainerScope
  extends InstanceScopeCore<LazyContainer, LazyContainerVariants>
  implements InstanceScope<LazyContainer, LazyContainerVariants>
{
  constructor(
    scopeId_: PropertyKey,
    private _create: CreateInstance<LazyContainer>
  ) {
    super(scopeId_);
  }

  /**
   * get an inherited scope that is able to access it's parent
   *
   * @public
   * @readonly
   * @returns {LazyContainer}
   * @since 1.0.0
   */
  public get inherited(): LazyContainer {
    this.validateDisposed(this);
    return this.getOrCreateInstance('inherited');
  }

  /**
   * get an isolated scope that CANNOT access its parent
   *
   * @public
   * @readonly
   * @returns {LazyContainer}
   * @since 1.0.0
   */
  public get isolated(): LazyContainer {
    this.validateDisposed(this);
    return this.getOrCreateInstance('isolated');
  }

  protected createInstance(variant_: LazyContainerVariants): LazyContainer {
    return this._create(variant_);
  }

  protected disposeInstance(instance_: LazyContainer): void {
    instance_.dispose();
  }
}
