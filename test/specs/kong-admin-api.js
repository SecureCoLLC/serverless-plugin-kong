const KongAdminApi = require('../../kong-admin-api');
const chai = require('chai');
const dirtyChai = require('dirty-chai');

chai.use(dirtyChai);
const { expect } = chai;

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

    it('should create a new service', () => kongAdminApi.createService({ serviceName, upstreamUrl: 'http://127.0.0.1:80' }).then(result => {
        expect(result.statusCode).to.equal(201);
        expect(result.result.id).exist();
    }));

    it('should create a new route', () => kongAdminApi.createRoute({ serviceName, routeConfig }).then(result => {
        expect(result.statusCode).to.equal(201);
        expect(result.result.id).exist();
        testRouteId = result.result.id;
    }));

    it('should update the route', () => kongAdminApi.updateRoute({ routeId: testRouteId, routeConfig: Object.assign({}, routeConfig, { preserve_host: true }) }).then(result => {
        expect(result.statusCode).to.equal(200);
        expect(result.result.preserve_host).to.equal(true);
    }));

    it('should generate unique key for route by combining hosts, paths and methods', () => {
        const paths = ['/users', '/products'];
        const hosts = ['example.com', 'www.example.com'];
        const methods = ['GET', 'POST'];

        expect(kongAdminApi.generateUniqueKeyForRoute({ routeConfig: { paths } })).to.equal('/products,/users');
        expect(kongAdminApi.generateUniqueKeyForRoute({ routeConfig: { paths, hosts } })).to.equal('example.com,www.example.com|/products,/users');
        expect(kongAdminApi.generateUniqueKeyForRoute({ routeConfig: { paths, hosts, methods } })).to.equal('example.com,www.example.com|/products,/users|GET,POST');

    });

    it('should enable a plugin in a service', () => kongAdminApi.createPluginRequestToService({ serviceName, pluginConfig }).then(result => {
        expect(result.statusCode).to.equal(201);
        expect(result.result.id).exist();
        testPluginId = result.result.id;
    }));

    it('should enable a plugin in a service', () => kongAdminApi.createPluginRequestToRoute({ routeId: testRouteId, pluginConfig }).then(result => {
        expect(result.statusCode).to.equal(201);
    }));

    it('should fetch a service', () => kongAdminApi.getService({ serviceName }).then(result => {
        expect(result.statusCode).to.equal(200);
        expect(result.result.name).to.equal(serviceName);
    }));

    it('should fetch routes of service', () => kongAdminApi.getRoutes({ serviceName }).then(result => {
        expect(result.statusCode).to.equal(200);
        expect(result.result.data.length).above(0);
    }));

    it('should fetch a route by route config', () => kongAdminApi.getRouteByConfig({ serviceName, routeConfig }).then(result => {
        expect(result.statusCode).to.equal(200);
    }));

    it('should fetch a route by Id', () => kongAdminApi.getRoute({ routeId: testRouteId }).then(result => {
        expect(result.statusCode).to.equal(200);
    }));

    it('should fetch the plugins in service', () => kongAdminApi.getPluginsRequestToService({ serviceName }).then(result => {
        expect(result.statusCode).to.equal(200);
        expect(result.result.data.length).above(0);
    }));

    it('should fetch the plugins in route', () => kongAdminApi.getPluginsRequestToRoute({ routeId: testRouteId }).then(result => {
        expect(result.statusCode).to.equal(200);
        expect(result.result.data.length).above(0);
    }));

    it('should fetch the plugin in service by name', () => kongAdminApi.getPluginByNameRequestToService({ serviceName, pluginName: pluginConfig.name }).then(result => {
        expect(result.statusCode).to.equal(200);
    }));

    it('should fetch the plugin in route by name', () => kongAdminApi.getPluginByNameRequestToRoute({ routeId: testRouteId, pluginName: pluginConfig.name }).then(result => {
        expect(result.statusCode).to.equal(200);
    }));

    it('check if service exist, should return true', () => kongAdminApi.isServiceExist({ serviceName }).then(result => {
        expect(result).to.equal(true);
    }));

    it('check if service exist, should return false', () => kongAdminApi.isServiceExist({ serviceName: `${Date.now()}` }).then(result => {
        expect(result).to.equal(false);
    }));

    it('check if the plugin exist in service, should return true', () => kongAdminApi.isPluginExistRequestToService({ serviceName, pluginName: pluginConfig.name }).then(result => {
        expect(result).to.equal(true);
    }));

    it('check if the plugin exist in service, should return false', () => kongAdminApi.isPluginExistRequestToService({ serviceName, pluginName: 'not_exist' }).then(result => {
        expect(result).to.equal(false);
    }));

    it('should fetch plugin by id', () => kongAdminApi.getPlugin({ pluginId: testPluginId }).then(result => {
        expect(result.statusCode).to.equal(200);
        expect(result.result.id).exist();
    }));

    it('should update the plugin', () => kongAdminApi.updatePlugin({ pluginId: testPluginId, pluginConfig: Object.assign({}, pluginConfig, { config: { methods: 'GET' } }) }).then(result => {
        expect(result.statusCode).to.equal(200);
        expect(result.result.config.methods[0]).to.equal('GET');
    }));

    it('should delete the plugin', () => kongAdminApi.deletePlugin({ pluginId: testPluginId }).then(result => {
        expect(result.statusCode).to.equal(204);
        return kongAdminApi.getPlugin({ pluginId: testPluginId });
    }).then(result => {
        expect(result.statusCode).to.equal(404);
    }));

    it('should delete a route', () => kongAdminApi.deleteRoute({ routeId: testRouteId }).then(result => {
        expect(result.statusCode).to.equal(204);
        return kongAdminApi.getRoute({ routeId: testRouteId });
    }).then(result => {
        expect(result.statusCode).to.equal(404);
    }));

    it('should delete a service', () => kongAdminApi.deleteService({ serviceName }).then(result => {
        expect(result.statusCode).to.equal(204);
        return kongAdminApi.isServiceExist({ serviceName });
    }).then(result => {
        expect(result).to.equal(false);
    }));
});

