const reviews = require('./index')

const config = {
    appId: '112233445', // apple app ID
    appName: 'Test App IOS', //name of your app
    region: 'ng', // app region
    slackHook: 'https://hooks.slack.com/services/T00000000/B00000000/token', // slack webhook
    store: 'app-store', // Only apple app-store is available currently
    botUsername: 'slackBot', // name of slack app - optional
    botIcon: 'null', // url to slack app icon - optional
    channel: 'slack', // channel to send the message to - optional
    interval: 60, // fetch interval - optional
}

reviews.start(config)

