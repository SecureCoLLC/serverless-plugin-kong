/* eslint no-await-in-loop: 0 */

// NOTE: We use await inside for loop. If we use Promise.all, we get 500 error from kong.
// @see https://github.com/Kong/kong/issues/3440

const KongAdminApi = require('./kong-admin-api');

const readline = require('readline');

// Here upstream service is our lambda function, that's we just set the dummy upstream url 'http://127.0.0.1:80/'
const defaultUpstreamUrl = 'http://127.0.0.1:80/';

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

const buildRouteConfig = config => {
    if (!config) {
        return config;
    }

    // Construct route config object in the format the kong admin api expect.
    const kongRouteConfig = {};
    if (config.path) {
        kongRouteConfig.paths = [config.path];
    }

    if (config.method) {
        kongRouteConfig.methods = [config.method.toUpperCase()];
    }

    if (config.host) {
        kongRouteConfig.hosts = [config.host];
    }

    return kongRouteConfig;
};

// Serverless plugin custom commands and lifecycle events
const commands = {
    kong: {
        usage: 'Helps you create/update/delete services and routes registered with kong. e.g. sls kong create-services',
        commands: {
            'create-routes': {
                usage: 'Helps you create routes in kong',
                lifecycleEvents: [
                    'create-routes'
                ],
                options: {
                    'function-name': {
                        usage: 'Specify the name of the function for which you want to create route entry in Kong (e.g. "--function-name example1" "-n example1")',
                        shortcut: 'n',
                        required: false
                    },
                }
            },
            'delete-route': {
                usage: 'Helps you remove route from kong',
                lifecycleEvents: [
                    'delete-route'
                ],
                options: {
                    'function-name': {
                        usage: 'Specify the name of the function for which you want to delete route entry from Kong (e.g. "--function-name example1" "-n example1")',
                        shortcut: 'n',
                        required: true
                    },
                }
            },
            'update-route': {
                usage: 'Helps you update the route config in the Kong',
                lifecycleEvents: [
                    'update-route'
                ],
                options: {
                    'function-name': {
                        usage: 'Specify the name of the function for which you want to update the route config in kong (e.g. "--function-name example1" "-n example1")',
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
        const kongAdminApiCredentials = (serverless.service.custom.kong || {}).adminApiCredentials || {};

        this.serverless = serverless;
        this.cli = serverless.cli;
        this.options = options;

        this.kongAdminApi = new KongAdminApi({
            adminApiUrl: kongAdminApiCredentials.url, adminApiHeaders: kongAdminApiCredentials.headers
        });

        this.commands = commands;

        this.hooks = {
            'kong:create-routes:create-routes': this.createRoutes.bind(this),
            'kong:update-route:update-route': this.updateRoute.bind(this),
            'kong:delete-route:delete-route': this.deleteRoute.bind(this),
        };
    }

    /**
     * Retrieve route configuration for given function name
     * @param functionName - The function name
     * @returns {*}
     */
    getConfigurationByFunctionName(functionName) {
        let route = null;
        const functions = this.serverless.service.functions || {};

        if (!functionName) {
            throw new Error('Missing required "functionName" parameter');
        }

        const functionDef = functions[functionName] || {};

        (functionDef.events || []).forEach(event => {
            if (event.kong) {
                route = event.kong;
            }
        });

        return route;
    }

    /**
     * Retrieve route configuration of each function from serverless config.
     * @returns {Object|Array[]}
     */
    getConfigurations() {
        const routes = [];
        const functions = this.serverless.service.functions || {};

        Object.keys(functions).forEach(key => {
            console.log(key);
            const functionDef = functions[key];
            functionDef.events.forEach(event => {
                if (event.kong) {
                    routes.push(event.kong);
                }
            });
        });

        return routes;
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
     * Create Route
     * @param serviceName -  The name of the Service which this route will target.
     * @param routeConfig - The route config to create
     * @returns {Promise<*|null>}
     */
    async createRoute({ serviceName, routeConfig }) {
        if (!serviceName) {
            throw new Error('Missing required "serviceName" parameter.');
        }

        if (!routeConfig) {
            throw new Error('Missing required "routeConfig" parameter.');
        }

        // Construct route config object in the format the kong admin api expect.
        const kongRouteConfig = buildRouteConfig(routeConfig);

        const grResponse = await this.kongAdminApi.getRouteByConfig({
            serviceName,
            routeConfig: kongRouteConfig
        });

        let route = (grResponse && grResponse.result) || null;

        if (!route) {
            this.cli.log(`Creating a route. ${JSON.stringify(routeConfig)}`);
            const response = await this.kongAdminApi.createRoute({ serviceName, routeConfig: kongRouteConfig });
            route = ((response || {}).result || {});
        } else {
            this.cli.log(`The Route "${JSON.stringify(routeConfig)}" is already exist in Kong`);
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
     * This function is register with the life cycle hook "kong:create-routes:create-routes"
     * The input params can be passed from commandline (e.g. sls kong create-routes -n example-function-1)
     * The input param function-name is an optional one. You can pass it from command line using  --function-name or -n
     *
     * Read route configurations from serverless config file and create routes
     * @returns {Promise<void>}
     */
    async createRoutes() {
        try {
            let routes = [];
            const functionName = this.options['function-name'];

            if (functionName) {
                const route = this.getConfigurationByFunctionName(functionName);
                routes.push(route);
            } else {
                routes = this.getConfigurations();
            }

            for (let routeIndex = 0; routeIndex < routes.length; routeIndex++) {
                const route = routes[routeIndex];

                const isServiceExist = await this.kongAdminApi.isServiceExist({ serviceName: route.service });

                if (!isServiceExist) {
                    await this.createService({ serviceName: route.service, upstreamUrl: defaultUpstreamUrl });
                }

                await this.createRoute({
                    serviceName: route.service,
                    routeConfig: route
                });
            }
        } catch (e) {
            this.cli.log(e);
        }
    }

    /**
     * This function is register with the life cycle hook "kong:update-route:update-route".
     * The input params can be passed from commandline (e.g.  sls kong update-route -n example-service-1)
     * Function name is required field for this function. You can pass it from command line using  --function-name or -n
     * This function will read the route configuration from serverless config
     * @returns {Promise<void>}
     */
    async updateRoute() {
        try {
            const functionName = this.options['function-name'];
            const routeConfig = this.getConfigurationByFunctionName(functionName);

            if (!routeConfig) {
                return;
            }

            // Construct route config object in the format the kong admin api expect.
            const kongRouteConfig = buildRouteConfig(routeConfig);

            const grResponse = await this.kongAdminApi.getRouteByConfig({
                serviceName: routeConfig.service,
                routeConfig: kongRouteConfig
            });

            const route = (grResponse && grResponse.result) || null;

            if (route) {
                const answer = await confirm(`Do you want to update the ${functionName}'s route ${JSON.stringify(routeConfig)}? \nEnter "YES" to update: `);

                if (answer !== 'YES') {
                    return;
                }

                this.cli.log(`Updating route. ${JSON.stringify(routeConfig)}`);
                await this.kongAdminApi.updateRoute({ routeId: route.id, routeConfig: kongRouteConfig });
            } else {
                this.cli.log(`There is no route entry exist with this config "${JSON.stringify(routeConfig)}" in Kong`);
            }
        } catch (e) {
            this.cli.log(e);
        }
    }

    /**
     * This function is register with the life cycle hook "kong:remove-route:remove-route".
     * The input params can be passed from commandline (e.g.  sls kong remove-route -n example-function-1)
     * Function name is required for this function. You can pass it from command line using  --function-name or -n
     * This function will remove route from Kong.
     * @returns {Promise<void>}
     */
    async deleteRoute() {
        try {
            const functionName = this.options['function-name'];
            const routeConfig = this.getConfigurationByFunctionName(functionName);

            if (!routeConfig) {
                return;
            }

            // Construct route config object in the format the kong admin api expect.
            const kongRouteConfig = buildRouteConfig(routeConfig);

            const grResponse = await this.kongAdminApi.getRouteByConfig({
                serviceName: routeConfig.service,
                routeConfig: kongRouteConfig
            });

            const route = (grResponse && grResponse.result) || null;

            if (route) {
                const answer = await confirm(`Do you want to remove the ${functionName}'s route ${JSON.stringify(routeConfig)}? \nEnter "YES" to remove: `);

                if (answer !== 'YES') {
                    return;
                }

                this.cli.log(`Removing route. ${JSON.stringify(routeConfig)}`);
                await this.kongAdminApi.deleteRoute({ routeId: route.id });
            } else {
                this.cli.log(`There is no route entry exist with this config "${JSON.stringify(routeConfig)}" in Kong`);
            }
        } catch (e) {
            this.cli.log(e);
        }
    }
}

module.exports = ServerlessPlugin;
