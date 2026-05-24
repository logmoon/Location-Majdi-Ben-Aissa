// Silence console output during tests so the only red you see is actual failures.
// Services intentionally call console.error on DB errors — those are verified
// via return values in the tests, not via console output.
//
// Guard: only run in Jest — Metro bundles this file for the app too, and
// `jest` doesn't exist at runtime (Hermes throws ReferenceError).
if (typeof jest !== 'undefined') {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
}
