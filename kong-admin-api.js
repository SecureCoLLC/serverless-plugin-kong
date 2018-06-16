const httpHelper = require('./http-helper');

const STATUS_CODES = {
    NOT_FOUND: 404,
    OK: 200
};

// Helper function to parse and throw an error
const throwError = exception => {
    let message;
    if (exception instanceof Error) {
        message = exception;
    } else if (typeof exception === 'object') {
        message = JSON.stringify((exception));
    } else {
        message = exception;
    }

    throw new Error(message);
};

class KongAdminApi {
    constructor(config) {
        if (!config || !config.adminUrl) {
            throw new Error('adminUrl is mandatory');
        }

        this.config = config;
    }

    async getService(serviceName) {
        try {
            const response = await httpHelper.request({ url: `${this.config.adminUrl}/services/${serviceName}`, method: 'GET' });
            return response;
        } catch (e) {
            throw e;
        }
    }

    async createService(serviceName, upstreamUrl) {
        let response;

        try {
            const service = await httpHelper.request({ url: `${this.config.adminUrl}/services/${serviceName}`, method: 'GET' });

            if (service.statusCode === STATUS_CODES.OK) {
                throw new Error(`Service "${serviceName}" is already exist`);
            }

            response = await httpHelper.request({
                url: `${this.config.adminUrl}/services/`,
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

    async deleteService(serviceName) {
        let response;
        try {
            response = await httpHelper.request({
                url: `${this.config.adminUrl}/services/${serviceName}`,
                method: 'DELETE'
            });
        } catch (e) {
            throw e;
        }

        return response;
    }

    generateUniqueKeyForRoute(routeConfig) {
        let key = '';
        const fields = [];

        if (!routeConfig) {
            return key;
        }

        const hosts = (routeConfig.hosts && routeConfig.hosts.sort().join(',')) || '';
        const paths = (routeConfig.paths && routeConfig.paths.sort().join(',')) || '';
        const methods = (routeConfig.methods && routeConfig.methods.sort().join(',')) || '';

        if (hosts) {
            fields.push(hosts);
        }

        if (paths) {
            fields.push(paths);
        }

        if (methods) {
            fields.push(methods);
        }

        key = fields.join('|');

        return key;
    }

    async createRoute(serviceName, data) {
        let response;
        try {
            const service = await httpHelper.request({ url: `${this.config.adminUrl}/services/${serviceName}`, method: 'GET' });

            if (service.statusCode === STATUS_CODES.NOT_FOUND) {
                throw new Error(`Service "${serviceName}" is not exist`);
            }

            const routeData = Object.assign({ service: { id: service.result.id } }, data);

            response = await httpHelper.request({
                url: `${this.config.adminUrl}/routes`,
                method: 'POST',
                data: routeData
            });
        } catch (e) {
            throw e;
        }

        return response;
    }

    async updateRoute(routeId, routeConfig) {
        let response;

        try {
            response = await httpHelper.request({
                url: `${this.config.adminUrl}/routes/${routeId}`,
                method: 'PATCH',
                data: routeConfig
            });
        } catch (e) {
            throw e;
        }

        return response;
    }

    async deleteRoute(routeId) {
        let response;
        try {
            response = await httpHelper.request({
                url: `${this.config.adminUrl}/routes/${routeId}`,
                method: 'DELETE'
            });
        } catch (e) {
            throw e;
        }

        return response;
    }

    async getRoute(routeId) {
        let response;
        try {
            response = await httpHelper.request({ url: `${this.config.adminUrl}/routes/${routeId}`, method: 'GET' });
        } catch (e) {
            throw e;
        }
        return response;
    }

    async getRoutesByHostName(serviceName, hostName) {
        let response;
        try {
            const res = await httpHelper.request({ url: `${this.config.adminUrl}/services/${serviceName}/routes`, method: 'GET' });
            const routes = ((res.result || {}).data || []).filter(route => {
                let hasHost = false;
                (route.hosts || []).forEach(host => {
                    if (host === hostName) {
                        hasHost = true;
                    }
                });

                return hasHost;
            });

            const statusCode = routes && routes.length > 0 ? response.statusCode : STATUS_CODES.NOT_FOUND;

            response = { statusCode, result: routes };
        } catch (e) {
            throw e;
        }

        return response;
    }

    async getRoutesByPath(serviceName, path) {
        let response;
        try {
            const res = await httpHelper.request({ url: `${this.config.adminUrl}/services/${serviceName}/routes`, method: 'GET' });

            const routes = ((res.result || {}).data || []).filter(route => {
                let hasPath = false;
                (route.paths || []).forEach(routePath => {
                    if (routePath === path) {
                        hasPath = true;
                    }
                });

                return hasPath;
            });

            const statusCode = routes && routes.length > 0 ? res.statusCode : STATUS_CODES.NOT_FOUND;

            response = { statusCode, result: routes };
        } catch (e) {
            throw e;
        }

        return response;
    }

    async getRouteByConfig(serviceName, routeConfig) {
        let response;
        const requestedRouteKey = this.generateUniqueKeyForRoute(routeConfig);
        try {
            const res = await httpHelper.request({ url: `${this.config.adminUrl}/services/${serviceName}/routes`, method: 'GET' });
            const routes = ((res.result || {}).data || []).filter(route => {
                const routeKey = this.generateUniqueKeyForRoute(route);
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

    async getRoutes(serviceName) {
        let response;
        try {
            response = await httpHelper.request({ url: `${this.config.adminUrl}/services/${serviceName}/routes`, method: 'GET' });
        } catch (e) {
            throw e;
        }

        return response;
    }

    async createPluginRequestToService(serviceName, pluginConfig) {
        let response;
        try {
            const res = await httpHelper.request({ url: `${this.config.adminUrl}/services/${serviceName}`, method: 'GET' });

            if (res.statusCode === STATUS_CODES.NOT_FOUND) {
                throw new Error(`Service "${serviceName}" is not exist`);
            }

            response = await httpHelper.request({
                url: `${this.config.adminUrl}/services/${serviceName}/plugins`,
                method: 'POST',
                data: pluginConfig
            });
        } catch (e) {
            throw e;
        }

        return response;
    }

    async updatePluginRequestToService(serviceName, pluginName, pluginConfig) {
        let response;
        try {
            const service = await httpHelper.request({ url: `${this.config.adminUrl}/services/${serviceName}`, method: 'GET' });

            if (service.statusCode === STATUS_CODES.NOT_FOUND) {
                throw new Error(`The service "${serviceName}" is not exist`);
            }

            const plugins = await httpHelper.request({ url: `${this.config.adminUrl}/services/${serviceName}/plugins`, method: 'GET' });
            const filteredPlugin = ((plugins.result || {}).data || []).filter(plugin => plugin.name === pluginName);

            const plugin = filteredPlugin[0] || null;

            if (!plugin) {
                throw new Error(`The plugin "${pluginName}" is not configured with this service "${serviceName}"`);
            }

            response = await httpHelper.request({
                url: `${this.config.adminUrl}/plugins/${plugin.id}`,
                method: 'PATCH',
                data: pluginConfig
            });
        } catch (e) {
            throw e;
        }

        return response;
    }

    async createPluginRequestToRoute(routeId, pluginConfig) {
        let response;
        try {
            const route = await httpHelper.request({ url: `${this.config.adminUrl}/routes/${routeId}`, method: 'GET' });

            if (route.statusCode === STATUS_CODES.NOT_FOUND) {
                throw new Error(`There is no route exist with this ID "${routeId}".`);
            }

            response = await httpHelper.request({
                url: `${this.config.adminUrl}/routes/${routeId}/plugins`,
                method: 'POST',
                data: pluginConfig
            });
        } catch (e) {
            throw e;
        }
        return response;
    }

    async updatePluginRequestToRoute(routeId, pluginName, pluginConfig) {
        let response;
        try {
            const res = await httpHelper.request({ url: `${this.config.adminUrl}/routes/${routeId}`, method: 'GET' });

            if (res.statusCode === STATUS_CODES.NOT_FOUND) {
                throw new Error(`There is no route exist with this ID "${routeId}".`);
            }

            const plugins = await httpHelper.request({ url: `${this.config.adminUrl}/routes/${routeId}/plugins`, method: 'GET' });
            const filteredPlugin = ((plugins.result || {}).data || []).filter(plugin => plugin.name === pluginName);

            const plugin = filteredPlugin[0] || null;

            if (!plugin) {
                throw new Error(`The plugin "${pluginName}" is not configured with this route "${routeId}"`);
            }

            response = await httpHelper.request({
                url: `${this.config.adminUrl}/plugins/${plugin.id}`,
                method: 'PATCH',
                data: pluginConfig
            });
        } catch (e) {
            throw e;
        }
        return response;
    }

    async updatePlugin(pluginId, pluginConfig) {
        let response;
        try {
            response = await httpHelper.request({
                url: `${this.config.adminUrl}/plugins/${pluginId}`,
                method: 'PATCH',
                data: pluginConfig
            });
        } catch (e) {
            throw e;
        }

        return response;
    }

    async deletePlugin(pluginId) {
        let response;
        try {
            response = await httpHelper.request({
                url: `${this.config.adminUrl}/plugins/${pluginId}`,
                method: 'DELETE'
            });
        } catch (e) {
            throw e;
        }

        return response;
    }

    async deletePluginRequestToService(serviceName, pluginName) {
        let response;

        try {
            const plugins = await httpHelper.request({ url: `${this.config.adminUrl}/services/${serviceName}/plugins`, method: 'GET' });

            const filteredPlugin = ((plugins.result || {}).data || []).filter(plugin => plugin.name === pluginName);

            const plugin = filteredPlugin[0] || null;

            if (!filteredPlugin[0]) {
                throw new Error(`There is no plugin exist with this name "${pluginName}" `);
            }

            response = await httpHelper.request({
                url: `${this.config.adminUrl}/plugins/${plugin.id}`,
                method: 'DELETE'
            });
        } catch (e) {
            throw e;
        }

        return response;
    }

    async deletePluginRequestToRoute(routeId, pluginName) {
        let response;

        try {
            const plugins = await httpHelper.request({ url: `${this.config.adminUrl}/routes/${routeId}/plugins`, method: 'GET' });

            const filteredPlugin = ((plugins.result || {}).data || []).filter(plugin => plugin.name === pluginName);

            const plugin = filteredPlugin[0] || null;

            if (!filteredPlugin[0]) {
                throw new Error(`There is no plugin exist with this name "${pluginName}" `);
            }

            response = await httpHelper.request({
                url: `${this.config.adminUrl}/plugins/${plugin.id}`,
                method: 'DELETE'
            });
        } catch (e) {
            throw e;
        }

        return response;
    }

    async getPlugin(pluginId) {
        let response;
        try {
            response = await httpHelper.request({ url: `${this.config.adminUrl}/plugins/${pluginId}`, method: 'GET' });
        } catch (e) {
            throw e;
        }
        return response;
    }

    async getPluginsRequestToService(serviceName) {
        let response;
        try {
            response = await httpHelper.request({ url: `${this.config.adminUrl}/services/${serviceName}/plugins`, method: 'GET' });
        } catch (e) {
            throw e;
        }

        return response;
    }

    async getPluginsRequestToRoute(routeId) {
        let response;
        try {
            response = await httpHelper.request({ url: `${this.config.adminUrl}/routes/${routeId}/plugins`, method: 'GET' });
        } catch (e) {
            throw e;
        }

        return response;
    }


    async getPluginByNameRequestToService(serviceName, pluginName) {
        let response;
        try {
            const res = await httpHelper.request({ url: `${this.config.adminUrl}/services/${serviceName}/plugins`, method: 'GET' });
            const filteredPlugin = ((res.result || {}).data || []).filter(plugin => plugin.name === pluginName);

            const plugin = filteredPlugin[0] || null;

            const statusCode = (plugin && res.statusCode) || STATUS_CODES.NOT_FOUND;

            return { statusCode, result: plugin };
        } catch (e) {
            throw e;
        }
        return response;
    }

    async getPluginByNameRequestToRoute(routeId, pluginName) {
        let response;
        try {
            const plugins = await httpHelper.request({ url: `${this.config.adminUrl}/routes/${routeId}/plugins`, method: 'GET' });

            const filteredPlugin = ((plugins.result || {}).data || []).filter(plugin => plugin.name === pluginName);

            const plugin = filteredPlugin[0] || null;

            const statusCode = (plugin && plugins.statusCode) || STATUS_CODES.NOT_FOUND;
            response = { statusCode, result: plugin };
        } catch (e) {
            throw e;
        }

        return response;
    }

    async isServiceExist(serviceName) {
        let isExist = false;
        try {
            const response = await httpHelper.request({ url: `${this.config.adminUrl}/services/${serviceName}`, method: 'GET' });
            if (response.statusCode === STATUS_CODES.OK && response.result) {
                isExist = true;
            }
        } catch (e) {
            throw e;
        }

        return isExist;
    }

    async isPluginExistRequestToService(serviceName, pluginName) {
        let isExist = false;
        try {
            const plugins = await httpHelper.request({ url: `${this.config.adminUrl}/services/${serviceName}/plugins`, method: 'GET' });
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
