/**
 * Test Environment Setup
 * Focus:
 * - Initialize required environment variables for tests
 * - Silence log outputs to keep test runner output focused
 */

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.PORT = '4001';
process.env.CLIENT_ORIGIN = 'http://localhost';
process.env.JWT_SECRET = 'test-jwt-secret-token-key-for-unit-tests';
process.env.JWT_EXPIRES_IN = '1d';
process.env.COOKIE_NAME = 'flux_auth_token';
process.env.COOKIE_SECURE = 'false';
process.env.COOKIE_SAME_SITE = 'lax';
process.env.CLIENT_SUCCESS_REDIRECT = 'http://localhost/auth/success';
process.env.CLIENT_FAILURE_REDIRECT = 'http://localhost/auth/failure';
process.env.MONGODB_URI = '';
process.env.MONGODB_DB_NAME = 'flux_auth_test';
process.env.GOOGLE_CLIENT_ID = '';
process.env.GOOGLE_CLIENT_SECRET = '';
process.env.GITHUB_CLIENT_ID = '';
process.env.GITHUB_CLIENT_SECRET = '';
