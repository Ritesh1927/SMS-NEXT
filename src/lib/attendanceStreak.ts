// Consecutive-attendance streak rewards, shown on the Leaderboard page's
// "How points are earned" card. A streak is the run of most-recent
// attendance records for a student that are not "absent" (present and late
// both count as showing up); it breaks the moment an absent day appears and
// starts over from the next present/late day.
export const STREAK_MILESTONES: { threshold: number; points: number }[] = [
  { threshold: 20, points: 3 },
  { threshold: 50, points: 5 },
  { threshold: 80, points: 7 },
  { threshold: 120, points: 9 },
  { threshold: 150, points: 11 },
  { threshold: 200, points: 13 },
];

// Counts backward from the most recent record, stopping at the first
// "absent". `records` must already be sorted most-recent-first.
export function computeStreak(records: { status: string }[]): number {
  let streak = 0;
  for (const r of records) {
    if (r.status === "absent") break;
    streak++;
  }
  return streak;
}

// Sum of every milestone's points whose threshold falls in (oldStreak,
// newStreak] -- so a milestone is only paid out the run that first reaches
// it, not on every subsequent day the streak stays above it, but a bulk
// edit that jumps the streak past several milestones at once still pays
// all of them.
export function pointsForStreakCrossing(oldStreak: number, newStreak: number): number {
  if (newStreak <= oldStreak) return 0;
  return STREAK_MILESTONES.filter((m) => m.threshold > oldStreak && m.threshold <= newStreak).reduce((sum, m) => sum + m.points, 0);
}
