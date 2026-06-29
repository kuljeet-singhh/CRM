import { Router } from 'express';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { parseDateRange, parseGranularity } from './dateRange.js';
import {
  buildCalendarReport,
  buildContactsReport,
  buildEmailReport,
  buildEngagementReport,
  buildReportSummary,
  exportContactsList,
} from './service.js';
import {
  contactsToCsv,
  emailsToCsv,
  exportFilename,
  summaryToCsv,
} from './export.js';
import type { ExportFormat, ExportType } from './types.js';

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

function parseRangeFromQuery(req: AuthedRequest) {
  const parsed = parseDateRange(
    req.query.from as string | undefined,
    req.query.to as string | undefined
  );
  if ('error' in parsed) {
    return { error: parsed.error as string };
  }
  return { range: parsed };
}

const EXPORT_TYPES: ExportType[] = ['summary', 'contacts', 'emails'];
const EXPORT_FORMATS: ExportFormat[] = ['csv', 'json'];

reportsRouter.get('/summary', async (req: AuthedRequest, res) => {
  const result = parseRangeFromQuery(req);
  if ('error' in result) {
    res.status(400).json({ error: result.error });
    return;
  }

  const summary = await buildReportSummary(req.workspaceId!, result.range);
  res.json(summary);
});

reportsRouter.get('/contacts', async (req: AuthedRequest, res) => {
  const result = parseRangeFromQuery(req);
  if ('error' in result) {
    res.status(400).json({ error: result.error });
    return;
  }

  const granularity = parseGranularity(req.query.granularity as string | undefined);
  const report = await buildContactsReport(
    req.workspaceId!,
    result.range.from,
    result.range.to,
    granularity
  );
  res.json(report);
});

reportsRouter.get('/email', async (req: AuthedRequest, res) => {
  const result = parseRangeFromQuery(req);
  if ('error' in result) {
    res.status(400).json({ error: result.error });
    return;
  }

  const granularity = parseGranularity(req.query.granularity as string | undefined);
  const report = await buildEmailReport(
    req.workspaceId!,
    result.range.from,
    result.range.to,
    granularity
  );
  res.json(report);
});

reportsRouter.get('/engagement', async (req: AuthedRequest, res) => {
  const result = parseRangeFromQuery(req);
  if ('error' in result) {
    res.status(400).json({ error: result.error });
    return;
  }

  const limitRaw = parseInt(req.query.limit as string, 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 10;

  const report = await buildEngagementReport(
    req.workspaceId!,
    result.range.from,
    result.range.to,
    limit
  );
  res.json(report);
});

reportsRouter.get('/calendar', async (req: AuthedRequest, res) => {
  const result = parseRangeFromQuery(req);
  if ('error' in result) {
    res.status(400).json({ error: result.error });
    return;
  }

  const report = await buildCalendarReport(
    req.workspaceId!,
    result.range.from,
    result.range.to
  );
  res.json(report);
});

reportsRouter.get('/export', async (req: AuthedRequest, res) => {
  const result = parseRangeFromQuery(req);
  if ('error' in result) {
    res.status(400).json({ error: result.error });
    return;
  }

  const type = (req.query.type as string) ?? 'summary';
  const format = (req.query.format as string) ?? 'csv';

  if (!EXPORT_TYPES.includes(type as ExportType)) {
    res.status(400).json({ error: 'invalid_type' });
    return;
  }
  if (!EXPORT_FORMATS.includes(format as ExportFormat)) {
    res.status(400).json({ error: 'invalid_format' });
    return;
  }

  const { from, to } = result.range;
  const fromIso = from.toISOString().slice(0, 10);
  const toIso = to.toISOString().slice(0, 10);
  const filename = exportFilename(type as ExportType, format, fromIso, toIso);

  if (type === 'summary') {
    const summary = await buildReportSummary(req.workspaceId!, result.range);
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.json(summary);
      return;
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(summaryToCsv(summary));
    return;
  }

  if (type === 'contacts') {
    const rows = await exportContactsList(req.workspaceId!, from, to);
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.json({ period: { from: fromIso, to: toIso }, contacts: rows });
      return;
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(contactsToCsv(rows));
    return;
  }

  const emailReport = await buildEmailReport(req.workspaceId!, from, to, 'day');
  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(emailReport);
    return;
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(emailsToCsv(emailReport));
});
