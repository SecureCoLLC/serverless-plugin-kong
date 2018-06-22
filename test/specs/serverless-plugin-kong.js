const chai = require('chai');
const dirtyChai = require('dirty-chai');

chai.use(dirtyChai);
const { expect } = chai;

const serverless = { cli: { log: () => {} } };
// const serverless = { cli: console };

serverless.service = require('../data/serverless-config');

const ServerlessPluginKong = require('../../index');

const serverlessPluginKong = new ServerlessPluginKong(serverless, {});


describe('Serverless Plugin Kong', () => {
    const testServiceName = `${Date.now()}`;
    const testRouteConfig = { host: 'example.com', path: '/users', method: 'GET' };

    serverlessPluginKong.serverless.service.custom.kong.service.name = testServiceName;

    it('should fetch configuration by function name', () => {
        const config = serverlessPluginKong.getConfigurationByFunctionName('test-user');
        expect(config).exist();
        expect(config.service).exist();
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
