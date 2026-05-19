/* eslint-disable @typescript-eslint/no-require-imports */
// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Provide a dummy connection string so @vercel/postgres can be imported in tests.
// The actual DB calls are mocked per-test; this just prevents the module from
// throwing during import when no .env.local is present (e.g. on CI).
if (!process.env.POSTGRES_URL) {
  process.env.POSTGRES_URL = 'postgresql://dummy:dummy@localhost:5432/dummy';
}

// Polyfill for TextEncoder/TextDecoder (needed for Next.js 15+ with Jest)
if (typeof TextEncoder === 'undefined') {
  global.TextEncoder = require('util').TextEncoder;
}
if (typeof TextDecoder === 'undefined') {
  global.TextDecoder = require('util').TextDecoder;
}

// Polyfill for Request/Response (needed for Next.js 15+ with Jest)
if (typeof Request === 'undefined') {
  const { Request, Response } = require('node-fetch');
  global.Request = Request;
  global.Response = Response;
}
