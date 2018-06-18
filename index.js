/* eslint no-await-in-loop: 0 */

// NOTE: We use await inside for loop. If we use Promise.all, we get 500 error from kong.
// @see https://github.com/Kong/kong/issues/3440

const KongAdminApi = require('./kong-admin-api');

const readline = require('readline');

// Helper function to get an approval before do an action
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

// Serverless plugin custom commands and lifecycle events
const commands = {
    kong: {
        usage: 'Helps you create service and routes in kong',
        commands: {
            'create-services': {
                usage: 'Helps you create a service and routes in kong',
                lifecycleEvents: [
                    'create-services'
                ],
                options: {
                    service: {
                        usage: 'Specify the service you want to register (e.g. "--service myService" "-n myService")',
                        shortcut: 'n',
                        required: false
                    },
                }
            },
            'delete-service': {
                usage: 'Helps you remove a service and routes from kong',
                lifecycleEvents: [
                    'delete-service'
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

class ServerlessPlugin {
    constructor(serverless, options) {
        this.serverless = serverless;
        this.cli = serverless.cli;
        this.options = options;

        this.kongAdminApi = new KongAdminApi({ adminUrl: this.serverless.service.custom.kong.adminApiUrl });

        this.commands = commands;

        this.hooks = {
            'kong:create-services:create-services': this.createServices.bind(this),
            'kong:update-service:update-service': this.updateService.bind(this),
            'kong:delete-service:delete-service': this.deleteService.bind(this),
        };
    }

    /**
     * Retrieve services configured at custom section in severless config file.
     * @param serviceName - The name of the service to retrieve. This is an optional field.
     *                      If it's not passed, it will return all services.
     * @returns {Object|Array[]}
     */
    getConfigurations(serviceName) {
        let services;

        if (serviceName) {
            services = (this.serverless.service.custom.kong.services || []).filter(service =>
                service.name === serviceName);
        } else {
            services = this.serverless.service.custom.kong.services || [];
        }

        if (!services.length) {
            const message = serviceName
                ? `There is no service configured with this name "${this.options.service}"`
                : 'There is no service configured to register';
            this.cli.log(message);
        }

        return services;
    }

    /**
     * Create Service
     * @param serviceName - The service name.
     * @param upstreamUrl -  The url of the upstream server
     * @returns {Promise<void>}
     */
    async createService({ serviceName, upstreamUrl }) {
        if (!serviceName) {
            throw new Error('Missing required "serviceName" parameter.');
        }

        if (!upstreamUrl) {
            throw new Error('Missing required "upstreamUrl" parameter.');
        }

        const isServiceExist = await this.kongAdminApi.isServiceExist({ serviceName });

        if (!isServiceExist) {
            this.cli.log(`Creating a service ${serviceName}`);
            await this.kongAdminApi.createService({ serviceName, upstreamUrl });
        } else {
            this.cli.log(`The service "${serviceName}" is already exist`);
        }
    }

    /**
     * Check and update the plugins if they are exist otherwise create.
     * @param serviceName - The name of the Service which the plugins will target.
     * @param servicePlugins {Array[PluginConfig]} - Array of plugin configs to create or update
     * @returns {Promise<void>}
     */
    async createOrUpdateServicePlugins({ serviceName, servicePlugins }) {
        if (!serviceName) {
            throw new Error('Missing required "serviceName" parameter.');
        }

        if (!servicePlugins) {
            throw new Error('Missing required "servicePlugins" parameter.');
        }

        for (let pluginIndex = 0; pluginIndex < servicePlugins.length; pluginIndex++) {
            const pluginConfig = servicePlugins[pluginIndex];
            const response = await this.kongAdminApi.getPluginByNameRequestToService({
                serviceName,
                pluginName: pluginConfig.name
            });
            const plugin = (response || {}).result || {};
            if (!plugin.id) {
                this.cli.log(`Creating a service plugin "${pluginConfig.name}"`);
                await this.kongAdminApi.createPluginRequestToService({ serviceName, pluginConfig });
            } else {
                this.cli.log(`Updating the service plugin "${pluginConfig.name}"`);
                await this.kongAdminApi.updatePlugin({ pluginId: plugin.id, pluginConfig });
            }
        }
    }

    /**
     * Check and update the route if it is exist otherwise create.
     * @param serviceName -  The name of the Service which this route will target.
     * @param routeConfig - The route config to create or update
     * @returns {Promise<*|null>}
     */
    async createOrUpdateRoute({ serviceName, routeConfig }) {
        if (!serviceName) {
            throw new Error('Missing required "serviceName" parameter.');
        }

        if (!routeConfig) {
            throw new Error('Missing required "routeConfig" parameter.');
        }

        const grResponse = await this.kongAdminApi.getRouteByConfig({
            serviceName,
            routeConfig: routeConfig.config
        });

        let route = (grResponse && grResponse.result) || null;

        if (!route) {
            this.cli.log(`Creating a route. Hosts: ${routeConfig.config.hosts}; Paths: ${routeConfig.config.paths}`);
            const response = await this.kongAdminApi.createRoute({ serviceName, routeConfig: routeConfig.config });
            route = ((response || {}).result || {});
        } else {
            this.cli.log(`Updating route. Hosts: ${routeConfig.config.hosts}; Paths: ${routeConfig.config.paths}`);
            await this.kongAdminApi.updateRoute({ routeId: route.id, routeConfig: routeConfig.config });
        }

        return route;
    }

    /**
     * Check and update the plugins if they are exist otherwise create.
     * @param routeId - The id of the Route which the plugins will target.
     * @param routePlugins {Array[PluginConfig]} - Array of plugin configs to create or update
     * @returns {Promise<void>}
     */
    async createOrUpdateRoutePlugins({ routeId, routePlugins }) {
        if (!routeId) {
            throw new Error('Missing required "routeId" parameter.');
        }

        if (!routePlugins) {
            throw new Error('Missing required "routePlugins" parameter.');
        }

        for (let pluginIndex = 0; pluginIndex < routePlugins.length; pluginIndex++) {
            const pluginConfig = routePlugins[pluginIndex];
            const res = await this.kongAdminApi.getPluginByNameRequestToRoute({
                routeId,
                pluginName: pluginConfig.name
            });
            const plugin = (res || {}).result || {};

            if (!plugin.id) {
                this.cli.log(`Creating a route plugin "${pluginConfig.name}"`);
                await this.kongAdminApi.createPluginRequestToRoute({ routeId, pluginConfig });
            } else {
                this.cli.log(`Updating the route plugin "${pluginConfig.name}"`);
                await this.kongAdminApi.updatePlugin({ pluginId: plugin.id, pluginConfig });
            }
        }
    }

    /**
     * Retrieve the plugins which are removed from Serverless custom config section but exist in Kong
     * @param serviceName - The name of the Service on which the plugins are added to.
     * @param servicePlugins - The Plugins configured in Serverless custom config section for services
     * @returns {Promise<Array[Plugin]>}
     */
    async getServicePluginsRemovedFromConfig({ serviceName, servicePlugins }) {
        if (!serviceName) {
            throw new Error('Missing required "serviceName" parameter.');
        }

        if (!servicePlugins) {
            throw new Error('Missing required "servicePlugins" parameter.');
        }

        const response = await this.kongAdminApi.getPluginsRequestToService({ serviceName });
        const registeredPlugins = response.result.data || [];
        const servicePluginNamesInConfig = servicePlugins.map(plugin => plugin.name);

        const removedPlugins = registeredPlugins.filter(plugin =>
            servicePluginNamesInConfig.indexOf(plugin.name) === -1);
        return removedPlugins;
    }

    /**
     * Retrieve the plugins which are removed from Serverless custom config section but exist in Kong
     * @param routeId - The id of the route on which the plugins are added to.
     * @param routePlugins - The Plugins configured in Serverless custom config section for routes
     * @returns {Promise<Array[Plugin]>}
     */
    async getRoutePluginsRemovedFromConfig({ routeId, routePlugins }) {
        if (!routeId) {
            throw new Error('Missing required "routeId" parameter.');
        }

        if (!routePlugins) {
            throw new Error('Missing required "routePlugins" parameter.');
        }

        const response = await this.kongAdminApi.getPluginsRequestToRoute({ routeId });
        const registeredPlugins = response.result.data || [];
        const routePluginNamesInConfig = routePlugins.map(plugin => plugin.name);

        const removedPlugins = registeredPlugins.filter(plugin => routePluginNamesInConfig.indexOf(plugin.name) === -1);
        return removedPlugins;
    }

    /**
     * Retrieve the routes which are removed from Serverless custom config section but exist in Kong.
     * @param serviceName - The name of the Service on which the routes are added to.
     * @param configuredRoutes - The routes configured in Serverless custom config.
     * @returns {Promise<Array[Route]>}
     */
    async getRoutesRemovedFromConfig({ serviceName, configuredRoutes }) {
        if (!serviceName) {
            throw new Error('Missing required "serviceName" parameter.');
        }

        if (!configuredRoutes) {
            throw new Error('Missing required "configuredRoutes" parameter.');
        }

        const response = await this.kongAdminApi.getRoutes({ serviceName });
        const registeredRoutes = ((response || {}).result || {}).data || [];

        if (!configuredRoutes || !configuredRoutes.length) {
            return registeredRoutes;
        }

        const configuredRoutesKeys = {};
        configuredRoutes.forEach(route => {
            const key = this.kongAdminApi.generateUniqueKeyForRoute({ routeConfig: route });
            if (key) {
                configuredRoutesKeys[key] = true;
            }
        });

        const removedRoutes = registeredRoutes.filter(route => {
            const key = this.kongAdminApi.generateUniqueKeyForRoute({ routeConfig: route });
            return key && !configuredRoutesKeys[key];
        });

        return removedRoutes;
    }

    /**
     * Remove plugins
     * @param plugins {Array[{id, name}]} - The plugin objects.
     * @returns {Promise<void>}
     */
    async removePlugins({ plugins }) {
        if (!plugins) {
            throw new Error('Missing required "plugins" parameter.');
        }

        for (let index = 0; index < plugins.length; index++) {
            const plugin = plugins[index];
            this.cli.log(`Removing plugin: ${plugin.name}`);
            await this.kongAdminApi.deletePlugin({ pluginId: plugin.id });
        }
    }

    /**
     * Remove Routes
     * @param routes {Array[{id, hosts, paths, methods}]} - The route objects to remove.
     * @returns {Promise<void>}
     */
    async removeRoutes({ routes }) {
        if (!routes || !routes.length) {
            return;
        }

        for (let index = 0; index < routes.length; index++) {
            const route = routes[index];
            const routeKeyFields = [];
            if (route.hosts && route.hosts.length) {
                routeKeyFields.push(`Hosts: [${route.hosts.join(', ')}]`);
            }

            if (route.paths && route.paths.length) {
                routeKeyFields.push(`Paths: [${route.paths.join(', ')}]`);
            }

            if (route.methods && route.methods.length) {
                routeKeyFields.push(`Methods: [${route.methods.join(', ')}]`);
            }

            this.cli.log(`Removing route: ${routeKeyFields.join('; ')}`);

            await this.kongAdminApi.deleteRoute({ routeId: route.id });
        }
    }

    /**
     * This function is register with the life cycle hook "kong:register-services:register-services"
     * The input params can be passed from commandline (e.g. sls kong register-services -n example-service-1)
     * Service name is an optional field for this function. You can pass it from command line using  --service or -n
     * Read service configurations from serverless custom config section and create services, routes and plugins
     * @returns {Promise<void>}
     */
    async createServices() {
        try {
            const services = this.getConfigurations(this.options.service);

            for (let serviceIndex = 0; serviceIndex < services.length; serviceIndex++) {
                const serviceConfig = services[serviceIndex];
                const servicePlugins = serviceConfig.plugins || [];
                const routes = serviceConfig.routes || [];

                const isServiceExist = await this.kongAdminApi.isServiceExist({ serviceName: serviceConfig.name });

                if (!isServiceExist) {
                    await this.createService({ serviceName: serviceConfig.name, upstreamUrl: serviceConfig.url });

                    await this.createOrUpdateServicePlugins({ serviceName: serviceConfig.name, servicePlugins });

                    for (let routeIndex = 0; routeIndex < routes.length; routeIndex++) {
                        const routeConfig = routes[routeIndex];
                        const routePlugins = routeConfig.plugins || [];

                        const route = await this.createOrUpdateRoute({
                            serviceName: serviceConfig.name,
                            routeConfig
                        }) || {};

                        await this.createOrUpdateRoutePlugins({ routeId: route.id, routePlugins });
                    }
                } else {
                    this.cli.log(`The service "${serviceConfig.name}" is already exist`);
                }
            }
        } catch (e) {
            this.cli.log(e);
        }
    }

    /**
     * This function is register with the life cycle hook "kong:update-service:update-service".
     * The input params can be passed from commandline (e.g.  sls kong update-service -n example-service-1)
     * Service name is required field for this function. You can pass it from command line using  --service or -n
     * This function will read the service configuration from serverless custom config section
     * by using the given service name and it updates the plugins and routes and then remove
     * the plugins and routes which are removed from the configuration section.
     * @returns {Promise<void>}
     */
    async updateService() {
        try {
            const services = this.getConfigurations(this.options.service);

            for (let serviceIndex = 0; serviceIndex < services.length; serviceIndex++) {
                const serviceConfig = services[serviceIndex];
                const servicePlugins = serviceConfig.plugins || [];
                const routes = serviceConfig.routes || [];

                const isServiceExist = await this.kongAdminApi.isServiceExist({ serviceName: serviceConfig.name });

                if (!isServiceExist) {
                    this.cli.log(`The service "${serviceConfig.name}" is not exist`);
                    return;
                }

                const answer = await confirm(`Do you want to update the service "${serviceConfig.name}"? \nEnter "YES" to update: `);

                if (answer !== 'YES') {
                    return;
                }

                await this.createOrUpdateServicePlugins({ serviceName: serviceConfig.name, servicePlugins });

                const servicePluginsRemovedFromConfig =
                    await this.getServicePluginsRemovedFromConfig({ serviceName: serviceConfig.name, servicePlugins });

                await this.removePlugins({ plugins: servicePluginsRemovedFromConfig });

                for (let routeIndex = 0; routeIndex < routes.length; routeIndex++) {
                    const routeConfig = routes[routeIndex];
                    const routePlugins = routeConfig.plugins || [];

                    const route = await this.createOrUpdateRoute({
                        serviceName: serviceConfig.name,
                        routeConfig
                    }) || {};

                    await this.createOrUpdateRoutePlugins({ routeId: route.id, routePlugins });

                    const routePluginsRemovedFromConfig =
                        await this.getRoutePluginsRemovedFromConfig({ routeId: route.id, routePlugins });

                    await this.removePlugins({ plugins: routePluginsRemovedFromConfig });
                }

                const routesConfigs = routes.map(route => route.config);
                const routesRemovedFromConfig =
                    await this.getRoutesRemovedFromConfig({
                        serviceName: serviceConfig.name, configuredRoutes: routesConfigs
                    });

                await this.removeRoutes({ routes: routesRemovedFromConfig });
            }
        } catch (e) {
            this.cli.log(e);
        }
    }

    /**
     * This function is register with the life cycle hook "kong:remove-service:remove-service".
     * The input params can be passed from commandline (e.g.  sls kong remove-service -n example-service-1)
     * Service name is required field for this function. You can pass it from command line using  --service or -n
     * This function will remove a service and associated plugins and routes from Kong.
     * @returns {Promise<void>}
     */
    async deleteService() {
        const serviceName = this.options.service;

        const response = await this.kongAdminApi.getService({ serviceName });
        const service = (response || {}).result || null;

        if (!service) {
            this.cli.log(`This is no service register with this name "${serviceName}"`);
            return;
        }

        const answer = await confirm(`Do you want to remove this service "${serviceName}"? THINK TWICE!\nEnter "YES" to remove: `);

        if (answer !== 'YES') {
            return;
        }

        const routesResponse = await this.kongAdminApi.getRoutes({ serviceName });
        const routes = ((routesResponse || {}).result || {}).data || [];

        if (routes.length) {
            this.cli.log('Removing routes');
            for (let index = 0; index < routes.length; index++) {
                const routeId = routes[index].id;
                this.cli.log(`Removing route ${index}: ${routeId}`);
                await this.kongAdminApi.deleteRoute({ routeId });
            }
        }

        this.cli.log(`Removing service "${serviceName}"`);
        await this.kongAdminApi.deleteService({ serviceName });
    }
}

module.exports = ServerlessPlugin;
