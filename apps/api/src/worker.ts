import { setTimeout as delay } from 'node:timers/promises';
import { NestFactory } from '@nestjs/core';
import { SchedulerRegistry } from '@nestjs/schedule';
import { WorkerModule } from './worker.module.js';

const MAX_DRAIN_MS = 100_000;
const POLL_INTERVAL_MS = 250;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(
    WorkerModule,
  );

  const registry = app.get(SchedulerRegistry);
  const jobs = [...registry.getCronJobs().entries()];

  let shuttingDown = false;

  console.log(
    '[Worker] Started with scheduled jobs:',
    jobs.map(([name]) => name),
  );

  async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;

    console.log(
      `[Worker] Received ${signal}. Stopping scheduled jobs.`,
    );

    try {
      await Promise.all(
        jobs.map(([, job]) => Promise.resolve(job.stop())),
      );

      const deadline = Date.now() + MAX_DRAIN_MS;

      while (
        jobs.some(([, job]) => job.isCallbackRunning) &&
        Date.now() < deadline
      ) {
        await delay(POLL_INTERVAL_MS);
      }

      const unfinishedJobs = jobs
        .filter(([, job]) => job.isCallbackRunning)
        .map(([name]) => name);

      if (unfinishedJobs.length > 0) {
        console.error(
          '[Worker] Shutdown deadline reached. Jobs still running:',
          unfinishedJobs,
        );

        process.exitCode = 1;
      }
    } finally {
      await app.close();

      console.log('[Worker] Application context closed.');
    }
  }

  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.once(signal, () => {
      void shutdown(signal).catch((error: unknown) => {
        console.error('[Worker] Shutdown failed.', error);
        process.exitCode = 1;
      });
    });
  }
}

void bootstrap().catch((error: unknown) => {
  console.error('[Worker] Startup failed.', error);
  process.exitCode = 1;
});
