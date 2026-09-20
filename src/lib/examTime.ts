// Shared by every exam/test route that stores a startTime/endTime pair --
// duration is always derived from the two, never entered directly, so it
// can't drift out of sync with what was actually scheduled.
export function calcDurationMinutes(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}
