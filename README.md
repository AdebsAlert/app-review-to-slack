# app-review-to-slack

[Node.js](https://nodejs.org/) library written in [TypeScript](https://www.typescriptlang.org/) for sending [App Store](https://itunes.apple.com/us/genre/ios/id36) app reviews to [Slack](https://slack.com/).

## Installation

```sh
npm install reviews-to-slack
```

## Usage

```js
var reviews = require('app-reviews-to-slack')
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
```

## start(options) -- Available options

 - `slackHook`: REQUIRED, URL to an incoming Slack webhook.
 - `appId`: REQUIRED, ID of an app in App Store or Google Play, e.g. `123456789` or `com.my.app`.
 - `region`: Two-letter country code for App Store (e.g. `us`), or two-letter language code for Google Play (e.g. `en`).
 - `interval`: How often the feed should be queried, in seconds. **Default**: `3600`
 - `debug`: Set to `true` to log debug information and send welcome message to Slack. **Default**: `false`
 - `channel`: Which channel to post to, set to override channel set in Slack.
 - `store`: To explicitly set the store, `app-store` or `google-play`. Google play implementation is still ongoing
 - `botUsername`: Set to override the default bot username set in Slack.
 - `botIcon`: Set to override the default bot icon set in Slack.
 - `appName`: Set to override the app name fetched from the reviews provider.
 - `appIcon`: Set to override the app icon fetched from the reviews provider.
 - `appLink`: Set to override the app link fetched from the reviews provider.



### More complex setup

Example that sends reviews for different appsId and to different channels. Can be extended with any combination of the options (see below).

```js
var reviews = require('app-reviews-to-slack')
// store the appIds and channels in an apps array
var apps = [
  {
    appId: '123456789',
    channel: '#channel'
  },
  {
    appId: '123456780',
    channel: '#bugs'
  }
]

//loop through each app
for (var i = 0; i < apps.length; i++) {
  var app = apps[i]
  reviews.start({
    slackHook: 'https://hooks.slack.com/services/T00000000/B00000000/token',
    appId: app.appId,
    channel: app.channel
  })
}
```

## License
[MIT](LICENSE)
