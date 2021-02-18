export default {
    // Token Implicit Grant Client ID
    clientID: process.env.CLIENT_ID,

    redirectUri: 'https://localhost/',

    genesysCloud: {
        // Genesys Cloud region
        // eg. 'mypurecloud.ie', 'euw2.pure.cloud', etc...
        region: 'mypurecloud.com'
    },

    translateServiceURI: 'https://localhost/translate'
}