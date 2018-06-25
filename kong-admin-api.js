const httpHelper = require('./http-helper');

const STATUS_CODES = {
    NOT_FOUND: 404,
    OK: 200
};

// ResponseObject: { statusCode: "HTTP_STATUS_CODE", result: "Object|Array" }.
// Refer Kong admin api for status code and result object. We use kong's admin rest APIs to read/create/update/delete
// a service, route, plugin. We set http status code in statusCode field and response body in result field.
// @see https://getkong.org/docs/0.13.x/admin-api

/**
 * @class KongAdminApi
 * @classdesc
 * Wrapper class for kong admin api. This will give set of helper functions to create service, route and plugin.
 */
class KongAdminApi {
    constructor(config) {
        if (!config || !config.adminApiUrl) {
            throw new Error('adminApiUrl is mandatory');
        }

        this.requestHandler = httpHelper.create({
            url: config.adminApiUrl,
            headers: config.headers
        });
        this.config = config;
    }

    /**
     * Get a service details from Kong
     * @param serviceName -  The name of the Service to retrieve.
     * @returns {Promise<ResponseObject>}
     */
    async getService({ serviceName }) {
        try {
            if (!serviceName) {
                throw new Error('Missing required "serviceName" parameter.');
            }

            const response = await this.requestHandler({
                path: `/services/${serviceName}`,
                method: 'GET'
            });

            return response;
        } catch (e) {
            throw e;
        }
    }

    /**
     * Create Service
     * @param serviceName - The Service name.
     * @param upstreamUrl - The url of the upstream server
     * @returns {Promise<ResponseObject>}
     */
    async createService({ serviceName, upstreamUrl }) {
        let response;

        try {
            if (!serviceName) {
                throw new Error('Missing required "serviceName" parameter.');
            }

            if (!upstreamUrl) {
                throw new Error('Missing required "upstreamUrl" parameter.');
            }

            const service = await this.requestHandler({ path: `/services/${serviceName}`, method: 'GET' });

            if (service.statusCode === STATUS_CODES.OK) {
                throw new Error(`Service "${serviceName}" is already exist`);
            }

            response = await this.requestHandler({
                path: '/services',
                method: 'POST',
                data: {
                    name: serviceName,
                    url: upstreamUrl
                }
            });
        } catch (e) {
            throw e;
        }

        return response;
    }

    /**
     * Delete Service
     * @param serviceName - Name of the Service to delete.
     * @returns {Promise<ResponseObject>}
     */
    async deleteService({ serviceName }) {
        let response;
        try {
            if (!serviceName) {
                throw new Error('Missing required "serviceName" parameter.');
            }

            response = await this.requestHandler({
                path: `/services/${serviceName}`,
                method: 'DELETE'
            });
        } catch (e) {
            throw e;
        }

        return response;
    }

    /**
     * Create Route
     * @param serviceName - The name of the service to which this Route is associated to.
     * @param routeConfig - The route object excluding service object.
     *                      The code will populate the service object from service name.
     *                      @see https://getkong.org/docs/0.13.x/admin-api/#route-object for route object
     * @returns {Promise<ResponseObject>}
     */
    async createRoute({ serviceName, routeConfig }) {
        let response;
        try {
            if (!serviceName) {
                throw new Error('Missing required "serviceName" parameter.');
            }

            if (!routeConfig) {
                throw new Error('Missing required "routeConfig" parameter.');
            }

            if (!routeConfig.hosts && !routeConfig.paths && !routeConfig.methods) {
                throw new Error('At least one of these fields must be non-empty: ' +
                    '\'routeConfig.methods\', \'routeConfig.hosts\', \'routeConfig.paths\'');
            }


            const service = await this.requestHandler({ path: `/services/${serviceName}`, method: 'GET' });

            if (service.statusCode === STATUS_CODES.NOT_FOUND) {
                throw new Error(`Service "${serviceName}" is not exist`);
            }

            const route = Object.assign({ service: { id: service.result.id } }, routeConfig);

            response = await this.requestHandler({
                path: '/routes',
                method: 'POST',
                data: route
            });
        } catch (e) {
            throw e;
        }

        return response;
    }

    /**
     * Update Route
     * @param routeId - The id of the Route to update.
     * @param routeConfig - The route object. @see: https://getkong.org/docs/0.13.x/admin-api/#request-body
     * @returns {Promise<ResponseObject>}
     */
    async updateRoute({ routeId, routeConfig }) {
        let response;

        try {
            if (!routeId) {
                throw new Error('Missing required "routeId" parameter.');
            }

            if (!routeConfig) {
                throw new Error('Missing required "routeConfig" parameter.');
            }

            if (!routeConfig.hosts && !routeConfig.paths && !routeConfig.methods) {
                throw new Error('At least one of these fields must be non-empty: ' +
                    '\'routeConfig.methods\', \'routeConfig.hosts\', \'routeConfig.paths\'');
            }

            response = await this.requestHandler({
                path: `/routes/${routeId}`,
                method: 'PATCH',
                data: routeConfig
            });
        } catch (e) {
            throw e;
        }

        return response;
    }

    /**
     * Delete Route
     * @param routeId - The id of the Route to delete
     * @returns {Promise<ResponseObject>}
     */
    async deleteRoute({ routeId }) {
        let response;
        try {
            if (!routeId) {
                throw new Error('Missing required "routeId" parameter.');
            }

            response = await this.requestHandler({
                path: `/routes/${routeId}`,
                method: 'DELETE'
            });
        } catch (e) {
            throw e;
        }

        return response;
    }

    // This is a helper function to create a unique key for a route.
    // This key will be used to check whether the route is already exist in kong or not
    // Note: There is no field in kong route config to uniquely identify
    // the route created in the kong like the name field in service and also
    // at least one of these fields must be non-empty: 'methods', 'hosts', 'paths' to create a route.
    // That's why we just combine hosts, paths and methods to create unique key for route.
    generateUniqueKeyForRoute({ routeConfig }) {
        let key = '';
        const fields = [];

        if (!routeConfig) {
            return key;
        }

        const hosts = (routeConfig.hosts && routeConfig.hosts.sort().join(',')) || '';
        const paths = (routeConfig.paths && routeConfig.paths.sort().join(',')) || '';
        const methods = (routeConfig.methods && routeConfig.methods.sort().join(',')) || '';

        /* istanbul ignore else */
        if (hosts) {
            fields.push(hosts);
        }

        /* istanbul ignore else */
        if (paths) {
            fields.push(paths);
        }

        /* istanbul ignore else */
        if (methods) {
            fields.push(methods);
        }

        key = fields.join('|');

        return key;
    }

    /**
     * Retrieve Route
     * @param routeId - The id of the Route to retrieve
     * @returns {Promise<ResponseObject>}
     */
    async getRoute({ routeId }) {
        let response;
        try {
            if (!routeId) {
                throw new Error('Missing required "routeId" parameter.');
            }

            response = await this.requestHandler({ path: `/routes/${routeId}`, method: 'GET' });
        } catch (e) {
            throw e;
        }
        return response;
    }

    /**
     * Retrieve Route. This function use the hosts, paths and methods as compositekey and retrieve the route
     * @param serviceName - The name of the Service whose routes are to be retrieved.
     * @param routeConfig - The route object.
     * @returns {Promise<ResponseObject>}
     */
    async getRouteByConfig({ serviceName, routeConfig }) {
        let response;
        const requestedRouteKey = this.generateUniqueKeyForRoute({ routeConfig });
        try {
            if (!serviceName) {
                throw new Error('Missing required "serviceName" parameter.');
            }

            if (!routeConfig) {
                throw new Error('Missing required "routeConfig" parameter.');
            }

            if (!routeConfig.hosts && !routeConfig.paths && !routeConfig.methods) {
                throw new Error('At least one of these fields must be non-empty: ' +
                    '\'routeConfig.methods\', \'routeConfig.hosts\', \'routeConfig.paths\'');
            }


            const res = await this.requestHandler({ path: `/services/${serviceName}/routes`, method: 'GET' });
            /* istanbul ignore next */
            const routes = ((res.result || {}).data || []).filter(route => {
                const routeKey = this.generateUniqueKeyForRoute({ routeConfig: route });
                return requestedRouteKey === routeKey;
            });

            const route = routes[0] || null;
            const statusCode = route ? res.statusCode : STATUS_CODES.NOT_FOUND;

            response = { statusCode, result: route };
        } catch (e) {
            throw e;
        }

        return response;
    }

    /**
     * Fetch Routes associated to a Service
     * @param serviceName - Name of the Service whose routes are to be Retrieved.
     * @returns {Promise<ResponseObject>}
     */
    async getRoutes({ serviceName }) {
        let response;
        try {
            if (!serviceName) {
                throw new Error('Missing required "serviceName" parameter.');
            }

            response = await this.requestHandler({ path: `/services/${serviceName}/routes`, method: 'GET' });
        } catch (e) {
            throw e;
        }

        return response;
    }

    /**
     * Add plugin to Service
     * @param serviceName - The name of the Service which this plugin will target.
     * @param pluginConfig - The plugin config object
     * @returns {Promise<ResponseObject>}
     */
    async createPluginRequestToService({ serviceName, pluginConfig }) {
        let response;
        try {
            if (!serviceName) {
                throw new Error('Missing required "serviceName" parameter.');
            }

            if (!pluginConfig) {
                throw new Error('Missing required "pluginConfig" parameter.');
            }

            if (!pluginConfig.name) {
                throw new Error('Missing required field "name" in "pluginConfig" parameter');
            }

            const res = await this.requestHandler({ path: `/services/${serviceName}`, method: 'GET' });

            if (res.statusCode === STATUS_CODES.NOT_FOUND) {
                throw new Error(`Service "${serviceName}" is not exist`);
            }

            response = await this.requestHandler({
                path: `/services/${serviceName}/plugins`,
                method: 'POST',
                data: pluginConfig
            });
        } catch (e) {
            throw e;
        }

        return response;
    }

    /**
     * Add plugin to Route
     * @param routeId - The id of the Route which this plugin will target.
     * @param pluginConfig - The plugin config object
     * @returns {Promise<ResponseObject>}
     */
    async createPluginRequestToRoute({ routeId, pluginConfig }) {
        let response;
        try {
            if (!routeId) {
                throw new Error('Missing required "routeId" parameter.');
            }

            if (!pluginConfig) {
                throw new Error('Missing required "pluginConfig" parameter.');
            }

            if (!pluginConfig.name) {
                throw new Error('Missing required field "name" in "pluginConfig" parameter');
            }

            const route = await this.requestHandler({ path: `/routes/${routeId}`, method: 'GET' });

            if (route.statusCode === STATUS_CODES.NOT_FOUND) {
                throw new Error(`There is no route exist with this ID "${routeId}".`);
            }

            response = await this.requestHandler({
                path: `/routes/${routeId}/plugins`,
                method: 'POST',
                data: pluginConfig
            });
        } catch (e) {
            throw e;
        }
        return response;
    }

    /**
     * Update Plugin
     * @param pluginId - The id of the plugin to update
     * @param pluginConfig - The plugin config object
     * @returns {Promise<ResponseObject>}
     */
    async updatePlugin({ pluginId, pluginConfig }) {
        let response;
        try {
            if (!pluginId) {
                throw new Error('Missing required "pluginId" parameter.');
            }

            if (!pluginConfig) {
                throw new Error('Missing required "pluginConfig" parameter.');
            }

            if (!pluginConfig.name) {
                throw new Error('Missing required field "name" in "pluginConfig" parameter');
            }

            response = await this.requestHandler({
                path: `/plugins/${pluginId}`,
                method: 'PATCH',
                data: pluginConfig
            });
        } catch (e) {
            throw e;
        }

        return response;
    }

    /**
     * Delete Plugin
     * @param pluginId - The id of the plugin to delete
     * @returns {Promise<ResponseObject>}
     */
    async deletePlugin({ pluginId }) {
        let response;
        try {
            if (!pluginId) {
                throw new Error('Missing required "pluginId" parameter.');
            }

            response = await this.requestHandler({
                path: `/plugins/${pluginId}`,
                method: 'DELETE'
            });
        } catch (e) {
            throw e;
        }

        return response;
    }

    /**
     * Retrieve Plugin
     * @param pluginId - The id of the plugin to retrieve
     * @returns {Promise<ResponseObject>}
     */
    async getPlugin({ pluginId }) {
        let response;
        try {
            if (!pluginId) {
                throw new Error('Missing required "pluginId" parameter.');
            }

            response = await this.requestHandler({ path: `/plugins/${pluginId}`, method: 'GET' });
        } catch (e) {
            throw e;
        }
        return response;
    }

    /**
     * Retrieve plugins added to a service
     * @param serviceName - The name of the service to retrieve plugins
     * @returns {Promise<ResponseObject>}
     */
    async getPluginsRequestToService({ serviceName }) {
        let response;
        try {
            if (!serviceName) {
                throw new Error('Missing required "serviceName" parameter.');
            }

            response = await this.requestHandler({ path: `/services/${serviceName}/plugins`, method: 'GET' });
        } catch (e) {
            throw e;
        }

        return response;
    }

    /**
     * Retrieve plugins added to a route
     * @param routeId - The id of the route to retrieve plugins
     * @returns {Promise<ResponseObject>}
     */
    async getPluginsRequestToRoute({ routeId }) {
        let response;
        try {
            if (!routeId) {
                throw new Error('Missing required "routeId" parameter.');
            }
            response = await this.requestHandler({ path: `/routes/${routeId}/plugins`, method: 'GET' });
        } catch (e) {
            throw e;
        }

        return response;
    }


    /**
     * Retrieve a plugin added to a service
     * @param serviceName - The name of the service on which the plugin is added to
     * @param pluginName - The name of the plugin to retrieve
     * @returns {Promise<ResponseObject|null>}
     */
    async getPluginByNameRequestToService({ serviceName, pluginName }) {
        let response;
        try {
            if (!serviceName) {
                throw new Error('Missing required "serviceName" parameter.');
            }

            if (!pluginName) {
                throw new Error('Missing required "pluginName" parameter.');
            }

            const res = await this.requestHandler({ path: `/services/${serviceName}/plugins`, method: 'GET' });
            /* istanbul ignore next */
            const filteredPlugin = ((res.result || {}).data || []).filter(plugin => plugin.name === pluginName);

            const plugin = filteredPlugin[0] || null;

            const statusCode = (plugin && res.statusCode) || STATUS_CODES.NOT_FOUND;

            response = { statusCode, result: plugin };
        } catch (e) {
            throw e;
        }

        return response;
    }

    /**
     * Retrieve a plugin added to a route
     * @param routeId - The id of the route on which the plugin is added to
     * @param pluginName - The name of the plugin to retrieve
     * @returns {Promise<ResponseObject>}
     */
    async getPluginByNameRequestToRoute({ routeId, pluginName }) {
        let response;
        try {
            if (!routeId) {
                throw new Error('Missing required "routeId" parameter.');
            }

            if (!pluginName) {
                throw new Error('Missing required "pluginName" parameter.');
            }

            const plugins = await this.requestHandler({ path: `/routes/${routeId}/plugins`, method: 'GET' });

            /* istanbul ignore next */
            const filteredPlugin = ((plugins.result || {}).data || []).filter(plugin => plugin.name === pluginName);

            const plugin = filteredPlugin[0] || null;

            const statusCode = (plugin && plugins.statusCode) || STATUS_CODES.NOT_FOUND;
            response = { statusCode, result: plugin };
        } catch (e) {
            throw e;
        }

        return response;
    }

    /**
     * Check if the service exist
     * @param serviceName - The name of the service to check
     * @returns {Promise<boolean>}
     */
    async isServiceExist({ serviceName }) {
        let isExist = false;
        try {
            if (!serviceName) {
                throw new Error('Missing required "serviceName" parameter.');
            }

            const response = await this.requestHandler({ path: `/services/${serviceName}`, method: 'GET' });
            if (response.statusCode === STATUS_CODES.OK && response.result) {
                isExist = true;
            }
        } catch (e) {
            throw e;
        }

        return isExist;
    }

    /**
     * Check if the plugin is added to the service
     * @param serviceName - The name of the service on which to check
     * @param pluginName - The name of the plugin to check
     * @returns {Promise<boolean>}
     */
    async isPluginExistRequestToService({ serviceName, pluginName }) {
        let isExist = false;
        try {
            if (!serviceName) {
                throw new Error('Missing required "serviceName" parameter.');
            }

            if (!pluginName) {
                throw new Error('Missing required "pluginName" parameter.');
            }

            const plugins = await this.requestHandler({ path: `/services/${serviceName}/plugins`, method: 'GET' });
            /* istanbul ignore next */
            const filteredPlugin = ((plugins.result || {}).data || []).filter(plugin => plugin.name === pluginName);

            const plugin = filteredPlugin[0] || null;

            if (plugin) {
                isExist = true;
            }
        } catch (e) {
            throw e;
        }

        return isExist;
    }
}

module.exports = KongAdminApi;
