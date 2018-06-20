const KongAdminApi = require('../../kong-admin-api');
const chai = require('chai');
const dirtyChai = require('dirty-chai');

chai.use(dirtyChai);
const { expect } = chai;

const serverless = { cli: { log: () => {} } };

serverless.service = require('../data/serverless-config');

const ServerlessPluginKong = require('../../index');

const serverlessPluginKong = new ServerlessPluginKong(serverless, {});


describe('Serverless Plugin Kong', () => {
    const testServiceName = `${Date.now()}`;
    const testRouteConfig = { host: 'example.com', path: '/users', methods: 'GET' };

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

    it('should create a service', () => serverlessPluginKong.createService({ serviceName: testServiceName, upstreamUrl: 'http://127.0.0.1' }).then(result => {
        expect(result.statusCode).to.equal(201);
        expect(result.result.id).exist();
    }));

    it('should create a route', () => serverlessPluginKong.createRoute({ serviceName: testServiceName, routeConfig: testRouteConfig }).then(result => {
        expect(result).exist();
        expect(result.id).exist();
    }));

});
