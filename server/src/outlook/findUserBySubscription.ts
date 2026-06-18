import { prisma } from '../db.js';

/** Lookup user by CRM or Inbox Graph subscription id (both stored on User). */
export function findOutlookUserBySubscriptionId(subscriptionId: string) {
  return prisma.user.findFirst({
    where: {
      authProvider: 'outlook',
      OR: [
        { outlookSubscriptionId: subscriptionId },
        { outlookInboxSubscriptionId: subscriptionId },
      ],
    },
  });
}
