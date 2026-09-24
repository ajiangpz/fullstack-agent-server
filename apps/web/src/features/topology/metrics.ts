export function bitsPerSecondToMbps(value: number | null) {
  return value === null ? null : value / 1_000_000;
}

export function hasMetricSeriesValues(
  series: Array<{ data: Array<[string, number | null]> }>,
) {
  return series.some((item) =>
    item.data.some(([, value]) => value !== null),
  );
}
