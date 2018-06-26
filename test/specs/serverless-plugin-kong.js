const chai = require('chai');
const dirtyChai = require('dirty-chai');

chai.use(dirtyChai);

const { expect } = chai;

const chaiHelper = require('../chai-helper');
const ServerlessPluginKong = require('../../index');
const serverlessConfig = require('../data/serverless-config');

const serverless = {
    cli: { log: () => {} },
    service: serverlessConfig
};


const serverlessPluginKong = new ServerlessPluginKong(serverless, {});

describe('Serverless Plugin Kong', () => {
    const testServiceName = `${Date.now()}`;
    const testRouteConfig = { host: 'example.com', path: '/users', method: 'GET' };

    serverlessPluginKong.serverless.service.custom.kong.service.name = testServiceName;

    it('checking functions without serverless config', () => {
        const serverlessKongPlugin = new ServerlessPluginKong();
        expect(serverlessKongPlugin.kongAdminApiCredentialConfig.profile).to
            .equal(serverlessKongPlugin.defaults.kongAdminApiCredentials.profile);

        const route = serverlessKongPlugin.getConfigurationByFunctionName('test');
        expect(route).to.equal(null);

        const routes = serverlessKongPlugin.getConfigurations();
        expect(routes.length).to.equal(0);
    });

    it('checking functions without events section in serverless config', () => {
        const serverlessKongPlugin = new ServerlessPluginKong({ service: { functions: { test: {} } } });
        expect(serverlessKongPlugin.kongAdminApiCredentialConfig.profile).to
            .equal(serverlessKongPlugin.defaults.kongAdminApiCredentials.profile);

        const route = serverlessKongPlugin.getConfigurationByFunctionName('test');
        expect(route).to.equal(null);

        const routes = serverlessKongPlugin.getConfigurations();
        expect(routes.length).to.equal(0);
    });

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

    it('should create a service', async () =>  {
        const createServiceResponse = await serverlessPluginKong.createService();
        expect(createServiceResponse.statusCode).to.equal(201);
        expect(createServiceResponse.result.id).exist();
    });

    it('should throw an error if service is not configured', async () => {
        const serviceConfig = Object.assign({}, serverlessPluginKong.serverless.service.custom.kong.service);

        serverlessPluginKong.serverless.service.custom.kong.service = null;

        await chaiHelper.asyncThrowAssertion(() => serverlessPluginKong.createService(), 'Service configuration is missing');
        serverlessPluginKong.serverless.service.custom.kong.service = serviceConfig;
    });

    it('should throw an error if service name is not configured', async () => {
        const serviceName = serverlessPluginKong.serverless.service.custom.kong.service.name;

        serverlessPluginKong.serverless.service.custom.kong.service.name = null;

        await chaiHelper.asyncThrowAssertion(() => serverlessPluginKong.createService(), 'Missing required "name" field');
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

    it('should update a service with new plugin config', async () => {
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

        const updateServiceResponse = await serverlessPluginKong.updateService();
        expect(updateServiceResponse.statusCode).to.equal(200);

        const getPluginResponse = await serverlessPluginKong.kongAdminApi.getPluginByNameRequestToService({
            serviceName: serverlessPluginKong.serverless.service.custom.kong.service.name,
            pluginName: newPlugin.name
        });

        expect(getPluginResponse).exist();
        expect(getPluginResponse.result.id).exist();
        expect(getPluginResponse.result.name).to.equal(newPlugin.name);
    });

    it('should throw an error if service is not configured when requesting for update', async () => {
        const serviceConfig = Object.assign({}, serverlessPluginKong.serverless.service.custom.kong.service);

        serverlessPluginKong.serverless.service.custom.kong.service = null;

        await chaiHelper.asyncThrowAssertion(() => serverlessPluginKong.updateService(), 'Service configuration is missing');
        serverlessPluginKong.serverless.service.custom.kong.service = serviceConfig;
    });

    it('should throw an error if service name is not configured when requesting for update', async () => {
        const serviceName = serverlessPluginKong.serverless.service.custom.kong.service.name;

        serverlessPluginKong.serverless.service.custom.kong.service.name = null;

        await chaiHelper.asyncThrowAssertion(() => serverlessPluginKong.updateService(), 'Missing required "name" field');
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

    it('should update the plugin enabled in service', async () => {
        const plugin = serverlessPluginKong.serverless.service.custom.kong.service.plugins[0];
        plugin.config.credentials = false;

        const updateServiceResponse = await serverlessPluginKong.updateService();
        expect(updateServiceResponse.statusCode).to.equal(200);

        const getPluginResponse = await serverlessPluginKong.kongAdminApi.getPluginByNameRequestToService({
            serviceName: serverlessPluginKong.serverless.service.custom.kong.service.name,
            pluginName: plugin.name
        });

        expect(getPluginResponse).exist();
        expect(getPluginResponse.result.config.credentials).to.equal(false);
    });

    it('should create a service and update it without plugins', async () => {
        const currentServiceConfig = Object.assign({}, serverlessPluginKong.kong.service);
        serverlessPluginKong.kong.service = {
            name: `${Date.now()}`
        };

        const createServiceResponse = await serverlessPluginKong.createService();
        expect(createServiceResponse.statusCode).to.equal(201);
        expect(createServiceResponse.result.id).exist();

        const updateServiceResponse = await serverlessPluginKong.updateService();
        expect(updateServiceResponse.statusCode).to.equal(200);

        serverlessPluginKong.kong.service = Object.assign({}, currentServiceConfig);

    });

    it('should create route function throw exception without required params', async () => {
        await chaiHelper.asyncThrowAssertion(() => serverlessPluginKong.createRoute({}), 'Missing required "serviceName" parameter.');
        await chaiHelper.asyncThrowAssertion(() => serverlessPluginKong.createRoute({ serviceName: 'test' }), 'Missing required "routeConfig" parameter.');
        await chaiHelper.asyncThrowAssertion(
            () => serverlessPluginKong.createRoute({ serviceName: 'test', routeConfig: {} }),
            'At least one of these fields must be non-empty'
        );
    });

    it('should create a route', async () =>  {
        const createRouteResponse = await serverlessPluginKong.createRoute({
            serviceName: testServiceName, routeConfig: testRouteConfig
        });
        expect(createRouteResponse).exist();
        expect(createRouteResponse.id).exist();
    });

    it('should create routes by reading serverless config', async () => {
        const createRouteResponse = await serverlessPluginKong.createRoutes();
        expect(createRouteResponse).exist();
        expect(createRouteResponse.statusCode).to.equal(200);
        expect(createRouteResponse.createdRoutes.length).to.above(0);
    });

    it('should create a route with function name as input param', async () => {
        serverlessPluginKong.options['function-name'] = 'test-user';
        const createRoutesResponse = await serverlessPluginKong.createRoutes();

        expect(createRoutesResponse).exist();
        expect(createRoutesResponse.statusCode).to.equal(200);
        expect(createRoutesResponse.createdRoutes.length).to.above(0);
    });

    it('should the create routes function return 404 if service is not exist', async () => {
        serverlessPluginKong.options['function-name'] = 'test-service-404';
        serverlessPluginKong.service.functions[serverlessPluginKong.options['function-name']] = {
            handler: 'functions/test/product.entry',
            events: [
                {
                    kong: {
                        service: `${Date.now()}`,
                        path: '/products',
                        method: 'get'
                    }
                }
            ],
            timeout: 3,
            warmup: true
        };

        const createRoutesResponse = await serverlessPluginKong.createRoutes();
        expect(createRoutesResponse).exist();
        expect(createRoutesResponse.statusCode).to.equal(404);
    });

    it('should update route', async () => {
        serverlessPluginKong.serverless.service.functions['test-user'].events[0].kong.preserve_host = true;
        serverlessPluginKong.options['function-name'] = 'test-user';
        serverlessPluginKong.options['non-interactive-mode'] = true;

        const updateReouteResponse = await serverlessPluginKong.updateRoute();

        expect(updateReouteResponse.statusCode).to.equal(200);
        expect(updateReouteResponse.result.preserve_host).to.equal(true);
    });

    it('should the update route function return 404 if the given function name is not configured in serverless config', async () => {
        serverlessPluginKong.options['function-name'] = `${Date.now}`;

        serverlessPluginKong.options['non-interactive-mode'] = true;

        const updateRouteResponse = await serverlessPluginKong.updateRoute();
        expect(updateRouteResponse.statusCode).to.equal(404);
    });

    it('should the update route function return 404 if the given route config is not exist in kong', async () => {
        serverlessPluginKong.options['function-name'] = `${Date.now}`;
        serverlessPluginKong.service.functions[serverlessPluginKong.options['function-name']] = {
            handler: 'functions/test/product.entry',
            events: [
                {
                    kong: {
                        service: 'test-service',
                        path: `/products${Date.now()}`,
                        method: 'get'
                    }
                }
            ],
            timeout: 3,
            warmup: true
        };

        serverlessPluginKong.options['non-interactive-mode'] = true;

        const updateRouteResponse = await serverlessPluginKong.updateRoute();
        expect(updateRouteResponse.statusCode).to.equal(404);
    });

    it('should delete route', async () => {
        serverlessPluginKong.options['function-name'] = 'test-user';
        serverlessPluginKong.options['non-interactive-mode'] = true;

        const deleteRouteResponse = await serverlessPluginKong.deleteRoute();
        expect(deleteRouteResponse.statusCode).to.equal(204);
    });

    it('should return 404 if the given function name is not configured', async () => {
        serverlessPluginKong.options['function-name'] = `${Date.now()}`;
        serverlessPluginKong.options['non-interactive-mode'] = true;

        const deleteRouteResponse = await serverlessPluginKong.deleteRoute();
        expect(deleteRouteResponse.statusCode).to.equal(404);
    });

    it('should return 404 if the route config is missing', async () => {
        serverlessPluginKong.options['function-name'] = `${Date.now()}`;
        serverlessPluginKong.service.functions[serverlessPluginKong.options['function-name']] = {
            handler: 'functions/test/product.entry',
            events: [
                {
                    kong: {
                        service: 'test-service',
                        path: `/products${Date.now()}`,
                        method: 'get'
                    }
                }
            ],
            timeout: 3,
            warmup: true
        };

        serverlessPluginKong.options['non-interactive-mode'] = true;

        const deleteRouteResponse = await serverlessPluginKong.deleteRoute();
        expect(deleteRouteResponse.statusCode).to.equal(404);
    });
});
