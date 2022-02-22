import axios from 'axios';
const Watcher = require('rss-watcher')

const WATCHER_EVENTS = {
  'NEW_ARTICLE': 'new article',
  'ERROR': 'error'
}

const REVIEWS_STORES = {
  'APP_STORE': 'app-store',
  'GOOGLE_PLAY': 'google-play'
}

const REVIEWS_LIMIT = 50
const DEFAULT_INTERVAL_SECONDS = 3600 // pull new review every hour

var publishedReviews: any = [];

(function () {
  exports.start = function start (config: { store: string; appId: string | string[]; region: string; feed: string; interval: null; debug: any; appName: any; }) {
    if (config.debug) console.log('INFO: App has started running')
    if (!config.store) {
      // Determine from which store reviews are downloaded
      config.store = (config.appId.indexOf('.') > -1) ? REVIEWS_STORES.GOOGLE_PLAY : REVIEWS_STORES.APP_STORE
    }

    if (!config.region) {
      config.region = 'ng' // default region is Nigeria
    }

    var appInformation: any = {}

    if (config.store === REVIEWS_STORES.APP_STORE) {
      if (!config.region) {
        config.region = 'ng' // default region is Nigeria
      }

      if (!config.feed) {
        config.feed = 'https://itunes.apple.com/' + config.region + '/rss/customerreviews/id=' + config.appId + '/sortBy=mostRecent/xml'
      } else {
        console.log('INFO: You cannot set feed directly')
      }

      var watcher = new Watcher(config.feed)
      watcher.set({
        feed: config.feed,
        interval: config.interval != null ? config.interval : DEFAULT_INTERVAL_SECONDS
      })

      watcher.on(WATCHER_EVENTS.NEW_ARTICLE, function onNewArticle (item: any) {
        if (!item) {
          if (config.debug) console.log('WARNING: Received null or undefined review')
          return
        }

        if (config.debug && item) console.log('INFO: reviews have been received')

        if (isAppStoreInformationEntry(item)) {
          if (config.debug) console.log('INFO: Received new app information')
          updateAppStoreAppInformation(config, item, appInformation)
          return
        }

        var review = exports.parseAppStoreReview(item, config, appInformation)
        if (!exports.reviewPublished(review)) {
          if (config.debug) console.log('INFO: Received new review: ' + review)
          var message = exports.slackMessage(review, config, appInformation)
          exports.postToSlack(message, config)
          exports.markReviewAsPublished(config, review)
        } else if (exports.reviewPublished(config, review)) {
          if (config.debug) console.log('INFO: Review already published: ' + review.text)
        }
      })

      watcher.on(WATCHER_EVENTS.ERROR, function onError (error: string) {
        return console.error('ERROR: for new review: ' + error)
      })

      return watcher.run(function run (error: string | null, entries: string | any[] | null) {
        if (error !== null) return console.error('Watcher ERROR: Could not parse feed for ' + config.appId + ', ' + error)

        if (entries === null) return console.log('Watcher WARNING: Currently no reviews available for ' + config.appId)
        exports.resetPublishedReviews()
        // Parse existing entries for app information
        for (var i = 0; i < entries.length; i++) {
          var item = entries[i]

          var review = exports.parseAppStoreReview(item, config, appInformation)
          
          // Mark any eixsting reviews as published
          exports.markReviewAsPublished(config, review)

          updateAppStoreAppInformation(config, item, appInformation)
        }

        if (config.debug) {
          console.log('INFO: Started watching app: ' + (config.appName ? config.appName : appInformation.appName))
          var welcome = welcomeMessage(config, appInformation)
          exports.postToSlack(welcome, config)
        }
      })
    } else {
      exports.setupGooglePlayAppInformation(config, appInformation, function () {
        exports.fetchGooglePlayReviews(config, appInformation, function (initialReviews: string | any[]) {
          for (var i = 0; i < initialReviews.length; i++) {
            var initialReview = initialReviews[i]
            exports.markReviewAsPublished(config, initialReview)
          }

          var intervalSeconds = config.interval ? config.interval : DEFAULT_INTERVAL_SECONDS

          setInterval(function (config, appInformation) {
            if (config.debug) console.log('INFO: [' + config.appId + '] Fetching Google Play reviews')

            exports.fetchGooglePlayReviews(config, appInformation, function (reviews: any) {
              exports.handleFetchedGooglePlayReviews(config, appInformation, reviews)
            })
          }, intervalSeconds * 1000, config, appInformation)

          if (config.debug) {
            console.log('INFO: [' + config.appId + '] Started watching app: ' + (config.appName ? config.appName : appInformation.appName))
            var welcome = welcomeMessage(config, appInformation)
            exports.postToSlack(welcome, config)
          }
        })
      })
    }
  }
}).call(this)

exports.markReviewAsPublished = function (_config: any, review: { id: any; }) {
  if (!review || !review.id || this.reviewPublished(review)) return

  if (publishedReviews.count >= REVIEWS_LIMIT) {
    publishedReviews.pop(publishedReviews.count - (REVIEWS_LIMIT + 1))
  }
  publishedReviews.unshift(review.id)
}

exports.reviewPublished = function (review: { id: any; }) {
  if (!review || !review.id) return false
  return publishedReviews.indexOf(review.id) >= 0
}

exports.publishedReviews = function () {
  return publishedReviews
}

exports.resetPublishedReviews = function () {
  publishedReviews = []
}

// App Store

var isAppStoreInformationEntry = function (entry: { [x: string]: any; } | null) {
    // App Store app information is available in an entry with some special fields
  return entry != null && entry['im:name']
}

var updateAppStoreAppInformation = function (config: { store?: string; appId?: string | string[]; region?: string; feed?: string; interval?: null; debug: any; appName: any; appIcon?: any; appLink?: any; }, entry: { [x: string]: any; } | null, appInformation: { appName: string; appIcon: string; appLink: string; }) {
  if (!isAppStoreInformationEntry(entry)) return

  if (config.appName == null && entry!['im:name'] != null) {
    appInformation.appName = entry!['im:name']['#']
    if (config.debug) console.log('INFO: Found app name: ' + appInformation.appName)
  }

  if (config.appIcon == null && entry!['im:image'] && entry!['im:image'].length > 0) {
    appInformation.appIcon = entry!['im:image'][0]['#']
    if (config.debug) console.log('INFO: Found app icon: ' + appInformation.appIcon)
  }

  if (config.appLink == null && entry!['link']) {
    appInformation.appLink = entry!.meta.link
    if (config.debug) console.log('INFO: Found app link: ' + appInformation.appLink)
  }
}

exports.parseAppStoreReview = function (rssItem: { [x: string]: any; title: any; description: any; author: any; }, config: { appLink: any; }) {
  var review: any = {}

  review.id = rssItem.guid
  review.title = rssItem.title
  review.text = rssItem.description
  review.rating = reviewRating(rssItem, config)
  review.date = reviewDate(rssItem, config)
  review.author = rssItem.author
  review.link = rssItem.meta.link
  review.storeName = 'App Store'

  return review
}

// Slack

exports.slackMessage = function (review: { title: string; rating: number; text: string; author: string; date: string; link: string; storeName: string; }, config: { debug: any; appName: null; botUsername: any; botIcon: any; channel: any; appIcon: any; }, appInformation: { appName: null; appIcon: any; }) {
  if (config.debug) console.log('INFO: Creating message for review ' + review.title)

  var stars = ''
  for (var i = 0; i < 5; i++) {
    stars += i < review.rating ? '★' : '☆'
  }

  var pretext = 'New review'
  if (config.appName != null || appInformation.appName != null) {
    pretext += ' for ' + (config.appName ? config.appName : appInformation.appName)
  }
  pretext += '!'

  var color = review.rating >= 4 ? 'good' : (review.rating >= 2 ? 'warning' : 'danger')

  var text = ''
  text += review.text + '\n'
  text += '_by ' + review.author
  if (review.date) {
    text += ', ' + review.date
  }
  if (review.link) {
    text += ' - ' + '<' + review.link + '|' + review.storeName + '>'
  } else {
    text += ' - ' + review.storeName
  }
  text += '_'

  var message = {
    'username': config.botUsername,
    'icon_url': config.botIcon,
    'channel': config.channel,
    'attachments': [
      {
        'mrkdwn_in': ['text', 'pretext', 'title'],
        'fallback': pretext + ': ' + review.title + ' (' + stars + '): ' + review.text,

        'pretext': pretext,
        'color': color,

        'author_name': stars,
        'author_icon': config.appIcon ? config.appIcon : appInformation.appIcon,

        'title': review.title,
        'title_link': review.link,

        'text': text
      }
    ]
  }

  return message
}

var welcomeMessage = function (config: { store: any; appId: any; region?: string; feed?: string; interval?: null; debug?: any; appName: any; botUsername?: any; botIcon?: any; channel?: any; appIcon?: any; }, appInformation: { appName: any; appIcon: any; }) {
  var storeName = config.store === REVIEWS_STORES.APP_STORE ? 'App Store' : 'Google Play'
  var appName = config.appName ? config.appName : (appInformation.appName ? appInformation.appName : config.appId)
  return {
    'username': config.botUsername,
    'icon_url': config.botIcon,
    'channel': config.channel,
    'attachments': [
      {
        'mrkdwn_in': ['pretext', 'author_name'],
        'fallback': 'This channel will now receive ' + storeName + ' reviews for ' + appName,
        'pretext': 'This channel will now receive ' + storeName + ' reviews for ',
        'author_name': appName,
        'author_icon': config.appIcon ? config.appIcon : appInformation.appIcon
      }
    ]
  }
}

var reviewRating = function (review: { [x: string]: any; title: any; description?: any; author?: any; }, config: { appLink?: any; store?: any; }) {
  if (config.store === REVIEWS_STORES.APP_STORE) {
    return review['im:rating'] != null && !isNaN(review['im:rating']['#']) ? parseInt(review['im:rating']['#']) : -1
  } else if (config.store === REVIEWS_STORES.GOOGLE_PLAY) {
    var rating = review.title.substr(0, 1)
    return rating != null && !isNaN(rating) ? parseInt(rating) : -1
  } else {
    return -1
  }
}

var reviewDate = function (review: { [x: string]: any; title?: any; description?: any; author?: any; date?: any; }, config: { appLink?: any; store?: any; }) {
  if (config.store === REVIEWS_STORES.APP_STORE) {
    return review.date.toISOString().replace('T', ' ').substr(0, 16)
  } else if (config.store === REVIEWS_STORES.GOOGLE_PLAY) {
    return undefined // Google Play review RSS dates are often unreliable (current date instead of review date)
  } else {
    return undefined
  }
}

exports.postToSlack = async function (message: any, config: { debug: any; slackHook: any; }) {
  var messageJSON = JSON.stringify(message)
  if (config.debug) console.log('INFO: Posting new message to Slack: ' + messageJSON)
 return axios.post(config.slackHook, messageJSON,
    {
        headers: {
            'Content-Type': 'application/json'
        }
    }
  )
}
