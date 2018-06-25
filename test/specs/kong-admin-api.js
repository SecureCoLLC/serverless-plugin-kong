const uuidv4 = require('uuid/v4');

const KongAdminApi = require('../../kong-admin-api');
const chai = require('chai');
const dirtyChai = require('dirty-chai');

chai.use(dirtyChai);
const { expect } = chai;

const kongAdminApi = new KongAdminApi({
    adminApiUrl: 'http://localhost:8001', adminApiHeaders: {}
});

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
        await asyncThrowAssertion(() => kongAdminApi.getService({}), 'Missing required "serviceName" parameter.');
    });

    it('should throw an exception if service name is not passed to the create service function', async () => {
        await asyncThrowAssertion(() => kongAdminApi.createService({}), 'Missing required "serviceName" parameter.');
    });

    it('should throw an exception if upstreamUrl is not passed to the create service function', async () => {
        await asyncThrowAssertion(() => kongAdminApi.createService({ serviceName }), 'Missing required "upstreamUrl" parameter.');
    });

    it('should create a new service', () => kongAdminApi.createService({ serviceName, upstreamUrl: 'http://127.0.0.1:80' }).then(result => {
        expect(result.statusCode).to.equal(201);
        expect(result.result.id).exist();
    }));

    it('should throw an exception if service is already exist.', async () => {
        await asyncThrowAssertion(() => kongAdminApi.createService({ serviceName, upstreamUrl: 'http://127.0.0.1:80' }), `Service "${serviceName}" is already exist`);
    });

    it('should throw an exception if service name is not passed to the create route function', async () => {
        await asyncThrowAssertion(() => kongAdminApi.createRoute({}), 'Missing required "serviceName" parameter.');
    });

    it('should throw an exception if routeConfig is not passed to the create route function', async () => {
        await asyncThrowAssertion(() => kongAdminApi.createRoute({ serviceName }), 'Missing required "routeConfig" parameter.');
    });

    it('should throw an exception if the required route config fields are not passed to the create route function.', async () => {
        await asyncThrowAssertion(() => kongAdminApi.createRoute({ serviceName, routeConfig: {} }), 'At least one of these fields must be non-empty');
    });

    it('should throw an exception if the given service is not exist when trigger create route function', async () => {
        const testServiceName = `${Date.now()}`;
        await asyncThrowAssertion(() => kongAdminApi.createRoute({ serviceName: testServiceName, routeConfig: { hosts: 'test' } }), `Service "${testServiceName}" is not exist`);
    });

    it('should create a new route', () => kongAdminApi.createRoute({ serviceName, routeConfig }).then(result => {
        expect(result.statusCode).to.equal(201);
        expect(result.result.id).exist();
        testRouteId = result.result.id;
    }));

    it('should throw an exception if route id is not passed to the update route function', async () => {
        await asyncThrowAssertion(() => kongAdminApi.updateRoute({}), 'Missing required "routeId" parameter.');
    });

    it('should throw an exception if route config is not passed to the update route function', async () => {
        await asyncThrowAssertion(() => kongAdminApi.updateRoute({ routeId: testRouteId }), 'Missing required "routeConfig" parameter.');
    });

    it('should throw an exception if route config is not passed to the update route function', async () => {
        await asyncThrowAssertion(() => kongAdminApi.updateRoute({ routeId: 'test-id', routeConfig: {} }), 'At least one of these fields must be non-empty:');
    });

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

    it('should throw an exception if required fields are not passed to the createPluginRequestToService function', async () => {
        const testServiceName = `${Date.now()}`;
        await asyncThrowAssertion(() => kongAdminApi.createPluginRequestToService({}), 'Missing required "serviceName" parameter.');
        await asyncThrowAssertion(() => kongAdminApi.createPluginRequestToService({ serviceName }), 'Missing required "pluginConfig" parameter.');
        await asyncThrowAssertion(() => kongAdminApi.createPluginRequestToService({ serviceName, pluginConfig: {} }), 'Missing required field "name" in "pluginConfig" parameter');
        await asyncThrowAssertion(() => kongAdminApi.createPluginRequestToService({ serviceName: testServiceName, pluginConfig: { name: 'cors' } }), `Service "${testServiceName}" is not exist`);
    });

    it('should enable a plugin in a service', () => kongAdminApi.createPluginRequestToService({ serviceName, pluginConfig }).then(result => {
        expect(result.statusCode).to.equal(201);
        expect(result.result.id).exist();
        testPluginId = result.result.id;
    }));

    it('should throw an exception if required fields are not passed to the createPluginRequestToRoute function', async () => {
        await asyncThrowAssertion(() => kongAdminApi.createPluginRequestToRoute({}), 'Missing required "routeId" parameter.');
        await asyncThrowAssertion(() => kongAdminApi.createPluginRequestToRoute({ routeId: testRouteId }), 'Missing required "pluginConfig" parameter.');
        await asyncThrowAssertion(() => kongAdminApi.createPluginRequestToRoute({ routeId: testRouteId, pluginConfig: {} }), 'Missing required field "name" in "pluginConfig" parameter');
        await asyncThrowAssertion(() => kongAdminApi.createPluginRequestToRoute({ routeId: uuidv4(), pluginConfig: { name: 'cors' } }), 'There is no route exist with this ID');
    });

    it('should enable a plugin in a service', () => kongAdminApi.createPluginRequestToRoute({ routeId: testRouteId, pluginConfig }).then(result => {
        expect(result.statusCode).to.equal(201);
    }));

    it('should fetch a service', () => kongAdminApi.getService({ serviceName }).then(result => {
        expect(result.statusCode).to.equal(200);
        expect(result.result.name).to.equal(serviceName);
    }));

    it('should throw an exception if serviceName is not passed to getRoutes function', async () => {
        await asyncThrowAssertion(() => kongAdminApi.getRoutes({ }), 'Missing required "serviceName" parameter.');
    });

    it('should fetch routes of service', () => kongAdminApi.getRoutes({ serviceName }).then(result => {
        expect(result.statusCode).to.equal(200);
        expect(result.result.data.length).above(0);
    }));

    it('should throw an exception if required params are not passed to the getRouteByConfig function', async () => {
        await asyncThrowAssertion(() => kongAdminApi.getRouteByConfig({ }), 'Missing required "serviceName" parameter.');
        await asyncThrowAssertion(() => kongAdminApi.getRouteByConfig({ serviceName }), 'Missing required "routeConfig" parameter.');
        await asyncThrowAssertion(() => kongAdminApi.getRouteByConfig({ serviceName, routeConfig: {} }), 'At least one of these fields must be non-empty');
    });

    it('should fetch a route by route config', () => kongAdminApi.getRouteByConfig({ serviceName, routeConfig }).then(result => {
        expect(result.statusCode).to.equal(200);
    }));

    it('should throw an exception if routeId is not passed to the getRoute function', async () => {
        await asyncThrowAssertion(() => kongAdminApi.getRoute({ }), 'Missing required "routeId" parameter.');
    });

    it('should fetch a route by Id', () => kongAdminApi.getRoute({ routeId: testRouteId }).then(result => {
        expect(result.statusCode).to.equal(200);
    }));

    it('should throw an exception if service name is not passed to the getPluginsRequestToService function', async () => {
        await asyncThrowAssertion(() => kongAdminApi.getPluginsRequestToService({}), 'Missing required "serviceName" parameter.');
    });

    it('should fetch the plugins in service', () => kongAdminApi.getPluginsRequestToService({ serviceName }).then(result => {
        expect(result.statusCode).to.equal(200);
        expect(result.result.data.length).above(0);
    }));

    it('should throw an exception if routeId is not passed to the getPluginsRequestToRoute function', async () => {
        await asyncThrowAssertion(() => kongAdminApi.getPluginsRequestToRoute({}), 'Missing required "routeId" parameter.');
    });

    it('should fetch the plugins in route', () => kongAdminApi.getPluginsRequestToRoute({ routeId: testRouteId }).then(result => {
        expect(result.statusCode).to.equal(200);
        expect(result.result.data.length).above(0);
    }));

    it('should throw an exception if required params are not passed to the getPluginByNameRequestToService function', async () => {
        await asyncThrowAssertion(() => kongAdminApi.getPluginByNameRequestToService({}), 'Missing required "serviceName" parameter.');
        await asyncThrowAssertion(() => kongAdminApi.getPluginByNameRequestToService({ serviceName }), 'Missing required "pluginName" parameter.');
    });


    it('should fetch the plugin in service by name', () => kongAdminApi.getPluginByNameRequestToService({ serviceName, pluginName: pluginConfig.name }).then(result => {
        expect(result.statusCode).to.equal(200);
    }));

    it('should throw an exception if required params are not passed to the getPluginByNameRequestToRoute function', async () => {
        await asyncThrowAssertion(() => kongAdminApi.getPluginByNameRequestToRoute({}), 'Missing required "routeId" parameter.');
        await asyncThrowAssertion(() => kongAdminApi.getPluginByNameRequestToRoute({ routeId: testRouteId }), 'Missing required "pluginName" parameter.');
        const result = await kongAdminApi.getPluginByNameRequestToRoute({ routeId: testRouteId, pluginName: 'kong' });
        console.log(result);
        expect(result).exist();
    });


    it('should fetch the plugin in route by name', () => kongAdminApi.getPluginByNameRequestToRoute({ routeId: testRouteId, pluginName: pluginConfig.name }).then(result => {
        expect(result.statusCode).to.equal(200);
    }));

    it('should throw an exception if service name is not passed to the isServiceExist function', async () => {
        await asyncThrowAssertion(() => kongAdminApi.isServiceExist({}), 'Missing required "serviceName" parameter.');
    });

    it('check if service exist, should return true', () => kongAdminApi.isServiceExist({ serviceName }).then(result => {
        expect(result).to.equal(true);
    }));

    it('check if service exist, should return false', () => kongAdminApi.isServiceExist({ serviceName: `${Date.now()}` }).then(result => {
        expect(result).to.equal(false);
    }));

    it('should throw an exception if service name is not passed to the isPluginExistRequestToService function', async () => {
        await asyncThrowAssertion(() => kongAdminApi.isPluginExistRequestToService({}), 'Missing required "serviceName" parameter.');
        await asyncThrowAssertion(() => kongAdminApi.isPluginExistRequestToService({ serviceName }), 'Missing required "pluginName" parameter.');
    });

    it('check if the plugin exist in service, should return true', () => kongAdminApi.isPluginExistRequestToService({ serviceName, pluginName: pluginConfig.name }).then(result => {
        expect(result).to.equal(true);
    }));

    it('check if the plugin exist in service, should return false', () => kongAdminApi.isPluginExistRequestToService({ serviceName, pluginName: 'not_exist' }).then(result => {
        expect(result).to.equal(false);
    }));

    it('should throw an exception if pluginId is not passed to the getPlugin function', async () => {
        await asyncThrowAssertion(() => kongAdminApi.getPlugin({}), 'Missing required "pluginId" parameter.');
    });

    it('should fetch plugin by id', () => kongAdminApi.getPlugin({ pluginId: testPluginId }).then(result => {
        expect(result.statusCode).to.equal(200);
        expect(result.result.id).exist();
    }));

    it('should throw an exception if required fields are not passed to the updatePlugin function', async () => {
        await asyncThrowAssertion(() => kongAdminApi.updatePlugin({}), 'Missing required "pluginId" parameter.');
        await asyncThrowAssertion(() => kongAdminApi.updatePlugin({ pluginId: testPluginId }), 'Missing required "pluginConfig" parameter.');
        await asyncThrowAssertion(() => kongAdminApi.updatePlugin({ pluginId: testPluginId, pluginConfig: {} }), 'Missing required field "name" in "pluginConfig" parameter');
    });

    it('should update the plugin', () => kongAdminApi.updatePlugin({ pluginId: testPluginId, pluginConfig: Object.assign({}, pluginConfig, { config: { methods: 'GET' } }) }).then(result => {
        expect(result.statusCode).to.equal(200);
        expect(result.result.config.methods[0]).to.equal('GET');
    }));

    it('should throw an exception if plugin id is not passed to the deletePlugin function', async () => {
        await asyncThrowAssertion(() => kongAdminApi.deletePlugin({}), 'Missing required "pluginId" parameter.');
    });

    it('should delete the plugin', () => kongAdminApi.deletePlugin({ pluginId: testPluginId }).then(result => {
        expect(result.statusCode).to.equal(204);
        return kongAdminApi.getPlugin({ pluginId: testPluginId });
    }).then(result => {
        expect(result.statusCode).to.equal(404);
    }));

    it('should throw an exception if routeId is not passed to the deleteRoute function', async () => {
        await asyncThrowAssertion(() => kongAdminApi.deleteRoute({}), 'Missing required "routeId" parameter.');
    });

    it('should return empty result if route config is not passed to the generateUniqueKeyForRoute function', () => {
        const result = kongAdminApi.generateUniqueKeyForRoute({});
        expect(result).to.equal('');
    });

    it('should return result if paths fileds is passed to the generateUniqueKeyForRoute function', () => {
        const result = kongAdminApi.generateUniqueKeyForRoute({ routeConfig: { paths: ['/user', '/product'] } });
        expect(result).to.equal('/product,/user');
    });

    it('should delete a route', () => kongAdminApi.deleteRoute({ routeId: testRouteId }).then(result => {
        expect(result.statusCode).to.equal(204);
        return kongAdminApi.getRoute({ routeId: testRouteId });
    }).then(result => {
        expect(result.statusCode).to.equal(404);
    }));

    it('should throw an exception if service name is not passed to delete service function', async () => {
        await asyncThrowAssertion(() => kongAdminApi.deleteService({}), 'Missing required "serviceName" parameter.');
    });

    it('should delete a service', () => kongAdminApi.deleteService({ serviceName }).then(result => {
        expect(result.statusCode).to.equal(204);
        return kongAdminApi.isServiceExist({ serviceName });
    }).then(result => {
        expect(result).to.equal(false);
    }));
});

