module.exports = {
    kongAdminApiCredentials: {
        fileName: 'credentials.json',
        defaultPaths: ['./.kong', '~/.kong', './test/data/.kong'],
        profile: 'default'
    },
    // Here upstream service is our lambda function, that's we just set the dummy upstream url 'http://127.0.0.1:80/'
    upstreamUrl: 'http://127.0.0.1:80/'
};
