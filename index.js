/* eslint no-await-in-loop: 0 */

// NOTE: We use await inside for loop. If we use Promise.all, we get 500 error from kong.
// @see https://github.com/Kong/kong/issues/3440
const KongAdminApi = require('./kong-admin-api');
const utils = require('./utils');
const defaults = require('./defaults');

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
                    'non-interactive-mode': {
                        usage: '(e.g. "--non-interactive-mode true")',
                        required: false
                    }
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
                    'non-interactive-mode': {
                        usage: '(e.g. "--non-interactive-mode true")',
                        required: false
                    }
                }
            }
        }
    }
};

class ServerlessPlugin {
    constructor(serverless, options) {
        const kong = serverless.service.custom.kong || {};

        this.serverless = serverless;
        this.cli = serverless.cli;
        this.options = options;

        this.defaultKongAdminApiCredentialsProfile = 'default';

        this.commands = commands;

        this.hooks = {
            'kong:create-service:create-service': this.createService.bind(this),
            'kong:create-routes:create-routes': this.createRoutes.bind(this),
            'kong:update-route:update-route': this.updateRoute.bind(this),
            'kong:delete-route:delete-route': this.deleteRoute.bind(this),
        };


        this.kongAdminApiCredentialConfig = {
            path: kong.admin_credentials_file,
            profile: kong.admin_credentials_profile || this.defaultKongAdminApiCredentialsProfile
        };

        const kongAdminApiCredentials = this.getKongAdminApiCredentials();

        this.kongAdminApi = new KongAdminApi({
            adminApiUrl: kongAdminApiCredentials.url, adminApiHeaders: kongAdminApiCredentials.headers
        });
    }

    getKongAdminApiCredentials() {
        let kongAdminApiCredential = null;
        let kongAdminApiCredentialsFilePath;

        try {
            if (utils.isFileExist(this.kongAdminApiCredentialConfig.path)) {
                kongAdminApiCredentialsFilePath = utils.resolvePath(this.kongAdminApiCredentialConfig.path);
            }

            if (!this.kongAdminApiCredentialConfig.path) {
                kongAdminApiCredentialsFilePath = utils.findFile(
                    defaults.kongAdminApiCredentials.defaultPaths,
                    defaults.kongAdminApiCredentials.fileName
                );
            }

            console.log();

            // eslint-disable-next-line
            const kongAdminApiCredentials = utils.readJsonFile(kongAdminApiCredentialsFilePath);

            if (!kongAdminApiCredentials) {
                throw new Error(`Missing kong admin configuration ${kongAdminApiCredentialsFilePath}`);
            }

            kongAdminApiCredential = kongAdminApiCredentials
                && kongAdminApiCredentials[this.kongAdminApiCredentialConfig.profile];
        } catch (e) {
            throw e;
        }

        return kongAdminApiCredential;
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
    async createService() {
        let result;

        const { service } = ((this.serverless.service.custom || {}).kong || {});

        if (!service) {
            throw new Error('Service configuration is missing in kong settings. Configure it in serverless custom kong section');
        }

        if (!service.name) {
            throw new Error('Missing required "name" field in kong service configuration.');
        }

        const isServiceExist = await this.kongAdminApi.isServiceExist({ serviceName: service.name });

        if (!isServiceExist) {
            this.cli.log(`Creating a service ${service.name}`);
            result = await this.kongAdminApi.createService({
                serviceName: service.name, upstreamUrl: defaults.upstreamUrl
            });
        } else {
            this.cli.log(`The service "${service.name}" is already exist`);
        }

        return result;
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

        if (!routeConfig.path && !routeConfig.host && !routeConfig.method) {
            throw new Error('At least one of these fields must be non-empty: \'method\', \'host\', \'path\'');
        }

        const kongRouteConfig = utils.buildRouteConfig(routeConfig);

        const grResponse = await this.kongAdminApi.getRouteByConfig({
            serviceName,
            routeConfig: kongRouteConfig.config
        });

        let route = (grResponse && grResponse.result) || null;

        if (!route) {
            this.cli.log(`Creating a route. ${JSON.stringify(routeConfig)}`);
            const response = await this.kongAdminApi.createRoute({ serviceName, routeConfig: kongRouteConfig.config });
            route = ((response || {}).result || {});
        } else {
            this.cli.log(`The Route "${JSON.stringify(routeConfig)}" is already exist in Kong`);
        }

        return route;
    }

    /**
     * This function is register with the life cycle hook "kong:create-routes:create-routes"
     * The input params can be passed from commandline (e.g. sls kong create-routes -n example-function-1)
     * The input param function-name is an optional one. You can pass it from command line using  --function-name or -n
     *
     * Read route configurations from serverless config file and create routes
     * @returns {Promise<Array[]>}
     */
    async createRoutes() {
        const createdRoutes = [];

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
                    throw new Error(`There is no service exist with this name ${route.service}`);
                }

                const res = await this.createRoute({
                    serviceName: route.service,
                    routeConfig: route
                });

                createdRoutes.push(res);
            }
        } catch (e) {
            this.cli.log(e);
        }

        return createdRoutes;
    }

    /**
     * This function is register with the life cycle hook "kong:update-route:update-route".
     * The input params can be passed from commandline (e.g.  sls kong update-route -n example-service-1)
     * Function name is required field for this function. You can pass it from command line using  --function-name or -n
     * This function will read the route configuration from serverless config
     * @returns {Promise<object|null>}
     */
    async updateRoute() {
        let response = null;
        try {
            const functionName = this.options['function-name'];
            const nonInteractiveMode = this.options['non-interactive-mode'];
            const routeConfig = this.getConfigurationByFunctionName(functionName);
            if (!routeConfig) {
                throw new Error(`There is function with this name "${functionName}"`);
            }

            // Construct route config object in the format the kong admin api expect.
            const kongRouteConfig = utils.buildRouteConfig(routeConfig);

            const grResponse = await this.kongAdminApi.getRouteByConfig({
                serviceName: routeConfig.service,
                routeConfig: kongRouteConfig.config
            });

            const route = (grResponse && grResponse.result) || null;
            if (route) {
                if (!nonInteractiveMode) {
                    const answer = await utils.confirm(`Do you want to update the ${functionName}'s route ${JSON.stringify(routeConfig)}? \nEnter "YES" to update: `);

                    if (answer !== 'YES') {
                        return response;
                    }
                }


                this.cli.log(`Updating route. ${JSON.stringify(routeConfig)}`);
                response = await this.kongAdminApi.updateRoute({
                    routeId: route.id, routeConfig: kongRouteConfig.config
                });
            } else {
                this.cli.log(`There is no route entry exist with this config "${JSON.stringify(routeConfig)}" in Kong`);
            }
        } catch (e) {
            this.cli.log(e);
        }

        return response;
    }

    /**
     * This function is register with the life cycle hook "kong:remove-route:remove-route".
     * The input params can be passed from commandline (e.g.  sls kong remove-route -n example-function-1)
     * Function name is required for this function. You can pass it from command line using  --function-name or -n
     * This function will remove route from Kong.
     * @returns {Promise<object|null>}
     */
    async deleteRoute() {
        let response = null;
        try {
            const functionName = this.options['function-name'];
            const nonInteractiveMode = this.options['non-interactive-mode'];
            const routeConfig = this.getConfigurationByFunctionName(functionName);

            if (!routeConfig) {
                return response;
            }


            // Construct route config object in the format the kong admin api expect.
            const kongRouteConfig = utils.buildRouteConfig(routeConfig);

            const grResponse = await this.kongAdminApi.getRouteByConfig({
                serviceName: routeConfig.service,
                routeConfig: kongRouteConfig.config
            });

            const route = (grResponse && grResponse.result) || null;

            if (route) {
                if (!nonInteractiveMode) {
                    const answer = await utils.confirm(`Do you want to remove the ${functionName}'s route ${JSON.stringify(routeConfig)}? \nEnter "YES" to remove: `);

                    if (answer !== 'YES') {
                        return response;
                    }
                }

                this.cli.log(`Removing route. ${JSON.stringify(routeConfig)}`);
                response = await this.kongAdminApi.deleteRoute({ routeId: route.id });
            } else {
                this.cli.log(`There is no route entry exist with this config "${JSON.stringify(routeConfig)}" in Kong`);
            }
        } catch (e) {
            this.cli.log(e);
        }
        return response;
    }
}

module.exports = ServerlessPlugin;
