import { syncGoogleCalendar } from './sync.js';
import type { CalendarSyncResult } from '../../calendar/types.js';

const inFlight = new Map<string, Promise<CalendarSyncResult>>();

export type CalendarSyncLogPrefix = 'settings' | 'daily' | 'manual' | 'cron';

export async function runGoogleCalendarSyncForUser(
  userId: string,
  prefix: CalendarSyncLogPrefix = 'manual'
): Promise<CalendarSyncResult> {
  const existing = inFlight.get(userId);
  if (existing) return existing;

  const job = syncGoogleCalendar(userId)
    .then((result) => {
      if (result.error) {
        console.log(`[${prefix}] Google calendar sync skipped for ${userId}: ${result.error}`);
      } else {
        console.log(
          `[${prefix}] Google calendar sync ${userId}: +${result.imported} imported, ${result.updated} updated, ${result.cancelled} cancelled`
        );
      }
      return result;
    })
    .catch((err) => {
      console.error(`[${prefix}] Google calendar sync failed for ${userId}`, err);
      throw err;
    })
    .finally(() => {
      inFlight.delete(userId);
    });

  inFlight.set(userId, job);
  return job;
}
