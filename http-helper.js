const http = require('http');
const https = require('https');
const { URL } = require('url');

const defaultHeaders = { 'Content-Type': 'application/json' };

const requestHandler = (protocol) => {
   const httpLibs =  { 'http:':  http, 'https:':  https };
   return httpLibs[protocol] || http;
};

const buildRequest = (reqUrl, method, data, headers) => {
    const urlParts = new URL(reqUrl);
    const requestMethod = method && method.toUpperCase()|| 'GET';

    let body ='';

    if ( requestMethod === 'GET') {
        data && Object.keys(data).forEach(key => {
            urlParts.searchParams.append(key, data[key])
        });
    } else {
        body = data && JSON.stringify(data) || '';
    }

    const request = {
        protocol: urlParts.protocol,
        host: urlParts.hostname,
        port: urlParts.port,
        method: requestMethod,
        path: `${urlParts.pathname}${urlParts.search}`,
        body: body,
        headers: Object.assign({}, (headers || {}), defaultHeaders)
    };

    return request;
};

const request = async ({url, method, data, headers}) => {
    return new Promise((resolve, reject) => {
        try {
            const requestParams = buildRequest(url, method, data, headers);

            const request = requestHandler(requestParams.protocol).request(requestParams, response => {
                let responseBody = '';
                response.on('data', chunk => {
                    responseBody += chunk;
                });
                response.on('end', () => {
                    let resp = { statusCode: response.statusCode, result: null };
                    try {
                        resp.result = JSON.parse(responseBody);
                    } catch (e) {
                        resp.result = responseBody;
                    }

                    if (response.statusCode === 404) {
                        resp.result = null;
                        resolve(resp);
                        return
                    }

                    if (response.statusCode >= 200 && response.statusCode < 299) {
                         resolve(resp);
                        return;
                    }

                    if(response.statusCode !== 200) {
                       reject(JSON.stringify(resp));
                       return;
                    }

                });
            }).on('error', e => {
                reject(e);
            });

            request.write(requestParams.body);
            request.end();

        } catch (e) {
            reject(e);
        }
    });
};

module.exports = {
    request
};
