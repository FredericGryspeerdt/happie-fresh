import { effect, Signal, signal } from "@preact/signals";

export const debounceSignal = <T>(
  targetSignal: Signal<T>,
  timeoutMs = 0,
  cb?: any,
): Signal<T> => {
  const debounceSignal = signal<T>(targetSignal.value);

  effect(() => {
    const value = targetSignal.peek();
    const timeout = setTimeout(() => {
      console.log("Setting debounced value:", value);
      cb?.();
    }, timeoutMs);
    return () => {
      clearTimeout(timeout);
    };
  });

  return debounceSignal;
};
