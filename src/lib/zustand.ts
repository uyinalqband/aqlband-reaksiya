import { useSyncExternalStore } from 'react';

type StateCreator<T> = (
  set: (partial: Partial<T> | ((state: T) => Partial<T>)) => void,
  get: () => T,
) => T;

export interface StoreHook<T> {
  <U>(selector: (state: T) => U): U;
  (): T;
  getState: () => T;
  setState: (partial: Partial<T> | ((state: T) => Partial<T>)) => void;
  subscribe: (listener: () => void) => () => void;
}

export function create<T>(creator: StateCreator<T>): StoreHook<T> {
  const listeners = new Set<() => void>();
  let state!: T;

  const get = () => state;
  const set = (partial: Partial<T> | ((current: T) => Partial<T>)) => {
    const patch = typeof partial === 'function' ? partial(state) : partial;
    state = Object.assign({}, state, patch);
    listeners.forEach((listener) => listener());
  };

  state = creator(set, get);

  function useStore<U>(selector: (state: T) => U): U;
  function useStore(): T;
  function useStore<U>(selector?: (state: T) => U): U | T {
    const pick = selector ?? ((value: T) => value as unknown as U);
    return useSyncExternalStore(
      (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      () => pick(state),
      () => pick(state),
    );
  }

  useStore.getState = get;
  useStore.setState = set;
  useStore.subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  return useStore as StoreHook<T>;
}
