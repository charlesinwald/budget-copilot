import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
  authenticateUser,
  validateSession,
  jsonResponse,
  errorResponse,
  parseJsonBody,
  getQueryParam,
  getRequiredQueryParam,
} from './utils';
import { Env } from './raindrop.gen';

describe('Authentication utilities', () => {
  let mockEnv: Env;

  beforeEach(() => {
    mockEnv = {
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      SESSION_CACHE: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
      },
    } as unknown as Env;
  });

  describe('authenticateUser', () => {
    test('should extract userId from valid session cookie', async () => {
      const request = new Request('http://localhost/api/test', {
        headers: {
          Cookie: 'session=valid_session_id',
        },
      });

      vi.mocked(mockEnv.SESSION_CACHE.get).mockResolvedValue('user_123');

      const userId = await authenticateUser(request, mockEnv);

      expect(userId).toBe('user_123');
      expect(mockEnv.SESSION_CACHE.get).toHaveBeenCalledWith('session:valid_session_id');
    });

    test('should return null when session cookie is missing', async () => {
      const request = new Request('http://localhost/api/test');

      const userId = await authenticateUser(request, mockEnv);

      expect(userId).toBeNull();
    });

    test('should return null when session is invalid', async () => {
      const request = new Request('http://localhost/api/test', {
        headers: {
          Cookie: 'session=invalid_session',
        },
      });

      vi.mocked(mockEnv.SESSION_CACHE.get).mockResolvedValue(null);

      const userId = await authenticateUser(request, mockEnv);

      expect(userId).toBeNull();
    });
  });

  describe('validateSession', () => {
    test('should return true for valid session', async () => {
      vi.mocked(mockEnv.SESSION_CACHE.get).mockResolvedValue('user_123');

      const isValid = await validateSession('valid_session', mockEnv);

      expect(isValid).toBe(true);
    });

    test('should return false for invalid session', async () => {
      vi.mocked(mockEnv.SESSION_CACHE.get).mockResolvedValue(null);

      const isValid = await validateSession('invalid_session', mockEnv);

      expect(isValid).toBe(false);
    });
  });
});

describe('Response formatting', () => {
  describe('jsonResponse', () => {
    test('should format JSON response with default status 200', () => {
      const data = { test: 'value' };

      const response = jsonResponse(data);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    test('should format JSON response with custom status', () => {
      const data = { success: true };

      const response = jsonResponse(data, 201);

      expect(response.status).toBe(201);
    });

    test('should include all required CORS headers', () => {
      const response = jsonResponse({ test: 'value' });

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
      expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
      expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
    });
  });

  describe('errorResponse', () => {
    test('should format error response with message', () => {
      const response = errorResponse('Something went wrong', 400);

      expect(response.status).toBe(400);
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    test('should format error response with details', async () => {
      const response = errorResponse('Invalid input', 400, 'userId is required');

      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('details');
      expect(data.details).toBe('userId is required');
    });

    test('should default to 500 status', () => {
      const response = errorResponse('Error occurred');

      expect(response.status).toBe(500);
    });
  });
});

describe('Request parsing', () => {
  describe('parseJsonBody', () => {
    test('should parse valid JSON body', async () => {
      const body = { test: 'value', number: 123 };
      const request = new Request('http://localhost/api/test', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      });

      const parsed = await parseJsonBody(request);

      expect(parsed).toEqual(body);
    });

    test('should throw error for invalid JSON', async () => {
      const request = new Request('http://localhost/api/test', {
        method: 'POST',
        body: 'invalid json{',
        headers: { 'Content-Type': 'application/json' },
      });

      await expect(parseJsonBody(request)).rejects.toThrow();
    });

    test('should throw error for empty body', async () => {
      const request = new Request('http://localhost/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      await expect(parseJsonBody(request)).rejects.toThrow();
    });
  });

  describe('getQueryParam', () => {
    test('should extract query parameter', () => {
      const url = new URL('http://localhost/api/test?userId=user_123');

      const value = getQueryParam(url, 'userId');

      expect(value).toBe('user_123');
    });

    test('should return null for missing parameter', () => {
      const url = new URL('http://localhost/api/test');

      const value = getQueryParam(url, 'userId');

      expect(value).toBeNull();
    });

    test('should handle multiple query parameters', () => {
      const url = new URL('http://localhost/api/test?userId=user_123&accountId=acc_456');

      expect(getQueryParam(url, 'userId')).toBe('user_123');
      expect(getQueryParam(url, 'accountId')).toBe('acc_456');
    });
  });

  describe('getRequiredQueryParam', () => {
    test('should extract required query parameter', () => {
      const url = new URL('http://localhost/api/test?userId=user_123');

      const value = getRequiredQueryParam(url, 'userId');

      expect(value).toBe('user_123');
    });

    test('should throw error for missing required parameter', () => {
      const url = new URL('http://localhost/api/test');

      expect(() => getRequiredQueryParam(url, 'userId')).toThrow();
    });

    test('should throw error with parameter name in message', () => {
      const url = new URL('http://localhost/api/test');

      expect(() => getRequiredQueryParam(url, 'userId')).toThrow('userId');
    });
  });
});
