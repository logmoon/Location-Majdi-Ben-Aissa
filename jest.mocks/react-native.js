// Minimal react-native stub for Jest.
// Only the symbols actually used by the services under test need to be here.
module.exports = {
  Linking: {
    openURL: jest.fn().mockResolvedValue(undefined),
  },
  Platform: {
    OS: 'android',
    select: (obj) => obj.android ?? obj.default,
  },
  Alert: {
    alert: jest.fn(),
  },
};
