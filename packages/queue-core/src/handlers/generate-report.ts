import type { JobContext } from '../handler-registry';

export async function generateReportHandler(
  payload: Record<string, unknown>,
  ctx: JobContext
): Promise<unknown> {
  ctx.log.info('Generating report — querying job stats');

  const [total, completed, failed] = await Promise.all([
    ctx.prisma.job.count({ where: { tenantId: ctx.tenantId } }),
    ctx.prisma.job.count({ where: { tenantId: ctx.tenantId, status: 'COMPLETED' } }),
    ctx.prisma.job.count({ where: { tenantId: ctx.tenantId, status: 'FAILED' } }),
  ]);

  // simulate report generation taking time
  await new Promise(resolve => setTimeout(resolve, 2000));

  ctx.log.info('Report generated');

  return {
    reportData: { total, completed, failed },
  };
}