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
            adminApiUrl: 'http://localhost:8001',
            services: [
                {
                    name: `example-service-${stage}`,
                    host: 'http://mockbin.org/',
                    plugins: [
                        {
                            name: 'cors',
                            config: {
                                origins: '*',
                                methods: 'GET, POST',
                                headers: 'Accept, Authorization, Accept-Version, Content-Length, Content-Type, Date, X-Auth-Token',
                                exposed_headers: 'X-Auth-Token',
                                credentials: true,
                                max_age: 3600
                            }
                        }
                    ],
                    routes: [
                        {
                            config: {
                                preserve_host: true,
                                hosts: [`${stage}.example.com`],
                                paths: ['/users'],
                                methods: ['GET']
                            },
                            plugins: [
                                {
                                    name: 'aws-lambda',
                                    config: {
                                        aws_region: 'us-east-1',
                                        aws_key: 'AWS_ACCESS_KEY_ID',
                                        aws_secret: 'AWS_SECRET_ACCESS_KEY',
                                        function_name: `example-user-service-${stage}`
                                    }
                                }
                            ]
                        },
                        {
                            config: {
                                preserve_host: true,
                                hosts: [`${stage}.example.com`],
                                paths: ['/products']
                            },
                            plugins: [
                                {
                                    name: 'aws-lambda',
                                    config: {
                                        aws_region: 'us-east-1',
                                        aws_key: 'AWS_ACCESS_KEY_ID',
                                        aws_secret: 'AWS_SECRET_ACCESS_KEY',
                                        function_name: `example-product-service-${stage}`
                                    }
                                }
                            ]
                        }
                    ]
                }
            ]
        }
```

Command to register lambda functions

sls kong register-services -s prod

sls kong register-services -s dev

 sls kong register-services -n example-service

sls kong update-service -s prod -n example-service

sls kong remove-service -s prod -n example-service

## Contributing

We welcome pull requests! Please fork the repo and submit your PR.
