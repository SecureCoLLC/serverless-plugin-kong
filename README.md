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

"custom":
    "kong": {
          "admin_credentials": {
            "file": "~/.kong/credentials.json",
            "profile": "qa"
          },
          "service": {
              "name": "example-service",
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
            "method": "get"
          }
        }
      ],
    
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

sls kong create-routes --function-name example-function-1

sls kong update-route --function-name example-function-1

sls kong delete-route -s prod --function-name example-function-1

## Contributing

We welcome pull requests! Please fork the repo and submit your PR.
