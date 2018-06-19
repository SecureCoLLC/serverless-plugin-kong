# serverless-plugin-kong

[Serverless framework](https://www.serverless.com) Plugin to register lambda functions with Kong

## Installation

Install the plugin from npm

```bash
$ npm install --save serverless-plugin-kong
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

```yaml
# serverless.yml

custom:
    kong: {
           adminApiCredentials: {
               url: 'http://localhost:8001',
               headers: {}
           }
       }
custom: {
 kong: {
    adminApiCredentials: {
       url: 'http://localhost:8001',
       headers: {}
    }
 }
},
"functions": {
    "example-function-1": {
      "handler": "functions/example/function1.entry",
      "events": [
        {
          "kong": {
            "service": "test-service",
            "path": "/news",
            "method": "get"
          }
        }
      ],
    
```

Command to register lambda functions

sls kong create-routes --function-name example-function-1

sls kong update-route --function-name example-function-1

sls kong delete-route -s prod --function-name example-function-1

## Contributing

We welcome pull requests! Please fork the repo and submit your PR.
