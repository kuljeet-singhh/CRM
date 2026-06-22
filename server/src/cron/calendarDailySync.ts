import { prisma } from '../db.js';
import { runGoogleCalendarSyncForUser } from '../gmail/calendar/syncRunner.js';
import { runOutlookCalendarSyncForUser } from '../outlook/calendar/syncRunner.js';

export async function runDailyCalendarSync(): Promise<{ users: number }> {
  const users = await prisma.user.findMany({
    where: { calendarSyncEnabled: true },
    select: { id: true, googleRefreshToken: true, outlookRefreshToken: true },
  });

  for (const user of users) {
    try {
      if (user.googleRefreshToken) {
        await runGoogleCalendarSyncForUser(user.id, 'daily');
      } else if (user.outlookRefreshToken) {
        await runOutlookCalendarSyncForUser(user.id, 'daily');
      }
    } catch (e) {
      console.error('[calendar-daily]', user.id, e);
    }
  }

  return { users: users.length };
}
