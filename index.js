/* eslint no-await-in-loop: 0 */

const KongAdminApi = require('./kong-admin-api');

class ServerlessPlugin {
    constructor(serverless, options) {
        this.serverless = serverless;
        this.options = options;
        this.kongAdminApi = new KongAdminApi({ adminUrl: this.serverless.service.custom.kong.adminApiUrl });
        this.commands = {
            kong: {
                usage: 'Helps you create service and routes in kong',
                lifecycleEvents: [
                    'register'
                ]
            },
        };

        this.hooks = {
            'kong:register': this.registerService.bind(this),
        };
    }

    async registerService() {
        try {
            const services = this.serverless.service.custom.kong.services || [];

            for (let serviceIndex = 0; serviceIndex < services.length; serviceIndex++) {
                const serviceConfig = services[serviceIndex];
                const servicePlugins = serviceConfig.plugins || [];
                const routes = serviceConfig.routes || [];

                const isServiceExist = await this.kongAdminApi.isServiceExist(serviceConfig.name);

                if (!isServiceExist) {
                    this.serverless.cli.log(`Creating a service ${serviceConfig.name}`);
                    await this.kongAdminApi.createService(serviceConfig.name, serviceConfig.host);
                } else {
                    this.serverless.cli.log(`The service "${serviceConfig.name}" is already exist`);
                }

                for (let pluginIndex = 0; pluginIndex < servicePlugins.length; pluginIndex++) {
                    const pluginConfig = servicePlugins[pluginIndex];
                    const response = await this.kongAdminApi.getPluginByNameRequestToService(
                        serviceConfig.name,
                        pluginConfig.name
                    );
                    const plugin = (response || {}).result || {};
                    if (!plugin.id) {
                        this.serverless.cli.log(`Creating a service plugin "${pluginConfig.name}"`);
                        await this.kongAdminApi.createPluginRequestToService(serviceConfig.name, pluginConfig);
                    } else {
                        this.serverless.cli.log(`Updating the service plugin "${pluginConfig.name}"`);
                        await this.kongAdminApi.updatePlugin(plugin.id, pluginConfig);
                    }
                }

                for (let routeIndex = 0; routeIndex < routes.length; routeIndex++) {
                    const routeConfig = routes[routeIndex];
                    const routePlugins = routeConfig.plugins || [];

                    const grResponse = await this.kongAdminApi.getRouteByHostsAndPaths(
                        serviceConfig.name,
                        routeConfig.config.hosts,
                        routeConfig.config.paths
                    );
                    let route = (grResponse && grResponse.result) || null;

                    if (!route) {
                        this.serverless.cli.log(`Creating a route. Hosts: ${routeConfig.config.hosts}; Paths: ${routeConfig.config.paths}`);
                        const response = await this.kongAdminApi.createRoute(serviceConfig.name, routeConfig.config);
                        route = ((response || {}).result || {});
                    } else {
                        this.serverless.cli.log(`Updating route. Hosts: ${routeConfig.config.hosts}; Paths: ${routeConfig.config.paths}`);
                        await this.kongAdminApi.updateRoute(route.id, routeConfig.config);
                    }


                    if (route.id) {
                        for (let pluginIndex = 0; pluginIndex < routePlugins.length; pluginIndex++) {
                            const pluginConfig = routePlugins[pluginIndex];
                            const res = await this.kongAdminApi.getPluginByNameRequestToRoute(
                                route.id,
                                pluginConfig.name
                            );
                            const plugin = (res || {}).result || {};

                            if (!plugin.id) {
                                this.serverless.cli.log(`Creating a route plugin "${pluginConfig.name}"`);
                                await this.kongAdminApi.createPluginRequestToRoute(route.id, pluginConfig);
                            } else {
                                this.serverless.cli.log(`Updating the route plugin "${pluginConfig.name}"`);
                                await this.kongAdminApi.updatePlugin(plugin.id, pluginConfig);
                            }
                        }
                    }
                }
            }
        } catch (e) {
            this.serverless.cli.log(e);
        }
    }
}

module.exports = ServerlessPlugin;
