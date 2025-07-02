import { CommandRouter } from '../../src/router/command-router';
import { RouteMatcher } from '../../src/router/route-matcher';
import { Command, Middleware } from '../../src/types/command.types';

describe('RouteMatcher', () => {
  let matcher: RouteMatcher;

  beforeEach(() => {
    matcher = new RouteMatcher();
  });

  test('should match exact patterns', () => {
    matcher.register({
      pattern: 'file.create',
      handler: 'fileHandler',
      middleware: [],
    });

    const matches = matcher.match('file.create');
    expect(matches).toHaveLength(1);
    expect(matches[0].route.handler).toBe('fileHandler');
    expect(matches[0].score).toBe(100);
  });

  test('should match wildcard patterns', () => {
    matcher.register({
      pattern: 'file.*',
      handler: 'fileHandler',
      middleware: [],
    });

    expect(matcher.match('file.create')).toHaveLength(1);
    expect(matcher.match('file.read')).toHaveLength(1);
    expect(matcher.match('file.update')).toHaveLength(1);
    expect(matcher.match('code.generate')).toHaveLength(0);
  });

  test('should match regex patterns', () => {
    matcher.register({
      pattern: /^file\.(create|update)$/,
      handler: 'fileWriteHandler',
      middleware: [],
    });

    expect(matcher.match('file.create')).toHaveLength(1);
    expect(matcher.match('file.update')).toHaveLength(1);
    expect(matcher.match('file.read')).toHaveLength(0);
  });

  test('should extract parameters from patterns', () => {
    matcher.register({
      pattern: 'file.:action',
      handler: 'fileHandler',
      middleware: [],
    });

    const matches = matcher.match('file.create');
    expect(matches[0].params.action).toBe('create');
  });

  test('should sort matches by score', () => {
    matcher.register({
      pattern: 'file.*',
      handler: 'genericHandler',
      middleware: [],
    });
    matcher.register({
      pattern: 'file.create',
      handler: 'specificHandler',
      middleware: [],
    });

    const matches = matcher.match('file.create');
    expect(matches[0].route.handler).toBe('specificHandler');
    expect(matches[1].route.handler).toBe('genericHandler');
  });

  test('should handle route removal', () => {
    matcher.register({
      pattern: 'test.route',
      handler: 'testHandler',
      middleware: [],
    });

    expect(matcher.has('test.route')).toBe(true);
    expect(matcher.remove('test.route')).toBe(true);
    expect(matcher.has('test.route')).toBe(false);
  });
});

describe('CommandRouter', () => {
  let router: CommandRouter;

  beforeEach(() => {
    router = new CommandRouter();
  });

  const createTestCommand = (intent: string): Command => ({
    id: 'test-id',
    intent: { primary: intent, confidence: 1 },
    rawInput: 'test command',
    parameters: {},
    options: {},
    metadata: { source: 'cli' },
    timestamp: new Date(),
  });

  test('should register and resolve routes', async () => {
    router.route('file.create', 'fileCreateHandler');
    
    const command = createTestCommand('file.create');
    const match = await router.resolve(command);

    expect(match).toBeDefined();
    expect(match?.route.handler).toBe('fileCreateHandler');
  });

  test('should handle fallback routes', async () => {
    const routerWithFallback = new CommandRouter({
      fallbackHandler: 'defaultHandler',
    });

    const command = createTestCommand('unknown.command');
    const match = await routerWithFallback.resolve(command);

    expect(match).toBeDefined();
    expect(match?.route.handler).toBe('defaultHandler');
  });

  test('should execute middleware chain', async () => {
    const executionOrder: string[] = [];

    const middleware1: Middleware = {
      name: 'auth',
      execute: async (cmd, next) => {
        executionOrder.push('auth:before');
        const result = await next();
        executionOrder.push('auth:after');
        return result;
      },
    };

    const middleware2: Middleware = {
      name: 'logging',
      execute: async (cmd, next) => {
        executionOrder.push('logging:before');
        const result = await next();
        executionOrder.push('logging:after');
        return result;
      },
    };

    router.use(middleware1);
    router.use(middleware2);

    const command = createTestCommand('test.command');
    const result = await router.executeMiddleware(
      command,
      ['auth', 'logging'],
      async () => {
        executionOrder.push('handler');
        return { commandId: 'test', success: true, executionTime: 0, timestamp: new Date() };
      }
    );

    expect(executionOrder).toEqual([
      'auth:before',
      'logging:before',
      'handler',
      'logging:after',
      'auth:after',
    ]);
    expect(result.success).toBe(true);
  });

  test('should emit router events', async () => {
    const events: any[] = [];

    router.on('route.matched', (event) => events.push(event));
    router.on('route.notfound', (event) => events.push(event));

    router.route('test.route', 'testHandler');

    await router.resolve(createTestCommand('test.route'));
    await router.resolve(createTestCommand('unknown.route'));

    expect(events).toHaveLength(3); // 2 matched + 1 notfound
    expect(events.filter(e => e.type === 'route.matched')).toHaveLength(2);
    expect(events.filter(e => e.type === 'route.notfound')).toHaveLength(1);
  });

  test('should create sub-routers', () => {
    const subRouter = router.createSubRouter('api');
    
    subRouter.route('users.create', 'userCreateHandler');
    subRouter.route('users.list', 'userListHandler');

    expect(router.getRoute('api.users.create')).toBeDefined();
    expect(router.getRoute('api.users.list')).toBeDefined();
  });

  test('should handle middleware errors', async () => {
    const errorMiddleware: Middleware = {
      name: 'error',
      execute: async () => {
        throw new Error('Middleware error');
      },
    };

    router.use(errorMiddleware);

    const command = createTestCommand('test.command');
    
    await expect(
      router.executeMiddleware(command, ['error'], async () => ({ 
        commandId: 'test', 
        success: true, 
        executionTime: 0, 
        timestamp: new Date() 
      }))
    ).rejects.toThrow('Middleware error');
  });
});