export function calculateAvailability(online: number, total: number) {
  if (!Number.isFinite(online) || !Number.isFinite(total) || total <= 0) {
    return null;
  }

  const percentage = (online / total) * 100;
  return Math.min(100, Math.max(0, percentage));
}
