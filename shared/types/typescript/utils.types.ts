/**
 * Utility Type Definitions
 */

import { z } from 'zod';

// Deep partial type
export type DeepPartial<T> = T extends object ? {
  [P in keyof T]?: DeepPartial<T[P]>;
} : T;

// Deep readonly type
export type DeepReadonly<T> = T extends object ? {
  readonly [P in keyof T]: DeepReadonly<T[P]>;
} : T;

// Nullable type
export type Nullable<T> = T | null;

// Optional type
export type Optional<T> = T | undefined;

// Extract keys of specific type
export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

// Omit by value type
export type OmitByType<T, U> = {
  [K in keyof T as T[K] extends U ? never : K]: T[K];
};

// Pick by value type
export type PickByType<T, U> = {
  [K in keyof T as T[K] extends U ? K : never]: T[K];
};

// Require at least one property
export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> =
  Pick<T, Exclude<keyof T, Keys>> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

// Require exactly one property
export type RequireOnlyOne<T, Keys extends keyof T = keyof T> =
  Pick<T, Exclude<keyof T, Keys>> &
  {
    [K in Keys]-?: Required<Pick<T, K>> &
      Partial<Record<Exclude<Keys, K>, undefined>>;
  }[Keys];

// XOR type
export type XOR<T, U> = (T | U) extends object ?
  (Without<T, U> & U) | (Without<U, T> & T) : T | U;

type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

// Async function type
export type AsyncFunction<T extends any[], R> = (...args: T) => Promise<R>;

// Sync or async function type
export type MaybeAsync<T> = T | Promise<T>;
export type MaybeAsyncFunction<T extends any[], R> = (...args: T) => MaybeAsync<R>;

// Constructor type
export type Constructor<T = {}> = new (...args: any[]) => T;

// Abstract constructor type
export type AbstractConstructor<T = {}> = abstract new (...args: any[]) => T;

// Mixin type
export type Mixin<T extends Constructor> = T;

// Brand type for nominal typing
export type Brand<T, B> = T & { __brand: B };

// Opaque type
export type Opaque<T, K> = T & { __opaque: K };

// String literal union to tuple
export type UnionToTuple<T> = (
  (T extends any ? (t: T) => T : never) extends infer U
    ? (U extends any ? (u: U) => any : never) extends (v: infer V) => any
      ? V
      : never
    : never
) extends (_: any) => infer W
  ? [...UnionToTuple<Exclude<T, W>>, W]
  : [];

// Tuple to union
export type TupleToUnion<T extends readonly any[]> = T[number];

// Object key paths
export type Path<T> = T extends object ? {
  [K in keyof T]: K extends string ? 
    T[K] extends object ? `${K}` | `${K}.${Path<T[K]>}` : K : never;
}[keyof T] : never;

// Get type by path
export type PathValue<T, P extends Path<T>> = 
  P extends `${infer K}.${infer Rest}` ?
    K extends keyof T ?
      Rest extends Path<T[K]> ?
        PathValue<T[K], Rest> :
        never :
      never :
    P extends keyof T ?
      T[P] :
      never;

// Event map
export interface EventMap {
  [event: string]: any;
}

// Typed event emitter
export interface TypedEventEmitter<Events extends EventMap> {
  on<K extends keyof Events>(event: K, listener: (data: Events[K]) => void): this;
  off<K extends keyof Events>(event: K, listener: (data: Events[K]) => void): this;
  emit<K extends keyof Events>(event: K, data: Events[K]): boolean;
  once<K extends keyof Events>(event: K, listener: (data: Events[K]) => void): this;
}

// Disposable pattern
export interface Disposable {
  dispose(): void;
}

export interface AsyncDisposable {
  dispose(): Promise<void>;
}

// Result type (similar to Rust)
export type Result<T, E = Error> = 
  | { ok: true; value: T }
  | { ok: false; error: E };

// Option type (similar to Rust)
export type Option<T> = 
  | { some: true; value: T }
  | { some: false };

// Lazy value
export class Lazy<T> {
  private _value?: T;
  private _computed = false;

  constructor(private factory: () => T) {}

  get value(): T {
    if (!this._computed) {
      this._value = this.factory();
      this._computed = true;
    }
    return this._value!;
  }
}

// Deferred promise
export class Deferred<T> {
  promise: Promise<T>;
  resolve!: (value: T) => void;
  reject!: (reason?: any) => void;

  constructor() {
    this.promise = new Promise<T>((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}

// Semaphore for concurrency control
export class Semaphore {
  private queue: (() => void)[] = [];
  private current = 0;

  constructor(private max: number) {}

  async acquire(): Promise<void> {
    if (this.current >= this.max) {
      await new Promise<void>(resolve => this.queue.push(resolve));
    }
    this.current++;
  }

  release(): void {
    this.current--;
    const next = this.queue.shift();
    if (next) next();
  }

  async use<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

// Rate limiter
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private capacity: number,
    private refillRate: number,
    private refillInterval: number
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  async acquire(tokens = 1): Promise<void> {
    await this.refill();
    
    if (this.tokens < tokens) {
      const waitTime = ((tokens - this.tokens) / this.refillRate) * this.refillInterval;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      await this.refill();
    }
    
    this.tokens -= tokens;
  }

  private async refill(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const refills = Math.floor(elapsed / this.refillInterval);
    
    if (refills > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + refills * this.refillRate);
      this.lastRefill = now;
    }
  }
}

// Circuit breaker
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime?: number;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private threshold: number,
    private timeout: number,
    private resetTimeout: number
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime! > this.resetTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }
}

// Type validation utilities
export function createValidator<T>(schema: z.ZodSchema<T>) {
  return {
    validate: (data: unknown): T => schema.parse(data),
    validateAsync: (data: unknown): Promise<T> => schema.parseAsync(data),
    safeParse: (data: unknown) => schema.safeParse(data),
    safeParseAsync: (data: unknown) => schema.safeParseAsync(data),
    isValid: (data: unknown): data is T => schema.safeParse(data).success,
  };
}

// Type guard helpers
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isFunction(value: unknown): value is Function {
  return typeof value === 'function';
}

export function isPromise<T = any>(value: unknown): value is Promise<T> {
  return value instanceof Promise || (
    isObject(value) &&
    isFunction((value as any).then) &&
    isFunction((value as any).catch)
  );
}

export function hasProperty<T extends object, K extends PropertyKey>(
  obj: T,
  key: K
): obj is T & Record<K, unknown> {
  return key in obj;
}