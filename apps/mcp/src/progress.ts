import {
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

/**
 * Reading progress: the thing EveryWord can measure that nobody else can.
 *
 * A reading session is not "a story was played". It is how many words the
 * reader was actually on screen for, reported by the player as the karaoke
 * cursor advances. That distinction is the whole product: minutes watched
 * is not reading practice, words followed is.
 *
 * The shape here follows Nightlight's event-log design. Sessions are an
 * append-only log, and every number a parent is ever told (totals, streaks,
 * this week against last week) is derived from that log by a pure function.
 * Nothing is stored pre-aggregated, so a summary can never drift away from
 * the sessions that produced it, and the same computation runs identically
 * against memory in tests and DynamoDB in production.
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

/** Storage is only ever asked to append and to read back, never to compute. */
export interface ProgressStore {
  record(session: ReadingSession): Promise<void>;
  list(readerId: string): Promise<ReadingSession[]>;
}

// ---- Derivations: pure functions over a session log ----------------------

/** Midnight-aligned day key in UTC, which is what the streak counts in. */
function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** Slugs this reader has finished at least once. */
export function completedSlugs(sessions: ReadingSession[]): Set<string> {
  return new Set(sessions.filter((s) => s.completed).map((s) => s.slug));
}

export function summarize(
  sessions: ReadingSession[],
  readerId: string,
  now = new Date(),
): ProgressSummary {
  if (sessions.length === 0) {
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

  const sorted = [...sessions].sort((a, b) => a.at.localeCompare(b.at));
  const nowMs = now.getTime();
  const weekMs = 7 * 86_400_000;
  const inWindow = (s: ReadingSession, fromAgo: number, toAgo: number) => {
    const age = nowMs - Date.parse(s.at);
    return age >= toAgo && age < fromAgo;
  };

  // Streak: consecutive calendar days ending today or yesterday. Yesterday
  // still counts, because a streak that broke before the day was over would
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
    totalWordsRead: sessions.reduce((n, s) => n + s.wordsFollowed, 0),
    sessions: sessions.length,
    storiesCompleted: sessions.filter((s) => s.completed).length,
    distinctStories: new Set(sessions.map((s) => s.slug)).size,
    currentStreakDays: streak,
    wordsThisWeek: sessions
      .filter((s) => inWindow(s, weekMs, 0))
      .reduce((n, s) => n + s.wordsFollowed, 0),
    wordsPreviousWeek: sessions
      .filter((s) => inWindow(s, 2 * weekMs, weekMs))
      .reduce((n, s) => n + s.wordsFollowed, 0),
    lastReadAt: sorted[sorted.length - 1]!.at,
  };
}

// ---- Stores --------------------------------------------------------------

/** In-process store, used by tests and by `npm run mcp` locally. */
export class MemoryProgressStore implements ProgressStore {
  private sessions: ReadingSession[] = [];

  async record(session: ReadingSession): Promise<void> {
    this.sessions.push(session);
  }

  async list(readerId: string): Promise<ReadingSession[]> {
    return this.sessions.filter((s) => s.readerId === readerId);
  }

  reset(): void {
    this.sessions = [];
  }
}

/**
 * DynamoDB store: one on-demand table, partition key `READER#{id}`, sort key
 * `SESSION#{iso}#{slug}`. Appending is a plain put, and reading a reader's
 * history is a single partition query, because every number we report is
 * derived from that one list.
 *
 * Progress has to outlive a Lambda container. Reading practice measured in
 * RAM is not measured at all: a parent who asks on Sunday about a week of
 * reading must get the week, not whatever survived the last cold start.
 */
export class DynamoProgressStore implements ProgressStore {
  private readonly doc: DynamoDBDocumentClient;

  constructor(
    private readonly tableName: string,
    client: DynamoDBClient = new DynamoDBClient({}),
  ) {
    this.doc = DynamoDBDocumentClient.from(client, {
      marshallOptions: { removeUndefinedValues: true },
    });
  }

  private pk(readerId: string): string {
    return `READER#${readerId}`;
  }

  async record(session: ReadingSession): Promise<void> {
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          pk: this.pk(session.readerId),
          sk: `SESSION#${session.at}#${session.slug}`,
          ...session,
        },
      }),
    );
  }

  async list(readerId: string): Promise<ReadingSession[]> {
    const out: ReadingSession[] = [];
    let cursor: Record<string, unknown> | undefined;
    do {
      const res = await this.doc.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
          ExpressionAttributeValues: {
            ":pk": this.pk(readerId),
            ":prefix": "SESSION#",
          },
          ExclusiveStartKey: cursor,
        }),
      );
      for (const item of res.Items ?? []) {
        out.push({
          readerId: item.readerId as string,
          slug: item.slug as string,
          wordsFollowed: Number(item.wordsFollowed),
          completed: Boolean(item.completed),
          at: item.at as string,
        });
      }
      cursor = res.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (cursor);
    return out;
  }
}
