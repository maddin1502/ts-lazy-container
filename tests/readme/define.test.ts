import { LazyContainer, injectionKey } from '@/index.js';
import { describe, expect, test } from 'vitest';

type AType = {
  value: string;
};

class A1 implements AType {
  constructor(public value: string) {}
}

class A2 extends A1 {}

const container = LazyContainer.Create();
const aInjectionKey = injectionKey<AType>();
const aInjectionKey2 = injectionKey<AType>();
container.provide(aInjectionKey, () => ({ value: 'hi' }));
container.provide(A1, () => new A1('hello'));
container.provideClass(A2, 'greetings');
container.provide(aInjectionKey2, A2);

const aik: AType = container.inject(aInjectionKey); // value = hi
const a1: AType = container.inject(A1); // value = hello
const a2: AType = container.inject(A2); // value = greeting
const aik2: AType = container.inject(aInjectionKey2); // value = greeting

describe(LazyContainer, () => {
  test('provide', () => {
    expect.assertions(4);
    expect(aik2.value).toBe('greetings');
    expect(aik.value).toBe('hi');
    expect(a1.value).toBe('hello');
    expect(a2.value).toBe('greetings');
  });
});
