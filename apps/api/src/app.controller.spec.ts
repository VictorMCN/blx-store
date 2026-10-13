import { Test, type TestingModule } from '@nestjs/testing';
import { describe, beforeEach, expect, it } from 'vitest';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('should return the API health status', () => {
      expect(appController.getHealth()).toEqual({
        status: 'ok',
        service: 'blx-store-api',
        timestamp: expect.any(String),
      });
    });
  });
});
