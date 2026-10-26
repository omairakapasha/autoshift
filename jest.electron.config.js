// Tests for the Electron main-process code (SQLite layer, IPC). Plain Node, no jsdom.
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/electron'],
  testMatch: ['**/*.test.js'],
};
