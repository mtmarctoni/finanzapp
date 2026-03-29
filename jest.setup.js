// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

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
