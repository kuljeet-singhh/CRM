export function isCalendarWritable(accessRole?: string): boolean {
  if (!accessRole) return true;
  const role = accessRole.toLowerCase();
  return role !== 'reader' && role !== 'freebusyreader';
}
