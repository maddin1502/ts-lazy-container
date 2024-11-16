# ts-lazy-container
> This tool manages the creation and distribution of application-wide instances. These are created as singletons or unique variants as needed from provided definitions. In addition, scopes can be used to refine the distribution

[![npm version](https://badge.fury.io/js/ts-lazy-container.svg)](https://badge.fury.io/js/ts-lazy-container)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm downloads](https://badgen.net/npm/dw/ts-lazy-container)](https://badge.fury.io/js/ts-lazy-container)

## Features
- global dependency injection
- lazy instance resolution/injection (create instances on demand)
- class based provisioning/registration
- injection key for type/interface based provisioning/registration
- singleton or unique instance resolution/injection
- refined distribution by isolated and inherited scopes (custom, flexible, fine-grained, encapsulated instance resolution/injection)
- auto dependecy resolution (use provided/registered definitions to resolve object based class contructor parameters)

## Installation
```bash
npm i ts-lazy-container
```

## Usage

LazyContainer is lazy by design (as the name suggests). Instances will be created on demand during injection. For this to work, types, interfaces or classes must be registered to the container via creation instructions.

### Injection Modes

- singleton: created instance will be cached and reused on further injections. Dependencies (e.g. constructor parameters) are resolved in 'singleton' mode, too
- unique: creates a unique instance on each injection. Dependencies (e.g. constructor parameters) are resolved in 'singleton' mode and are therefore NOT unique
- deep-unique: creates a unique instance on each injection. Dependencies (e.g. constructor parameters) are resolved in 'deep-unique' mode and are therefore also unique

### Register creation instructions

> Identifier = `Class` or `InjectionKey`

Use `provide()` and/or `provideClass()` to register creation instructions.
- With `provide` it is possible to register any Type, Interface or Class by using an `InjectionKey` as `identifier`. You can also register Classes without an `InjectionKey`, just use the `Class` itself as `identifier`. You must specify an additional callback function that creates an instance (must match the identifier type).
- `provideClass` is specialized on class based registrations, it determines required constructor parameters that must be provided as well. Object-based constructor parameters do not require concrete instances but must be configured via `identifiers`. The container automatically resolves these `identifiers` when `inject()` is used to gain an instance (lazy), so they must also be registered in the container via `provide` or `provideClass`.

> `Identifiers` can only be registered once. Duplicate registration will result in an error. If multiple instances of a type are needed, different `InjectionKeys` of the same type must be created.

### Scoping

Scopes allow you to create tree structures within containers. This makes it possible to inject unique instances for specific use cases. These scopes can be created isolated or inherited. A scope is also just a container, so a scope can be created within a scope (and so on...).
- isolated: An isolated scope

TODO:
inherited
isolated

### Application Examples

Example types and classes for all example variants

```ts
type TypedA = {
  text: string;
  flag: boolean;
  callback: () => void;
};

class A implements TypedA {
  constructor(
    public text: string,
    public flag: boolean,
    public callback: () => void
  ) {}
}

class DependsOnA {
  constructor(public a: TypedA, public list: number[]) {}
}
```

#### Variant 1

Register a class that depends on another (using `provideClass`)

```ts
import { LazyContainer } from 'ts-lazy-container';

const container = LazyContainer.Create();
container.provideClass(A, 'hello world', true, () => {});
container.provideClass(DependsOnA, A, [1, 2, 3, 42]);

// ...

const a = container.inject(A);
// => { text: 'hello world'; flag: true; callback: () => {} }
const doa = container.inject(DependsOnA);
// => { a: { text: 'hello world'; flag: true; callback: () => {} }; list: [1, 2, 3, 42] }
```

#### Variant 2

Mixed usage of `provide` and `provideClass` for class registration

```ts
import { LazyContainer } from 'ts-lazy-container';
const container = LazyContainer.Create();
container.provide(A, () => new A('hello world', true, () => {}));
container.provideClass(DependsOnA, A, [1, 2, 3, 42]);

// ...

const a = container.inject(A);
// => { text: 'hello world'; flag: true; callback: () => {} }
const doa = container.inject(DependsOnA);
// => { a: { text: 'hello world'; flag: true; callback: () => {} }; list: [1, 2, 3, 42] }
```

#### Variant 3

Use `InjectionKeys` to register/inject types or interfaces

```ts
import { injectionKey, LazyContainer } from 'ts-lazy-container';

const aInjectionKey = injectionKey<TypedA>();

const container = LazyContainer.Create();
container.provide(
  aInjectionKey,
  () => new A('hello world', true, () => {})
);
container.provideClass(DependsOnA, aInjectionKey, [1, 2, 3, 42]);

// ...

const a = container.inject(aInjectionKey); // a: TypedA
// => { text: 'hello world'; flag: true; callback: () => {} }
const doa = container.inject(DependsOnA);
// => { a: { text: 'hello world'; flag: true; callback: () => {} }; list: [1, 2, 3, 42] }
```

#### Variant 4

Use `InjectionKeys` to register/inject types or interfaces using anonymous objects

```ts
import { injectionKey, LazyContainer } from 'ts-lazy-container';

const aInjectionKey = injectionKey<TypedA>();

const container = LazyContainer.Create();
container.provide(aInjectionKey, () => ({
  text: 'hello world',
  flag: true,
  callback: () => {}
}));
container.provideClass(DependsOnA, aInjectionKey, [1, 2, 3, 42]);

// ...

const a = container.inject(aInjectionKey); // a: TypedA
// => { text: 'hello world'; flag: true; callback: () => {} }
const doa = container.inject(DependsOnA);
// => { a: { text: 'hello world'; flag: true; callback: () => {} }; list: [1, 2, 3, 42] }
```

#### Variant 5

Mix it all up!
- use a `class` as creation instruction for an `InjectionsKey`
- use different `InjectionKeys` to register multiple creation instructions of the same type/interface/class

```ts
import { injectionKey, LazyContainer } from 'ts-lazy-container';

const doa1InjectionKey = injectionKey<DependsOnA>();
const doa2InjectionKey = injectionKey<DependsOnA>();

const container = LazyContainer.Create();
container.provideClass(A, 'hello world', true, () => {});
container.provideClass(DependsOnA, A, [1, 2, 3, 42]);
container.provide(doa1InjectionKey, DependsOnA);
container.provide(
  doa2InjectionKey,
  () => new DependsOnA(container.inject(A), [5, 6, 7])
);

// ...

const doa1 = container.inject(doa1InjectionKey);
// doa1.list => [1, 2, 3, 42]
const doa2 = container.inject(doa2InjectionKey);
// doa2.list => [5, 6, 7]
```

#### Variant 6

Inject unique instances - use the correct mode

```ts
import { LazyContainer } from 'ts-lazy-container';

const container = LazyContainer.Create();
container.provideClass(A, 'hello world', true, () => {});
container.provideClass(DependsOnA, A, [1, 2, 3, 42]);

// ...

const doa1 = container.inject(DependsOnA); // defaults to 'singleton'
const doa2 = container.inject(DependsOnA, 'singleton');
const doa3 = container.inject(DependsOnA, 'unique');
const doa4 = container.inject(DependsOnA, 'deep-unique');

// doa1 === doa2      => true
// doa1 === doa3      => false
// doa1 === doa4      => false
// doa1.a === doa2.a  => true
// doa1.a === doa3.a  => true
// doa1.a === doa4.a  => false
```

#### Variant 7

Using scopes for unique or use case related instances.

```ts
import { LazyContainer } from 'ts-lazy-container';

class User {
  constructor(public name: string, public doa: DependsOnA) {}
}

const container = LazyContainer.Create();

container.provideClass(A, 'hello world', true, () => {});
container.provideClass(DependsOnA, A, [1, 2, 3, 42]);
container.provideClass(User, 'Jack', DependsOnA);

const scientistScope = container.scope('scientist').inherited; // can resolve any instance from parent scope
scientistScope.provideClass(User, 'Daniel', DependsOnA);

const alienScope = container.scope('alien').isolated; // NO access to parent; need to register dependencies again
alienScope.provideClass(A, 'hello Chulak', false, () => {});
alienScope.provideClass(DependsOnA, A, []);
alienScope.provideClass(User, "Teal'c", DependsOnA);

const jack = container.inject(User);
const daniel = scientistScope.inject(User);
const tealc = alienScope.inject(User);

// jack === daniel              => false
// jack === tealc               => false
// jack.name                    => Jack
// daniel.name                  => Daniel
// tealc.name                   => Teal'c
// jack.doa === daniel.doa      => true
// jack.doa === tealc.doa       => false
// jack.doa.a.text              => hello world
// daniel.doa.a.text            => hello world
// tealc.doa.a.text             => hello Chulak
```

...
