// pubsub utility for sending and listening to messages on multiple channels
// (facade around Pubnub)

'use strict';

const events = require('events');
const path = require('path');

const PubNub = require('pubnub');
const dotenv = require('dotenv');
const winston = require('winston');
const keymirror = require('keymirror');

const LOG_FILE = 'pubsub.log';
const ENV = '.env';

dotenv.config({
  path: path.resolve(process.cwd(), ENV)
});

const { PUBLISH_KEY, SUBSCRIBE_KEY, AUTHORIZATION_TOKEN } = process.env;

// init logger
const logger = new winston.Logger({
  transports: [
    new winston.transports.Console({
      handleExceptions: false
    }),
    new winston.transports.File({
      filename: LOG_FILE,
      handleExceptions: false,
      json: false
    })
  ],
  exitOnError: false
});

// init pubnub
const pubnub = new PubNub({
  publishKey: PUBLISH_KEY,
  subscribeKey: SUBSCRIBE_KEY,
  authKey: AUTHORIZATION_TOKEN,
  ssl: true
});

// message channels
const channels = Object.freeze(
  keymirror({
    MESSAGE: null,
    DEPLOY: null,
    LOG: null
  })
);

// whether each channel has been initialized
const channelInitialized = new Map();

channelInitialized.set(channels.MESSAGE, false);
channelInitialized.set(channels.DEPLOY, false);
channelInitialized.set(channels.LOG, false);

// emitter for subscribing to messages on channels
const subscribeEmitter = {
  subscribe(callback, channel) {
    this.on(channel, callback);
  },
  notify(channel, message) {
    this.emit(channel, message);
  },
  __proto__: events.EventEmitter.prototype
};

const validChannels = Object.keys(channels);

// subscribe to channel, on receiving a message notify all subscribers
function initChannel(channel) {
  return new Promise((resolve, reject) => {
    pubnub.addListener({
      message: ({ message }) => {
        subscribeEmitter.notify(channel, message);
      }
    });

    pubnub.subscribe({
      channels: [channel]
    });

    logger.info('initialized channel', channel);

    channelInitialized.set(channel, true);
    resolve();
  });
}

// publish message to channel
function publish(channel, message) {
  return new Promise((resolve, reject) => {
    // check that it's a valid channel
    /* istanbul ignore if */
    if (!validChannels.includes(channel)) {
      logger.warn('attemping to publish to an invaid channel!');
      reject();
      return;
    }

    pubnub.publish(
      {
        message,
        channel
      },
      ({ error }) => {
        /* istanbul ignore if */
        if (error) {
          reject(error);
        }
        resolve();
      }
    );
  });
}

// publish to message channel helper function
function pub(message) {
  return publish(channels.MESSAGE, message);
}

// subscribe to channel, initializing it if needed
function subscribe(channel, callback) {
  return new Promise((resolve, reject) => {
    // check that it's a valid channel
    /* istanbul ignore if */
    if (!validChannels.includes(channel)) {
      logger.warn('attemping to subscribe to an invaid channel!');
      reject();
      return;
    }

    // add callback to list of callbacks to be notified
    if (channelInitialized.get(channel)) {
      // subscribers.get(channel).push(callback);
      subscribeEmitter.on(channel, callback);
      resolve();
      return;
    }

    // initialize the channel, and then add callback
    initChannel(channel)
      .then(() => {
        subscribeEmitter.on(channel, callback);
        resolve();
      })
      .catch(
        /* istanbul ignore next */ e => {
          logger.error('an error occured initializing channel!', e);
        }
      );
  });
}

// subscribe to message channel helper function
function sub(callback) {
  return subscribe(channels.MESSAGE, callback);
}

exports.channels = channels;
exports.publish = publish;
exports.subscribe = subscribe;
exports.pub = pub;
exports.sub = sub;
