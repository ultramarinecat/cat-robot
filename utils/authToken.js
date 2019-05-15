// generate, revoke pubnub auth token
'use strict';

const crypto = require('crypto');

const path = require('path');
const PubNub = require('pubnub');
const dotenv = require('dotenv');

const MESSAGE_CHANNEL = 'MESSAGE';
const LOG_CHANNEL = 'LOG';
const DEPLOY_CHANNEL = 'DEPLOY';

const ENV = '../.env';

dotenv.config({
  path: path.resolve(process.cwd(), ENV)
});

const { PUBLISH_KEY, SUBSCRIBE_KEY, SECRET_KEY } = process.env;

const pubnub = new PubNub({
  publishKey: PUBLISH_KEY,
  subscribeKey: SUBSCRIBE_KEY,
  secretKey: SECRET_KEY,
  ssl: true
});

const channels = [MESSAGE_CHANNEL, LOG_CHANNEL, DEPLOY_CHANNEL];

function generateToken(ttl) {
  return new Promise((resolve, reject) => {
    const token = crypto.randomBytes(3).toString('hex');

    pubnub.grant(
      {
        authKeys: [token],
        read: true,
        write: true,
        channels,
        ttl
      },
      ({ error }) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(token);
      }
    );
  });
}

function revokeToken(token) {
  return new Promise((resolve, reject) => {
    pubnub.grant(
      {
        authKeys: [token],
        read: false,
        write: false,
        manage: false,
        channels
      },
      ({ error }) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      }
    );
  });
}

exports.generateToken = generateToken;
exports.revokeToken = revokeToken;
