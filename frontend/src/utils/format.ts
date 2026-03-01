export function formatPrice(
  value: number,
  opts?: { minDecimals?: number; maxDecimals?: number }
) {
  if (!Number.isFinite(value)) return '—';

  const abs = Math.abs(value);
  if (abs === 0) return '0.00';

  if (abs >= 1) return value.toFixed(2);

  const minDecimals = opts?.minDecimals ?? 4;
  const maxDecimals = opts?.maxDecimals ?? 10;

  const firstNonZero = Math.ceil(-Math.log10(abs));
  const decimals = Math.min(
    maxDecimals,
    Math.max(minDecimals, firstNonZero + 1)
  );

  return value.toFixed(decimals);
}

export function formatUsd(
  value: number,
  opts?: { minDecimals?: number; maxDecimals?: number }
) {
  const formatted = formatPrice(value, opts);
  return formatted === '—' ? '—' : `$${formatted}`;
}
