// connection service
'use strict';

const path = require('path');
const dotenv = require('dotenv');
const _ = require('lodash');

const pubsub = require('./pubsub');
const logger = require('./logger');
const messages = require('./messages');

const { generateToken } = require('./utils/authToken');

const UNCAUGHT_EXCEPTION = 'uncaughtException';
const ENV = '.env';

const ERROR_EXIT_DELAY = 1500;
const HEARTBEAT_MAX_INTERVAL = 30000;
const AUTH_TOKEN_TTL = 30;

process.on(UNCAUGHT_EXCEPTION, handleUncaughException);

dotenv.config({
  path: path.resolve(process.cwd(), ENV)
});

// publish error messages and shut down
function handleUncaughException(e) {
  logger.error('connection service uncaughtException occured!', e);

  pubsub.pub(messages.CRASHING);

  const timer = setTimeout(() => {
    process.exit(1);
  }, ERROR_EXIT_DELAY);
  timer.unref();
}

let activeConnectionId = null;
let timeLastHeartBeat = null;

// handle client connection request
function handleConnectionRequrest(connectionId) {
  logger.info('received remote connection request');

  // check if robot already has a (recent) active connection
  if (
    activeConnectionId &&
    (timeLastHeartBeat == null || _.now() - timeLastHeartBeat < HEARTBEAT_MAX_INTERVAL)
  ) {
    logger.warn('already has active connection');
    pubsub.pub({
      [messages.CONFLICT]: connectionId
    });
    return;
  }

  // if not, generate auth token and accept connection request
  logger.info('accepting remote connection');

  generateToken(AUTH_TOKEN_TTL)
    .then(token => {
      activeConnectionId = connectionId;
      pubsub.pub({
        [messages.CONNECTED]: connectionId,
        token
      });
    })
    .catch(
      /* istanbul ignore next */ e => {
        logger.error('error ocurred accepting connection request!', e);
        pubsub.pub(messages.ERROR);
      }
    );
}

// handle heartbeat
function handleHeartbeat(connectionId) {
  if (activeConnectionId !== connectionId) {
    logger.warn('received unauthorized heartbeat');
    pubsub.pub({
      [messages.INVALID]: connectionId
    });
    return;
  }

  // respond that received heartbeat
  logger.silly('received connection heartbeat');
  timeLastHeartBeat = _.now();

  pubsub.pub({
    [messages.CONNECTION_OK]: connectionId
  });
}

// handle right turn request
function handleRightTurnRequest(connectionId) {
  if (activeConnectionId !== connectionId) {
    logger.warn('received unauthorized right turn request');
    pubsub.pub({
      [messages.INVALID]: connectionId
    });
    return;
  }

  logger.info('received right turn request');
  // attempt to turn right
  pubsub.pub(messages.TURN_RIGHT);
}

// handle left turn request
function handleLeftTurnRequest(connectionId) {
  if (activeConnectionId !== connectionId) {
    logger.warn('received unauthorized left turn request');
    pubsub.pub({
      [messages.INVALID]: connectionId
    });
    return;
  }

  logger.info('received left turn request');
  // attempt to turn left
  pubsub.pub(messages.TURN_LEFT);
}

// handle connection and navigation requests
function startup() {
  return new Promise((resolve, reject) => {
    /* eslint-disable eqeqeq */
    pubsub
      .sub(message => {
        // inform client problem on robot or shutting down
        if (
          message == messages.SHUTTING_DOWN ||
          message == messages.CRASHING ||
          message == messages.ERROR_STATE
        ) {
          pubsub.pub(messages.ERROR);
          return;
        }

        // request to connect
        if (message[messages.CONNECTION_REQUEST]) {
          handleConnectionRequrest(message[messages.CONNECTION_REQUEST]);
          return;
        }

        // heartbeat
        if (message[messages.CONNECTION_TEST]) {
          handleHeartbeat(message[messages.CONNECTION_TEST]);
          return;
        }

        // request to turn right
        if (message[messages.RIGHT_TURN_REQUEST]) {
          handleRightTurnRequest(message[messages.RIGHT_TURN_REQUEST]);
          return;
        }

        // request to turn left
        if (message[messages.LEFT_TURN_REQUEST]) {
          handleLeftTurnRequest(message[messages.LEFT_TURN_REQUEST]);
        }
      })
      .then(() => {
        resolve();
      })
      .catch(
        /* istanbul ignore next */ e => {
          logger.warn('an error occurred subscribing to remote connection messages:', e);
          pubsub.pub(messages.ERROR_STATE);
          reject(e);
        }
      );
    /* eslint-enable eqeqeq */
  });
}

exports.startup = startup;
exports.heartbeatMaxInterval = HEARTBEAT_MAX_INTERVAL;
