// custom winston logger with console, file, and pubnub transports!
//
// logs to the console if level is >= CONSOLE_TRANSPORT_LOG_LEVEL,
// the log if level >= FILE_TRANSPORT_LOG_LEVEL,
// and via pubnub if level >= PUBNUB_TRANSPORT_LOG_LEVEL

'use strict';

const util = require('util');

const winston = require('winston');
const pubsub = require('./pubsub');

// log levels
/* eslint-disable no-unused-vars */
const INFO = 'info';
const VERBOSE = 'verbose';
const SILLY = 'silly';
const WARN = 'warn';
const ERROR = 'error';
/* eslint-enable no-unused-vars */

const CONSOLE_TRANSPORT_LOG_LEVEL = SILLY;
const FILE_TRANSPORT_LOG_LEVEL = VERBOSE;
const PUBNUB_TRANSPORT_LOG_LEVEL = INFO;

const PUBNUB_TRANSPORT_NAME = 'pubnubTransport';
const LOG_FILE = 'robot.log';

const { channels } = pubsub;

// logger console and file transports
const logger = new winston.Logger({
  transports: [
    new winston.transports.Console({
      level: CONSOLE_TRANSPORT_LOG_LEVEL,
      handleExceptions: false
    }),
    new winston.transports.File({
      filename: LOG_FILE,
      level: FILE_TRANSPORT_LOG_LEVEL,
      handleExceptions: false,
      json: false
    })
  ],
  exitOnError: false
});

// and custom pubnub transport
// eslint-disable-next-line func-names, no-multi-assign
const pubnubTransport = (winston.transports.PubNub = function() {
  this.name = PUBNUB_TRANSPORT_NAME;
  this.level = PUBNUB_TRANSPORT_LOG_LEVEL;
});

util.inherits(pubnubTransport, winston.Transport);

// log to pubnub, appending meta object if present
// eslint-disable-next-line func-names
pubnubTransport.prototype.log = function(level, msg, meta, callback) {
  const hasMeta =
    meta != null && typeof meta === 'object' && Object.entries(meta).length > 0;
  const message = !hasMeta ? msg : /* istanbul ignore next */ `${msg} - ${meta}`;

  pubsub
    .publish(channels.LOG, message)
    .then(() => {
      callback(null, true);
    })
    .catch(
      /* istanbul ignore next */ e => {
        callback(e, false);
      }
    );
};

logger.add(winston.transports.PubNub, {});

module.exports = logger;
