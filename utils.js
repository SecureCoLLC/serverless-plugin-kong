const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Helper function to get an approval before do an action
/* istanbul ignore next */
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
        return null;
    }

    // Construct route config object in the format the kong admin api expect.
    const route = {};
    route.config = Object.assign({}, config);

    /* istanbul ignore else */
    if (config.service) {
        route.service = config.service;
        delete route.config.service;
    }

    /* istanbul ignore else */
    if (config.plugins) {
        route.plugins = [...config.plugins];
        delete route.config.plugins;
    }

    /* istanbul ignore else */
    if (config.path) {
        route.config.paths = [config.path];
        delete route.config.path;
    }

    /* istanbul ignore else */
    if (config.method) {
        route.config.methods = [config.method.toUpperCase()];
        delete route.config.method;
    }

    /* istanbul ignore else */
    if (config.host) {
        route.config.hosts = [config.host];
        delete route.config.host;
    }

    return route;
};


const resolvePath = pathToResolve => {
    /* istanbul ignore next */
    const homeDir = process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'];
    let resolvedPath;

    if (!pathToResolve) {
        return null;
    }

    if (path.isAbsolute(pathToResolve)) {
        return pathToResolve;
    }

    if (pathToResolve === '~') {
        return homeDir;
    }

    const startWith = pathToResolve.slice(0, 2);

    if (startWith === '~/') {
        resolvedPath = path.join(homeDir, pathToResolve.slice(2));
    } else {
        resolvedPath = path.join(process.cwd(), pathToResolve);
    }

    return resolvedPath;
};

const findFile = (searchDirectories, fileName) => {
    let filePath;
    for (let index = 0; index < searchDirectories.length; index++) {
        const resolvedPath = resolvePath(path.join(searchDirectories[index], fileName));
        if (fs.existsSync(resolvedPath)) {
            filePath = resolvedPath;
            break;
        }
    }
    return filePath;
};

const isFileExist = filePath => {
    let isExist = false;
    const resolvedPath = resolvePath(filePath);
    isExist = fs.existsSync(resolvedPath);
    return isExist;
};

const readJsonFile = filePath => {
    let content = null;
    let jsonContent = null;

    if (!filePath || !fs.existsSync(filePath)) {
        throw new Error(`Invalid file path ${filePath || ''}`);
    }

    try {
        content = fs.readFileSync(filePath);
        jsonContent = JSON.parse(content);
    } catch (e) {
        jsonContent = '';
    }

    return jsonContent;
};

module.exports = {
    buildRouteConfig,
    confirm,
    findFile,
    isFileExist,
    resolvePath,
    readJsonFile
};
