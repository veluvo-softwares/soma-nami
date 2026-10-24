/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/src/**/*.test.ts?(x)'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  // The first render pulls in all of React Native; give a cold CI runner room.
  testTimeout: 20000,
  modulePathIgnorePatterns: ['<rootDir>/android/', '<rootDir>/ios/'],
};
