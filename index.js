/* eslint no-await-in-loop: 0 */

const KongAdminApi = require('./kong-admin-api');

const readline = require('readline');

const confirm = message => new Promise(resolve => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question(message, answer => {
        resolve(answer);
        rl.close();
    });
});

const getConfigurations = (serverless, serviceName) => {
    let services;

    if (serviceName) {
        services = (serverless.service.custom.kong.services || []).filter(service => service.name === serviceName);
    } else {
        services = serverless.service.custom.kong.services || [];
    }

    if (!services.length) {
        const message = serviceName
            ? `There is no service configured with this name "${this.options.service}"`
            : 'There is no service configured to register';
        serverless.cli.log(message);
    }

    return services;
};

const createService = async (serverless, kongAdminApi, serviceName, host) => {
    const isServiceExist = await kongAdminApi.isServiceExist(serviceName);

    if (!isServiceExist) {
        serverless.cli.log(`Creating a service ${serviceName}`);
        await kongAdminApi.createService(serviceName, host);
    } else {
        serverless.cli.log(`The service "${serviceName}" is already exist`);
    }
};

// NOTE: We use await inside for loop. If we use Promise.all, we get 500 error from kong. Ref: https://github.com/Kong/kong/issues/3440

const createOrUpdateServicePlugins = async (serverless, kongAdminApi, serviceName, servicePlugins) => {
    for (let pluginIndex = 0; pluginIndex < servicePlugins.length; pluginIndex++) {
        const pluginConfig = servicePlugins[pluginIndex];
        const response = await kongAdminApi.getPluginByNameRequestToService(
            serviceName,
            pluginConfig.name
        );
        const plugin = (response || {}).result || {};
        if (!plugin.id) {
            serverless.cli.log(`Creating a service plugin "${pluginConfig.name}"`);
            await kongAdminApi.createPluginRequestToService(serviceName, pluginConfig);
        } else {
            serverless.cli.log(`Updating the service plugin "${pluginConfig.name}"`);
            await kongAdminApi.updatePlugin(plugin.id, pluginConfig);
        }
    }
};

const createOrUpdateRoutes = async (serverless, kongAdminApi, serviceName, routeConfig) => {
    const grResponse = await kongAdminApi.getRouteByHostsAndPaths(
        serviceName,
        routeConfig.config.hosts,
        routeConfig.config.paths
    );
    let route = (grResponse && grResponse.result) || null;

    if (!route) {
        serverless.cli.log(`Creating a route. Hosts: ${routeConfig.config.hosts}; Paths: ${routeConfig.config.paths}`);
        const response = await kongAdminApi.createRoute(serviceName, routeConfig.config);
        route = ((response || {}).result || {});
    } else {
        serverless.cli.log(`Updating route. Hosts: ${routeConfig.config.hosts}; Paths: ${routeConfig.config.paths}`);
        await kongAdminApi.updateRoute(route.id, routeConfig.config);
    }

    return route;
};

const createOrUpdateRoutePlugins = async (serverless, kongAdminApi, route, routePlugins) => {
    if (!route.id) {
        return;
    }

    for (let pluginIndex = 0; pluginIndex < routePlugins.length; pluginIndex++) {
        const pluginConfig = routePlugins[pluginIndex];
        const res = await kongAdminApi.getPluginByNameRequestToRoute(
            route.id,
            pluginConfig.name
        );
        const plugin = (res || {}).result || {};

        if (!plugin.id) {
            serverless.cli.log(`Creating a route plugin "${pluginConfig.name}"`);
            await kongAdminApi.createPluginRequestToRoute(route.id, pluginConfig);
        } else {
            serverless.cli.log(`Updating the route plugin "${pluginConfig.name}"`);
            await kongAdminApi.updatePlugin(plugin.id, pluginConfig);
        }
    }
};

const getServicePluginsRemovedFromConfig = async (serverless, kongAdminApi, serviceName, servicePlugins) => {
    const response = await kongAdminApi.getPluginsRequestToService(serviceName);
    const registeredPlugins = response.result.data || [];
    const servicePluginNamesInConfig = servicePlugins.map(plugin => plugin.name);

    const removedPlugins = registeredPlugins.filter(plugin => servicePluginNamesInConfig.indexOf(plugin.name) === -1);
    console.log(servicePluginNamesInConfig);
    console.log(removedPlugins);
};

class ServerlessPlugin {
    constructor(serverless, options) {
        this.serverless = serverless;
        this.options = options;
        this.kongAdminApi = new KongAdminApi({ adminUrl: this.serverless.service.custom.kong.adminApiUrl });
        this.commands = {
            kong: {
                usage: 'Helps you create service and routes in kong',
                commands: {
                    'register-services': {
                        usage: 'Helps you create a service and routes in kong',
                        lifecycleEvents: [
                            'register-services'
                        ],
                        options: {
                            service: {
                                usage: 'Specify the service you want to register (e.g. "--service myService" "-n myService")',
                                shortcut: 'n',
                                required: false
                            },
                        }
                    },
                    'remove-service': {
                        usage: 'Helps you remove a service and routes from kong',
                        lifecycleEvents: [
                            'remove-service'
                        ],
                        options: {
                            service: {
                                usage: 'Specify the service you want to register (e.g. "--service myService" "-n myService")',
                                shortcut: 'n',
                                required: true
                            },
                        }
                    },
                    'update-service': {
                        usage: 'Helps you update a service and routes register with Kong',
                        lifecycleEvents: [
                            'update-service'
                        ],
                        options: {
                            service: {
                                usage: 'Specify the service you want to register (e.g. "--service myService" "-n myService")',
                                shortcut: 'n',
                                required: true
                            },
                        }
                    }
                }
            }
        };

        this.hooks = {
            'kong:register-services:register-services': this.registerService.bind(this),
            'kong:update-service:update-service': this.updateService.bind(this),
            'kong:remove-service:remove-service': this.removeService.bind(this),
        };
    }

    async registerService() {
        try {
            const services = getConfigurations(this.serverless, this.options.service);

            for (let serviceIndex = 0; serviceIndex < services.length; serviceIndex++) {
                const serviceConfig = services[serviceIndex];
                const servicePlugins = serviceConfig.plugins || [];
                const routes = serviceConfig.routes || [];

                const isServiceExist = await this.kongAdminApi.isServiceExist(serviceConfig.name);

                if (isServiceExist) {
                    this.serverless.cli.log(`The service "${serviceConfig.name}" is already exist`);
                    return;
                }

                await createService(this.serverless, this.kongAdminApi, serviceConfig.name, serviceConfig.host);

                await createOrUpdateServicePlugins(
                    this.serverless, this.kongAdminApi, serviceConfig.name, servicePlugins);

                for (let routeIndex = 0; routeIndex < routes.length; routeIndex++) {
                    const routeConfig = routes[routeIndex];
                    const routePlugins = routeConfig.plugins || [];

                    const route = await createOrUpdateRoutes(
                        this.serverless, this.kongAdminApi, serviceConfig.name, routeConfig);

                    await createOrUpdateRoutePlugins(this.serverless, this.kongAdminApi, route, routePlugins);
                }
            }
        } catch (e) {
            this.serverless.cli.log(e);
        }
    }

    async updateService() {
        try {
            const services = getConfigurations(this.serverless, this.options.service);

            for (let serviceIndex = 0; serviceIndex < services.length; serviceIndex++) {
                const serviceConfig = services[serviceIndex];
                const servicePlugins = serviceConfig.plugins || [];
                const routes = serviceConfig.routes || [];

                const isServiceExist = await this.kongAdminApi.isServiceExist(serviceConfig.name);

                if (!isServiceExist) {
                    this.serverless.cli.log(`The service "${serviceConfig.name}" is not exist`);
                    return;
                }

                await getServicePluginsRemovedFromConfig(
                    this.serverless, this.kongAdminApi, serviceConfig.name, servicePlugins);

                const answer = await confirm(`Do you want to update the service "${serviceConfig.name}"? \nEnter "YES" to update: `);

                if (answer !== 'YES') {
                    return;
                }

                await createOrUpdateServicePlugins(
                    this.serverless, this.kongAdminApi, serviceConfig.name, servicePlugins);

                for (let routeIndex = 0; routeIndex < routes.length; routeIndex++) {
                    const routeConfig = routes[routeIndex];
                    const routePlugins = routeConfig.plugins || [];

                    const route = await createOrUpdateRoutes(
                        this.serverless, this.kongAdminApi, serviceConfig.name, routeConfig);

                    await createOrUpdateRoutePlugins(this.serverless, this.kongAdminApi, route, routePlugins);
                }
            }
        } catch (e) {
            this.serverless.cli.log(e);
        }
    }

    async removeService() {
        const serviceName = this.options.service;

        const response = await this.kongAdminApi.getService(serviceName);
        const service = (response || {}).result || null;

        if (!service) {
            this.serverless.cli.log(`This is no service register with this name "${serviceName}"`);
            return;
        }

        const answer = await confirm(`Do you want to remove this service "${serviceName}"? THINK TWICE!\nEnter "YES" to remove: `);

        if (answer !== 'YES') {
            return;
        }

        const routesResponse = await this.kongAdminApi.getRoutes(serviceName);
        const routes = ((routesResponse || {}).result || {}).data || [];

        if (routes.length) {
            this.serverless.cli.log('Removing routes');
            for (let index = 0; index < routes.length; index++) {
                const routeId = routes[index].id;
                this.serverless.cli.log(`Removing route ${index}: ${routeId}`);
                await this.kongAdminApi.deleteRoute(routeId);
            }
        }

        this.serverless.cli.log(`Removing service "${serviceName}"`);
        await this.kongAdminApi.deleteService(serviceName);
    }
}

module.exports = ServerlessPlugin;
