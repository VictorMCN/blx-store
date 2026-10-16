import {
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import type { AssistantToolsService } from './assistant-tools.service.js';
import { AssistantService } from './assistant.service.js';

describe('AssistantService', () => {
  const originalNodeEnv =
    process.env.NODE_ENV;

  const originalApiKey =
    process.env.OPENAI_API_KEY;

  beforeEach(() => {
    process.env.NODE_ENV =
      'test';

    process.env.OPENAI_API_KEY =
      'test-key-that-must-never-be-used';
  });

  afterEach(() => {
    restoreEnv(
      'NODE_ENV',
      originalNodeEnv,
    );

    restoreEnv(
      'OPENAI_API_KEY',
      originalApiKey,
    );
  });

  it('does not enable the OpenAI client in the test environment', async () => {
    const tools =
      {} as AssistantToolsService;

    const service =
      new AssistantService(
        tools,
      );

    await expect(
      service.chat(
        'customer-a',
        {
          message:
            'Show me laptops.',
          history: [],
        },
      ),
    ).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  function restoreEnv(
    key: string,
    value:
      | string
      | undefined,
  ) {
    if (
      value === undefined
    ) {
      delete process.env[
        key
      ];

      return;
    }

    process.env[key] =
      value;
  }
});
