"use client";

import { useEffect, useState } from "react";

/**
 * A value that lags behind by `delay`, used to keep a query key still while
 * someone is typing. The input itself stays instant — only the request waits,
 * so a five-letter word is one search rather than five.
 */
export function useDebouncedValue<T>(value: T, delay = 200): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    if (value === settled) return;
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, settled, delay]);

  return settled;
}
