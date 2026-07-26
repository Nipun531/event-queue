import { JobContext } from '../handler-registry';

export async function sendEmailHandler(
    payload: Record<string, unknown>,
     ctx: JobContext): Promise<unknown> {
        // extract what you need from payload and ctx
        const to=payload.to as string;
        const subject=payload.subject as string;

        // 2. log what you're doing
        ctx.log.info(`Sending email to ${to}`);
        
        // 3. do the actual work
        await new Promise(resolve => setTimeout(resolve, 500)); // simulate sending
        
        // 4. log completion
        ctx.log.info('Email sent successfully');
        
        // 5. return result — this gets saved as job.result in PostgreSQL
        return { sentAt: new Date().toISOString() };

    }