import { handleMaybePromise, type MaybePromise } from '@whatwg-node/promise-helpers';

export function isIterableObject(value: unknown): value is Iterable<unknown> {
  // Match graphql-js: only treat as iterable when the iterator is callable.
  // `Symbol.iterator in value` is true for `{ [Symbol.iterator]: null }`.
  return (
    value != null &&
    typeof value === 'object' &&
    typeof (value as { [Symbol.iterator]?: unknown })[Symbol.iterator] === 'function'
  );
}

export function isObjectLike(value: unknown): value is { [key: string]: unknown } {
  return typeof value === 'object' && value !== null;
}

export function promiseReduce<T, U>(
  values: Iterable<T>,
  callbackFn: (accumulator: U, currentValue: T) => MaybePromise<U>,
  initialValue: MaybePromise<U>,
): MaybePromise<U> {
  let accumulator = initialValue;

  for (const value of values) {
    accumulator = handleMaybePromise(
      () => accumulator,
      resolved => callbackFn(resolved, value),
    );
  }

  return accumulator;
}

export function hasOwnProperty(obj: unknown, prop: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

/**
 * True for keys that must never be used for object-path writes because they
 * reach the prototype chain (`__proto__`, `constructor`, `prototype`).
 */
export function isDangerousObjectKey(key: unknown): boolean {
  return key === '__proto__' || key === 'constructor' || key === 'prototype';
}

/**
 * True when `key` is a primitive string/number that is safe to use for
 * own-property access. Rejects non-primitives (which coerce via `ToPropertyKey`)
 * and {@link isDangerousObjectKey dangerous names}.
 */
export function isSafeObjectKey(key: unknown): key is string | number {
  if (typeof key !== 'string' && typeof key !== 'number') {
    return false;
  }
  return !isDangerousObjectKey(key);
}

/**
 * Assigns `value` under `key` on `target` as an ordinary own property for
 * keys that must never touch the prototype chain (see
 * {@link isDangerousObjectKey}); every other key takes the plain-write path.
 *
 * Schema member names arrive from SDL, and the GraphQL Name grammar accepts
 * names like `__proto__` (graphql-js keeps them as own keys of its
 * null-prototype value maps). A plain `container[key] = value` for such a
 * name resolves to the inherited `Object.prototype.__proto__` setter instead
 * of creating an own property — hijacking the container's `[[Prototype]]`
 * and making the member invisible to subsequent `Object.keys`-based
 * rebuilds. Rebuild loops keyed by schema member names should use this
 * helper so every member is preserved as a regular own property.
 */
export function assignSafeObjectKey(
  target: Record<string, unknown>,
  key: string,
  value: unknown,
): void {
  if (isDangerousObjectKey(key)) {
    Object.defineProperty(target, key, {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  } else {
    target[key] = value;
  }
}
