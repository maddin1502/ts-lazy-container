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

## Basics

TODO:
- laziness

## Usage

> Identifier = `Class` or `InjectionKey`

Use `provide()` and/or `provideClass()` to register instance creation instructions.
- With `provide` it is possible to register any Types, Interfaces or Classes by using `injection keys` as `identifiers`. You can also register Classes without an `injection key`, just use the Class itself as `identifier`. You must specify an additional callback function that creates an instance (must match the identifier type).
- `provideClass` is specialized on class based registrations, it determines required constructor parameters that must be provided as well. Object-based constructor parameters do not require concrete instances but must be configured via `identifiers`. The container resolves these identifiers automatically, so they must also be provided in the container via `provide` or `provideClass`.

`Identifiers` can only be registered once. A duplicate registration leads to an error. If multiple instances of a type are required, different `InjectionKeys` of the same type must be created.

### Application Examples

Example types and classes for all variants

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

```ts
import { LazyContainer } from 'ts-lazy-container';
```

#### Variant 2

```ts
import { injectionKey, LazyContainer } from 'ts-lazy-container';
```

#### Variant 3

```ts
import { injectionKey, LazyContainer } from 'ts-lazy-container';
```

#### Variant 4

```ts
import { injectionKey, LazyContainer } from 'ts-lazy-container';
```

#### Variant 5

```ts
import { injectionKey, LazyContainer } from 'ts-lazy-container';
```


### Resolution / Injection

### Scoping
...
