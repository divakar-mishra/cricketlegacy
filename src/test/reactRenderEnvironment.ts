/** Keep React interaction tests strict: suppress only the renderer's known deprecation notice. */
export function configureReactRenderEnvironment() {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  let previous: boolean | undefined;
  let errors: jest.SpyInstance;
  beforeAll(() => {
    previous = environment.IS_REACT_ACT_ENVIRONMENT;
    environment.IS_REACT_ACT_ENVIRONMENT = true;
  });
  afterAll(() => {
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  });
  beforeEach(() => {
    const original = console.error;
    errors = jest.spyOn(console, 'error').mockImplementation((message, ...args) => {
      if (typeof message === 'string' && message.startsWith('react-test-renderer is deprecated.'))
        return;
      original(message, ...args);
    });
  });
  afterEach(() => errors.mockRestore());
}
