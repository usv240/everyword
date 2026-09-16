/**
 * Reading progress: the thing EveryWord can measure that nobody else can.
 *
 * A reading session is not "a story was played". It is how many words the
 * reader was actually on screen for, reported by the player as the karaoke
 * cursor advances. That distinction is the whole point: minutes watched is
 * not reading practice, words followed is.
 *
 * Storage is in-process for this build, which is the honest scope of a
 * hackathon demo. The shape is deliberately a narrow interface so a
 * DynamoDB implementation drops in without touching the MCP layer, exactly
 * as Nightlight does with its event store.
 */

export interface ReadingSession {
  readerId: string;
  slug: string;
  /** Words the karaoke cursor actually passed while the reader was present. */
  wordsFollowed: number;
  /** Whether the story was played to the end. */
  completed: boolean;
  /** ISO timestamp of when the session finished. */
  at: string;
}

export interface ProgressSummary {
  readerId: string;
  totalWordsRead: number;
  sessions: number;
  storiesCompleted: number;
  distinctStories: number;
  currentStreakDays: number;
  wordsThisWeek: number;
  wordsPreviousWeek: number;
  lastReadAt: string | null;
}

/** Midnight-aligned day key in UTC, which is what the streak counts in. */
function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

export class ProgressStore {
  private sessions: ReadingSession[] = [];

  record(session: ReadingSession): void {
    this.sessions.push(session);
  }

  all(readerId?: string): ReadingSession[] {
    return readerId
      ? this.sessions.filter((s) => s.readerId === readerId)
      : [...this.sessions];
  }

  /** Slugs this reader has finished at least once. */
  completedSlugs(readerId: string): Set<string> {
    return new Set(
      this.sessions.filter((s) => s.readerId === readerId && s.completed).map((s) => s.slug),
    );
  }

  summarize(readerId: string, now = new Date()): ProgressSummary {
    const mine = this.all(readerId);
    if (mine.length === 0) {
      return {
        readerId,
        totalWordsRead: 0,
        sessions: 0,
        storiesCompleted: 0,
        distinctStories: 0,
        currentStreakDays: 0,
        wordsThisWeek: 0,
        wordsPreviousWeek: 0,
        lastReadAt: null,
      };
    }

    const sorted = [...mine].sort((a, b) => a.at.localeCompare(b.at));
    const nowMs = now.getTime();
    const weekMs = 7 * 86_400_000;
    const inWindow = (s: ReadingSession, fromAgo: number, toAgo: number) => {
      const age = nowMs - Date.parse(s.at);
      return age >= toAgo && age < fromAgo;
    };

    // Streak: consecutive calendar days ending today or yesterday. Yesterday
    // still counts, because a streak that breaks before the day is over would
    // punish someone who simply has not read yet this evening.
    const days = [...new Set(sorted.map((s) => dayKey(s.at)))].sort();
    const today = dayKey(now.toISOString());
    let streak = 0;
    const last = days[days.length - 1];
    if (last && daysBetween(last, today) <= 1) {
      streak = 1;
      for (let i = days.length - 1; i > 0; i--) {
        if (daysBetween(days[i - 1]!, days[i]!) === 1) streak++;
        else break;
      }
    }

    return {
      readerId,
      totalWordsRead: mine.reduce((n, s) => n + s.wordsFollowed, 0),
      sessions: mine.length,
      storiesCompleted: mine.filter((s) => s.completed).length,
      distinctStories: new Set(mine.map((s) => s.slug)).size,
      currentStreakDays: streak,
      wordsThisWeek: mine
        .filter((s) => inWindow(s, weekMs, 0))
        .reduce((n, s) => n + s.wordsFollowed, 0),
      wordsPreviousWeek: mine
        .filter((s) => inWindow(s, 2 * weekMs, weekMs))
        .reduce((n, s) => n + s.wordsFollowed, 0),
      lastReadAt: sorted[sorted.length - 1]!.at,
    };
  }

  reset(): void {
    this.sessions = [];
  }
}
