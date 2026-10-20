import { ServiceUnavailableException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssistantToolsService } from './assistant-tools.service.js';
import { AssistantService } from './assistant.service.js';

describe('AssistantService', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalApiKey = process.env.OPENAI_API_KEY;

  const searchProducts = vi.fn();
  const tools = { searchProducts } as unknown as AssistantToolsService;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.OPENAI_API_KEY = 'test-key-that-must-never-be-used';
    searchProducts.mockReset();
  });

  afterEach(() => {
    restoreEnv('NODE_ENV', originalNodeEnv);
    restoreEnv('OPENAI_API_KEY', originalApiKey);
  });

  it('does not initialize OpenAI in the test environment', async () => {
    const service = new AssistantService(tools);

    await expect(
      service.chat('customer-a', {
        message: 'Compare the NovaBook 14 and ForgeBook 16.',
        history: [],
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(searchProducts).not.toHaveBeenCalled();
  });

  it('lists headphones in Portuguese without invoking OpenAI', async () => {
    searchProducts.mockResolvedValue({
      interpretedSearchTerms: ['headphones'],
      products: [{
        name: 'BLX Pulse ANC',
        currency: 'BRL',
        priceInCents: 89900,
        inStock: true,
        productUrl: '/products/blx-pulse-anc',
      }],
    });

    const service = new AssistantService(tools);
    const result = await service.chat('customer-a', {
      message: 'Quais fones vocês têm?',
      history: [],
    });

    expect(searchProducts).toHaveBeenCalledWith('Quais fones vocês têm?', 5);
    expect(result.message).toContain('BLX Pulse ANC');
    expect(result.message).toMatch(/R\$\s?899,00/);
    expect(result.message).toContain('Em estoque');
    expect(result.message).toContain('/products/blx-pulse-anc');
  });

  it('answers basic English catalog requests without invoking OpenAI', async () => {
    searchProducts.mockResolvedValue({
      interpretedSearchTerms: ['laptops'],
      products: [{
        name: 'BLX NovaBook 14',
        currency: 'BRL',
        priceInCents: 599900,
        inStock: true,
        productUrl: '/products/blx-novabook-14',
      }],
    });

    const service = new AssistantService(tools);
    const result = await service.chat('customer-a', {
      message: 'Show me some laptops.',
      history: [],
    });

    expect(result.message).toContain('Here are some BLX Store options');
    expect(result.message).toContain('BLX NovaBook 14');
    expect(result.message).toContain('In stock');
  });

  it('includes out-of-stock products instead of claiming they are absent', async () => {
    searchProducts.mockResolvedValue({
      interpretedSearchTerms: ['smartphones'],
      products: [{
        name: 'BLX Vector Lite',
        currency: 'BRL',
        priceInCents: 249900,
        inStock: false,
        productUrl: '/products/blx-vector-lite',
      }],
    });

    const service = new AssistantService(tools);
    const result = await service.chat('customer-a', {
      message: 'Tem celular?',
      history: [],
    });

    expect(result.message).toContain('BLX Vector Lite');
    expect(result.message).toContain('Esgotado');
  });

  it('does not treat a price-constrained request as a simple listing', async () => {
    const service = new AssistantService(tools);

    await expect(service.chat('customer-a', {
      message: 'Vocês têm celulares baratos?',
      history: [],
    })).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(searchProducts).not.toHaveBeenCalled();
  });

  it('does not treat product advice as a simple listing', async () => {
    const service = new AssistantService(tools);

    await expect(service.chat('customer-a', {
      message: 'Qual o melhor notebook para estudar?',
      history: [],
    })).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(searchProducts).not.toHaveBeenCalled();
  });

  it('does not assume an unknown catalog concept is a known category', async () => {
    searchProducts.mockResolvedValue({
      interpretedSearchTerms: ['Tem videogame?'],
      products: [],
    });

    const service = new AssistantService(tools);

    await expect(service.chat('customer-a', {
      message: 'Tem videogame?',
      history: [],
    })).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('keeps order requests within the authenticated LLM flow', async () => {
    const service = new AssistantService(tools);

    await expect(service.chat('customer-a', {
      message: 'Qual o status do meu pedido?',
      history: [],
    })).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(searchProducts).not.toHaveBeenCalled();
  });

  function restoreEnv(key: string, value: string | undefined) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
