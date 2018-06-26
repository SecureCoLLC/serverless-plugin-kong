const uuidv4 = require('uuid/v4');
const chai = require('chai');
const dirtyChai = require('dirty-chai');


chai.use(dirtyChai);
const { expect } = chai;

const chaiHelper = require('../chai-helper');
const KongAdminApi = require('../../kong-admin-api');

const kongAdminApi = new KongAdminApi({
    adminApiUrl: 'http://localhost:8001', adminApiHeaders: {}
});

describe('Kong Admin Api Helper', () => {
    const serviceName = `service_${Date.now()}`;
    const routeConfig = { hosts: ['example.com'], paths: ['/users'], methods: ['GET'] };
    const pluginConfig = {
        name: 'cors',
        config: {
            origins: '*',
            methods: 'GET, POST',
            headers: 'Accept, Authorization, Accept-Version, Content-Length, Content-Type, Date, X-Auth-Token',
            exposed_headers: 'X-Auth-Token',
            credentials: true,
            max_age: 3600
        }
    };

    let testRouteId;
    let testPluginId;

    it('should throw an exception if config param is not passed', () => {
        expect(() => new KongAdminApi()).to.throw('adminApiUrl is mandatory');
    });

    it('should throw an exception if service name is not passed to the getService function', async () => {
        await chaiHelper.asyncThrowAssertion(() => kongAdminApi.getService({}), 'Missing required "serviceName" parameter.');
    });

    it('should throw an exception if service name is not passed to the create service function', async () => {
        await chaiHelper.asyncThrowAssertion(() => kongAdminApi.createService({}), 'Missing required "serviceName" parameter.');
    });

    it('should throw an exception if upstreamUrl is not passed to the create service function', async () => {
        await chaiHelper.asyncThrowAssertion(() => kongAdminApi.createService({ serviceName }), 'Missing required "upstreamUrl" parameter.');
    });

    it('should create a new service', async () => {
        const createServiceResponse = await kongAdminApi.createService({
            serviceName, upstreamUrl: 'http://127.0.0.1:80'
        });
        expect(createServiceResponse.statusCode).to.equal(201);
        expect(createServiceResponse.result.id).exist();
    });

    it('should throw an exception if service is already exist.', async () => {
        await chaiHelper.asyncThrowAssertion(() => kongAdminApi.createService({ serviceName, upstreamUrl: 'http://127.0.0.1:80' }), `Service "${serviceName}" is already exist`);
    });

    it('should throw an exception if service name is not passed to the create route function', async () => {
        await chaiHelper.asyncThrowAssertion(() => kongAdminApi.createRoute({}), 'Missing required "serviceName" parameter.');
    });

    it('should throw an exception if routeConfig is not passed to the create route function', async () => {
        await chaiHelper.asyncThrowAssertion(() => kongAdminApi.createRoute({ serviceName }), 'Missing required "routeConfig" parameter.');
    });

    it('should throw an exception if the required route config fields are not passed to the create route function.', async () => {
        await chaiHelper.asyncThrowAssertion(() => kongAdminApi.createRoute({ serviceName, routeConfig: {} }), 'At least one of these fields must be non-empty');
    });

    it('should throw an exception if the given service is not exist when trigger create route function', async () => {
        const testServiceName = `${Date.now()}`;
        await chaiHelper.asyncThrowAssertion(() => kongAdminApi.createRoute({ serviceName: testServiceName, routeConfig: { hosts: 'test' } }), `Service "${testServiceName}" is not exist`);
    });

    it('should create a new route', async () => {
        const createRouteResponse = await kongAdminApi.createRoute({ serviceName, routeConfig });
        expect(createRouteResponse.statusCode).to.equal(201);
        expect(createRouteResponse.result.id).exist();
        testRouteId = createRouteResponse.result.id;
    });

    it('should throw an exception if route id is not passed to the update route function', async () => {
        await chaiHelper.asyncThrowAssertion(() => kongAdminApi.updateRoute({}), 'Missing required "routeId" parameter.');
    });

    it('should throw an exception if route config is not passed to the update route function', async () => {
        await chaiHelper.asyncThrowAssertion(() => kongAdminApi.updateRoute({ routeId: testRouteId }), 'Missing required "routeConfig" parameter.');
    });

    it('should throw an exception if route config is not passed to the update route function', async () => {
        await chaiHelper.asyncThrowAssertion(() => kongAdminApi.updateRoute({ routeId: 'test-id', routeConfig: {} }), 'At least one of these fields must be non-empty:');
    });

    it('should update the route', async () => {
        const updateRouteResponse = await kongAdminApi.updateRoute({
            routeId: testRouteId, routeConfig: Object.assign({}, routeConfig, { preserve_host: true })
        });
        expect(updateRouteResponse.statusCode).to.equal(200);
        expect(updateRouteResponse.result.preserve_host).to.equal(true);
    });

    it('should generate unique key for route by combining hosts, paths and methods', () => {
        const paths = ['/users', '/products'];
        const hosts = ['example.com', 'www.example.com'];
        const methods = ['GET', 'POST'];

        expect(kongAdminApi.generateUniqueKeyForRoute({ routeConfig: { paths } })).to.equal('/products,/users');
        expect(kongAdminApi.generateUniqueKeyForRoute({ routeConfig: { paths, hosts } })).to.equal('example.com,www.example.com|/products,/users');
        expect(kongAdminApi.generateUniqueKeyForRoute({ routeConfig: { paths, hosts, methods } })).to.equal('example.com,www.example.com|/products,/users|GET,POST');
    });

    it('should throw an exception if required fields are not passed to the createPluginRequestToService function', async () => {
        const testServiceName = `${Date.now()}`;
        await chaiHelper.asyncThrowAssertion(() => kongAdminApi.createPluginRequestToService({}), 'Missing required "serviceName" parameter.');
        await chaiHelper.asyncThrowAssertion(() => kongAdminApi.createPluginRequestToService({ serviceName }), 'Missing required "pluginConfig" parameter.');
        await chaiHelper.asyncThrowAssertion(() => kongAdminApi.createPluginRequestToService({ serviceName, pluginConfig: {} }), 'Missing required field "name" in "pluginConfig" parameter');
        await chaiHelper.asyncThrowAssertion(() => kongAdminApi.createPluginRequestToService({ serviceName: testServiceName, pluginConfig: { name: 'cors' } }), `Service "${testServiceName}" is not exist`);
    });

    it('should enable a plugin in a service', async () => {
        const createPluginResponse = await kongAdminApi.createPluginRequestToService({ serviceName, pluginConfig });
        expect(createPluginResponse.statusCode).to.equal(201);
        expect(createPluginResponse.result.id).exist();
        testPluginId = createPluginResponse.result.id;
    });

    it('should throw an exception if required fields are not passed to the createPluginRequestToRoute function', async () => {
        await chaiHelper.asyncThrowAssertion(() => kongAdminApi.createPluginRequestToRoute({}), 'Missing required "routeId" parameter.');
        await chaiHelper.asyncThrowAssertion(() => kongAdminApi.createPluginRequestToRoute({ routeId: testRouteId }), 'Missing required "pluginConfig" parameter.');
        await chaiHelper.asyncThrowAssertion(() => kongAdminApi.createPluginRequestToRoute({ routeId: testRouteId, pluginConfig: {} }), 'Missing required field "name" in "pluginConfig" parameter');
        await chaiHelper.asyncThrowAssertion(() => kongAdminApi.createPluginRequestToRoute({ routeId: uuidv4(), pluginConfig: { name: 'cors' } }), 'There is no route exist with this ID');
    });

    it('should enable a plugin in a service', async () => {
        const creatPluginResponse = await kongAdminApi.createPluginRequestToRoute({
            routeId: testRouteId, pluginConfig
        });
        expect(creatPluginResponse.statusCode).to.equal(201);
    });

    it('should fetch a service', async () => {
        const getServiceResponse = await kongAdminApi.getService({ serviceName });
        expect(getServiceResponse.statusCode).to.equal(200);
        expect(getServiceResponse.result.name).to.equal(serviceName);
    });

    it('should throw an exception if serviceName is not passed to getRoutes function', async () => {
        await chaiHelper.asyncThrowAssertion(() => kongAdminApi.getRoutes({ }), 'Missing required "serviceName" parameter.');
    });

    it('should fetch routes of service', async () => {
        const getRoutesResponse = await kongAdminApi.getRoutes({ serviceName });
        expect(getRoutesResponse.statusCode).to.equal(200);
        expect(getRoutesResponse.result.data.length).above(0);
    });

    it('should throw an exception if required params are not passed to the getRouteByConfig function', async () => {
        await chaiHelper.asyncThrowAssertion(() => kongAdminApi.getRouteByConfig({ }), 'Missing required "serviceName" parameter.');
        await chaiHelper.asyncThrowAssertion(() => kongAdminApi.getRouteByConfig({ serviceName }), 'Missing required "routeConfig" parameter.');
        await chaiHelper.asyncThrowAssertion(() => kongAdminApi.getRouteByConfig({ serviceName, routeConfig: {} }), 'At least one of these fields must be non-empty');
    });

    it('should fetch a route by route config', async () => {
        const getRouteResponse = await kongAdminApi.getRouteByConfig({ serviceName, routeConfig });
        expect(getRouteResponse.statusCode).to.equal(200);
    });

    it('should throw an exception if routeId is not passed to the getRoute function', async () => {
        await chaiHelper.asyncThrowAssertion(() => kongAdminApi.getRoute({ }), 'Missing required "routeId" parameter.');
    });

    it('should fetch a route by Id', async () => {
        const getRouteResponse = await kongAdminApi.getRoute({ routeId: testRouteId });
        expect(getRouteResponse.statusCode).to.equal(200);
    });

    it('should throw an exception if service name is not passed to the getPluginsRequestToService function', async () => {
        await chaiHelper.asyncThrowAssertion(() => kongAdminApi.getPluginsRequestToService({}), 'Missing required "serviceName" parameter.');
    });

    it('should fetch the plugins in service', async () =>  {
        const getPluginsResponse = await kongAdminApi.getPluginsRequestToService({ serviceName });
        expect(getPluginsResponse.statusCode).to.equal(200);
        expect(getPluginsResponse.result.data.length).above(0);
    });

    it('should throw an exception if routeId is not passed to the getPluginsRequestToRoute function', async () => {
        await chaiHelper.asyncThrowAssertion(() => kongAdminApi.getPluginsRequestToRoute({}), 'Missing required "routeId" parameter.');
    });

    it('should fetch the plugins in route', async () => {
        const getPluginRequestResponse = await kongAdminApi.getPluginsRequestToRoute({ routeId: testRouteId });
        expect(getPluginRequestResponse.statusCode).to.equal(200);
        expect(getPluginRequestResponse.result.data.length).above(0);
    });

    it('should throw an exception if required params are not passed to the getPluginByNameRequestToService function', async () => {
        await chaiHelper.asyncThrowAssertion(() => kongAdminApi.getPluginByNameRequestToService({}), 'Missing required "serviceName" parameter.');
        await chaiHelper.asyncThrowAssertion(() => kongAdminApi.getPluginByNameRequestToService({ serviceName }), 'Missing required "pluginName" parameter.');
    });


    it('should fetch the plugin in service by name', async () => {
        const getPluginResponse = await kongAdminApi.getPluginByNameRequestToService({
            serviceName, pluginName: pluginConfig.name
        });

        expect(getPluginResponse.statusCode).to.equal(200);
    });

    it('should throw an exception if required params are not passed to the getPluginByNameRequestToRoute function', async () => {
        await chaiHelper.asyncThrowAssertion(() => kongAdminApi.getPluginByNameRequestToRoute({}), 'Missing required "routeId" parameter.');
        await chaiHelper.asyncThrowAssertion(() => kongAdminApi.getPluginByNameRequestToRoute({ routeId: testRouteId }), 'Missing required "pluginName" parameter.');
        const result = await kongAdminApi.getPluginByNameRequestToRoute({ routeId: testRouteId, pluginName: 'kong' });
        expect(result).exist();
    });


    it('should fetch the plugin in route by name', async () => {
        const getPluginResponse = await kongAdminApi.getPluginByNameRequestToRoute({
            routeId: testRouteId, pluginName: pluginConfig.name
        });
        expect(getPluginResponse.statusCode).to.equal(200);
    });

    it('should throw an exception if service name is not passed to the isServiceExist function', async () => {
        await chaiHelper.asyncThrowAssertion(() => kongAdminApi.isServiceExist({}), 'Missing required "serviceName" parameter.');
    });

    it('check if service exist, should return true', async () => {
        const isServiceExist = await kongAdminApi.isServiceExist({ serviceName });
        expect(isServiceExist).to.equal(true);
    });

    it('check if service exist, should return false', async () => {
        const isServiceExist = await kongAdminApi.isServiceExist({ serviceName: `${Date.now()}` });
        expect(isServiceExist).to.equal(false);
    });

    it('should throw an exception if service name is not passed to the isPluginExistRequestToService function', async () => {
        await chaiHelper.asyncThrowAssertion(() => kongAdminApi.isPluginExistRequestToService({}), 'Missing required "serviceName" parameter.');
        await chaiHelper.asyncThrowAssertion(() => kongAdminApi.isPluginExistRequestToService({ serviceName }), 'Missing required "pluginName" parameter.');
    });

    it('check if the plugin exist in service, should return true', async () => {
        const isPluginExist = await kongAdminApi.isPluginExistRequestToService({
            serviceName, pluginName: pluginConfig.name
        });
        expect(isPluginExist).to.equal(true);
    });

    it('check if the plugin exist in service, should return false', async () => {
        const isPluginExist = await kongAdminApi.isPluginExistRequestToService({ serviceName, pluginName: `${Date.now()}` });
        expect(isPluginExist).to.equal(false);
    });

    it('should throw an exception if pluginId is not passed to the getPlugin function', async () => {
        await chaiHelper.asyncThrowAssertion(() => kongAdminApi.getPlugin({}), 'Missing required "pluginId" parameter.');
    });

    it('should fetch plugin by id', async () => {
        const getPluginResponse = await kongAdminApi.getPlugin({ pluginId: testPluginId });
        expect(getPluginResponse.statusCode).to.equal(200);
        expect(getPluginResponse.result.id).exist();
    });

    it('should throw an exception if required fields are not passed to the updatePlugin function', async () => {
        await chaiHelper.asyncThrowAssertion(() => kongAdminApi.updatePlugin({}), 'Missing required "pluginId" parameter.');
        await chaiHelper.asyncThrowAssertion(() => kongAdminApi.updatePlugin({ pluginId: testPluginId }), 'Missing required "pluginConfig" parameter.');
        await chaiHelper.asyncThrowAssertion(() => kongAdminApi.updatePlugin({ pluginId: testPluginId, pluginConfig: {} }), 'Missing required field "name" in "pluginConfig" parameter');
    });

    it('should update the plugin', async () => {
        const updatePluginResponse = await kongAdminApi.updatePlugin({ pluginId: testPluginId, pluginConfig: Object.assign({}, pluginConfig, { config: { methods: 'GET' } }) });
        expect(updatePluginResponse.statusCode).to.equal(200);
        expect(updatePluginResponse.result.config.methods[0]).to.equal('GET');
    });

    it('should throw an exception if plugin id is not passed to the deletePlugin function', async () => {
        await chaiHelper.asyncThrowAssertion(() => kongAdminApi.deletePlugin({}), 'Missing required "pluginId" parameter.');
    });

    it('should delete the plugin', async () => {
        const deletePluginResponse = await kongAdminApi.deletePlugin({ pluginId: testPluginId });
        expect(deletePluginResponse.statusCode).to.equal(204);

        const getPluginResponse = await kongAdminApi.getPlugin({ pluginId: testPluginId });
        expect(getPluginResponse.statusCode).to.equal(404);
    });

    it('should throw an exception if routeId is not passed to the deleteRoute function', async () => {
        await chaiHelper.asyncThrowAssertion(() => kongAdminApi.deleteRoute({}), 'Missing required "routeId" parameter.');
    });

    it('should return empty result if route config is not passed to the generateUniqueKeyForRoute function', () => {
        const result = kongAdminApi.generateUniqueKeyForRoute({});
        expect(result).to.equal('');
    });

    it('should return result if paths fileds is passed to the generateUniqueKeyForRoute function', () => {
        const result = kongAdminApi.generateUniqueKeyForRoute({ routeConfig: { paths: ['/user', '/product'] } });
        expect(result).to.equal('/product,/user');
    });

    it('should delete a route', async () => {
        const deleteRouteResponse = await kongAdminApi.deleteRoute({ routeId: testRouteId });
        expect(deleteRouteResponse.statusCode).to.equal(204);

        const getRouteResponse = await kongAdminApi.getRoute({ routeId: testRouteId });
        expect(getRouteResponse.statusCode).to.equal(404);
    });

    it('should throw an exception if service name is not passed to delete service function', async () => {
        await chaiHelper.asyncThrowAssertion(() => kongAdminApi.deleteService({}), 'Missing required "serviceName" parameter.');
    });

    it('should delete a service', async () => {
        const deleteServiceResponse = await kongAdminApi.deleteService({ serviceName });
        expect(deleteServiceResponse.statusCode).to.equal(204);

        const isServiceExist = await kongAdminApi.isServiceExist({ serviceName });
        expect(isServiceExist).to.equal(false);
    });
});

