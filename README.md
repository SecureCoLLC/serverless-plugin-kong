# serverless-plugin-kong

[Serverless framework](https://www.serverless.com) Plugin to register lambda functions with Kong

## Installation

Install the plugin from npm

```bash
$ npm install --save-dev serverless-plugin-kong
```

Without npm

Copy the source to the .serverless_plugins directory at the root of your service(serverless project)

## Usage

Add the plugin to your `serverless.yml`

```yaml
# serverless.yml

plugins:
  - serverless-plugin-kong
```

Add the config to your custom tag of serverless.yml,

```
# serverless.yml

"custom":
    "kong": {
          "admin_credentials": {
            "file": "~/.kong/credentials.json",
            "profile": "qa"
          },
          "service": {
              "name": "example-service",
              "host": { qa: 'qa.example.com', 'prod': 'prod.example.com' }[stage],
              "plugins": [
                  {
                      "name": "cors",
                      "config": {
                          "origins": "*",
                          "methods": "GET, POST",
                          "headers": "Accept, Authorization, Accept-Version, Content-Length, Content-Type, Date, X-Auth-Token",
                          "exposed_headers": "X-Auth-Token",
                          "credentials": true,
                          "max_age": 3600
                      }
                  }
              ]
          }
      }
"functions": {
    "example-function-1": {
      "handler": "functions/example/function1.entry",
      "events": [
        {
          "kong": {
            "service": "test-service",
            "path": "/news",
            "method": "get",
            "plugins": [
                {
                    "name": "lambda-proxy",
                    "config": {
                        "aws_region": "us-east-1",
                        "function_name": "upload-service-qa-upload",
                        "forward_request_body": true,
                        "forward_request_headers": true,
                        "forward_request_method": true,
                        "forward_request_uri": true,
                        "keepalive": 0
                    }
                }
            ]
          }
        }
      ],
    
```
If you are using "lambda-meta" to configure events, you can configure kong routes as given below

```
const lm = require('lambda-meta');
const iopipe = require('@iopipe/iopipe')({ token: process.env.IOPIPE_TOKEN });

module.exports = {
    name: 'example-service',
    description: 'Example service',
    timeout: 3,
    warmup: true,
    responseHeaders: {
        'Cache-Control': 'public, max-age=10',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': '*'
    },
    kong: {
        service: 'example-service',
        path: '/users'
        method: 'post',
        plugins: [
            {
                name: 'lambda-proxy',
                config: {
                    aws_region: 'us-east-1',
                    function_name: 'upload-service-qa-upload',
                    forward_request_body: true,
                    forward_request_headers: true,
                    forward_request_method: true,
                    forward_request_uri: true,
                    keepalive: 0
                }
            }
        ]
    },

    inputs: {
        apiKey: {
            required: true,
            type: 'String'
        }
    },

    entry: iopipe((event, context, callback) => lm.processRequest(module.exports, event, context, callback)),

    process: async (event, context) => {
        const { apiKey } = context.params;

        return true;
    }
};

Note: The lambda-proxy is a kong plugin, you can install it from this repo "http://gitlab.paltalk.com/webng/lambda-proxy"

```


~/.kong/credentials.json

{
  "default": { 
    "url": "http://localhost:8001",
    "headers": {}
  },
  "qa": {
   "url": "http://localhost:8001"
  }
}


Command to register lambda functions

sls kong create-service 

sls kong update-service

sls kong create-routes --function-name example-function-1

sls kong update-route --function-name example-function-1

sls kong delete-route -s prod --function-name example-function-1

## Contributing

We welcome pull requests! Please fork the repo and submit your PR.
