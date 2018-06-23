const chai = require('chai');
const dirtyChai = require('dirty-chai');

chai.use(dirtyChai);

const { expect } = chai;

const serverless = { cli: { log: () => {} } };
// const serverless = { cli: console };

serverless.service = require('../data/serverless-config');

const ServerlessPluginKong = require('../../index');

const serverlessPluginKong = new ServerlessPluginKong(serverless, {});

serverlessPluginKong.defaults = {
    kongAdminApiCredentials: {
        fileName: 'credentials.json',
        defaultPaths: ['./test/data/.kong', '~/.kong']
    },
    upstreamUrl: 'http://127.0.0.1:80/'
};

// Helper function to handle exceptions with promise/async. Chai throw assertion is not working with promise/async.
const asyncThrowAssertion = async (fn, expectedMessage) => {
    if (!fn || typeof fn !== 'function') {
        throw new Error(`This is not a function ${fn}`);
    }

    let errorMessage;

    await fn().catch(e => {
        errorMessage = (e && e.message) || e;
    });

    expect(() => {
        if (errorMessage) {
            throw new Error(errorMessage);
        }
    }).to.throw(expectedMessage);
};

describe('Serverless Plugin Kong', () => {
    const testServiceName = `${Date.now()}`;
    const testRouteConfig = { host: 'example.com', path: '/users', method: 'GET' };

    serverlessPluginKong.serverless.service.custom.kong.service.name = testServiceName;

    it('should fetch kong admin api credentials', () => {
        const kongAdminApiCredentials = serverlessPluginKong.getKongAdminApiCredentials();
        expect(kongAdminApiCredentials).exist();
        expect(kongAdminApiCredentials.url).exist();
    });

    it('should fetch kong admin api credentials from default path if not configured', () => {
        const currentKongAdminApiCredentialFilePath = serverlessPluginKong.kongAdminApiCredentialConfig.path;

        serverlessPluginKong.kongAdminApiCredentialConfig.path = '';

        const kongAdminApiCredentials = serverlessPluginKong.getKongAdminApiCredentials();

        expect(kongAdminApiCredentials).exist();
        expect(kongAdminApiCredentials.url).exist();

        serverlessPluginKong.kongAdminApiCredentialConfig.path = currentKongAdminApiCredentialFilePath;
    });

    it('should throw an exception if kong admin api credential path is not configured or not placed a file in default path.', () => {
        const currentKongAdminApiCredentialFilePath = serverlessPluginKong.kongAdminApiCredentialConfig.path;
        const KongAdminApiCredentialFileDefaultPaths =
            serverlessPluginKong.defaults.kongAdminApiCredentials.defaultPaths;

        serverlessPluginKong.kongAdminApiCredentialConfig.path = '';
        serverlessPluginKong.defaults.kongAdminApiCredentials.defaultPaths = [];

        expect(() => { serverlessPluginKong.getKongAdminApiCredentials(); }).to.throw('Kong admin credentials path is not configured. ' +
            'You can configured it in serverless custom kong configuration section');

        serverlessPluginKong.kongAdminApiCredentialConfig.path = currentKongAdminApiCredentialFilePath;
        serverlessPluginKong.defaults.kongAdminApiCredentials.defaultPaths = KongAdminApiCredentialFileDefaultPaths;
    });

    it('should throw an exception if kong admin api credential file is empty', () => {
        const currentKongAdminApiCredentialFilePath = serverlessPluginKong.kongAdminApiCredentialConfig.path;

        serverlessPluginKong.kongAdminApiCredentialConfig.path = './test/data/.kong/credentials-empty.json';

        expect(() => { serverlessPluginKong.getKongAdminApiCredentials(); }).to.throw('Missing kong admin configuration');

        serverlessPluginKong.kongAdminApiCredentialConfig.path = currentKongAdminApiCredentialFilePath;
    });

    it('should fetch configuration by function name', () => {
        const config = serverlessPluginKong.getConfigurationByFunctionName('test-user');
        expect(config).exist();
        expect(config.service).exist();
    });

    it('should throw an error if function name is not passed to this method getConfigurationByFunctionName', () => {
        expect(() => { serverlessPluginKong.getConfigurationByFunctionName(); }).throw('Missing required "functionName" parameter');
    });

    it('should fetch configuration', () => {
        const config = serverlessPluginKong.getConfigurations();
        expect(config).exist();
        expect(config.length).above(0);
    });

    it('should create a service', () => serverlessPluginKong.createService().then(result => {
        expect(result.statusCode).to.equal(201);
        expect(result.result.id).exist();
    }));

    it('should throw an error if service is not configured', async () => {
        const serviceConfig = Object.assign({}, serverlessPluginKong.serverless.service.custom.kong.service);

        serverlessPluginKong.serverless.service.custom.kong.service = null;

        await asyncThrowAssertion(() => serverlessPluginKong.createService(), 'Service configuration is missing');
        serverlessPluginKong.serverless.service.custom.kong.service = serviceConfig;
    });

    it('should throw an error if service name is not configured', async () => {
        const serviceName = serverlessPluginKong.serverless.service.custom.kong.service.name;

        serverlessPluginKong.serverless.service.custom.kong.service.name = null;

        await asyncThrowAssertion(() => serverlessPluginKong.createService(), 'Missing required "name" field');
        serverlessPluginKong.serverless.service.custom.kong.service.name = serviceName;
    });

    it('should throw an error if service is already exist', async () => {
        const currentServiceName = serverlessPluginKong.serverless.service.custom.kong.service.name;
        const newServiceName = `${Date.now()}`;

        await serverlessPluginKong.kongAdminApi.createService({
            serviceName: newServiceName, upstreamUrl: 'http://exmple.com'
        });

        serverlessPluginKong.serverless.service.custom.kong.service.name = newServiceName;

        const expectedException = `The service "${newServiceName}" is already exist`;

        const result = await serverlessPluginKong.createService();
        expect(result.error).to.equal(expectedException);

        serverlessPluginKong.serverless.service.custom.kong.service.name = currentServiceName;
    });

    it('should update a service with new plugin config', () => {
        const newPlugin = {
            name: 'aws-lambda',
            config: {
                aws_region: 'us-east-1',
                aws_key: 'AWS_ACCESS_KEY_ID',
                aws_secret: 'AWS_SECRET_ACCESS_KEY',
                function_name: 'paltalk-livesearch-dev-ptlive-new'
            }
        };
        serverlessPluginKong.serverless.service.custom.kong.service.plugins.push(newPlugin);

        return serverlessPluginKong.updateService().then(result => {
            expect(result.statusCode).to.equal(200);
            return serverlessPluginKong.kongAdminApi.getPluginByNameRequestToService({
                serviceName: serverlessPluginKong.serverless.service.custom.kong.service.name,
                pluginName: newPlugin.name
            });
        }).then(result => {
            expect(result).exist();
            expect(result.result.id).exist();
            expect(result.result.name).to.equal(newPlugin.name);
        });
    });

    it('should throw an error if service is not configured when requesting for update', async () => {
        const serviceConfig = Object.assign({}, serverlessPluginKong.serverless.service.custom.kong.service);

        serverlessPluginKong.serverless.service.custom.kong.service = null;

        await asyncThrowAssertion(() => serverlessPluginKong.updateService(), 'Service configuration is missing');
        serverlessPluginKong.serverless.service.custom.kong.service = serviceConfig;
    });

    it('should throw an error if service name is not configured when requesting for update', async () => {
        const serviceName = serverlessPluginKong.serverless.service.custom.kong.service.name;

        serverlessPluginKong.serverless.service.custom.kong.service.name = null;

        await asyncThrowAssertion(() => serverlessPluginKong.updateService(), 'Missing required "name" field');
        serverlessPluginKong.serverless.service.custom.kong.service.name = serviceName;
    });

    it('should throw an error if service is not already exist when requesting for update', async () => {
        const currentServiceName = serverlessPluginKong.serverless.service.custom.kong.service.name;
        const newServiceName = `${Date.now()}`;

        serverlessPluginKong.serverless.service.custom.kong.service.name = newServiceName;

        const result = await serverlessPluginKong.updateService();
        expect(result.statusCode).to.equal(404);

        serverlessPluginKong.serverless.service.custom.kong.service.name = currentServiceName;
    });

    it('should update the plugin enabled in service', () => {
        const plugin = serverlessPluginKong.serverless.service.custom.kong.service.plugins[0];
        plugin.config.credentials = false;

        return serverlessPluginKong.updateService().then(result => {
            expect(result.statusCode).to.equal(200);
            return serverlessPluginKong.kongAdminApi.getPluginByNameRequestToService({
                serviceName: serverlessPluginKong.serverless.service.custom.kong.service.name,
                pluginName: plugin.name
            });
        }).then(result => {
            expect(result).exist();
            expect(result.result.config.credentials).to.equal(false);
        });
    });

    it('should create a route', () => serverlessPluginKong.createRoute({ serviceName: testServiceName, routeConfig: testRouteConfig }).then(result => {
        expect(result).exist();
        expect(result.id).exist();
    }));

    it('should create routes by reading serverless config', () => serverlessPluginKong.createRoutes().then(result => {
        expect(result).exist();
    }));

    it('should update route', () => {
        serverlessPluginKong.serverless.service.functions['test-user'].events[0].kong.preserve_host = true;
        serverlessPluginKong.options['function-name'] = 'test-user';
        serverlessPluginKong.options['non-interactive-mode'] = true;
        return serverlessPluginKong.updateRoute().then(result => {
            expect(result.statusCode).to.equal(200);
            expect(result.result.preserve_host).to.equal(true);
        });
    });

    it('should delete route', () => {
        serverlessPluginKong.options['function-name'] = 'test-user';
        serverlessPluginKong.options['non-interactive-mode'] = true;
        return serverlessPluginKong.deleteRoute().then(result => {
            expect(result.statusCode).to.equal(204);
        });
    });
});
