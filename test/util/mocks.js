// mock objects
/* eslint-disable func-names */
'use strict';

const events = require('events');
const sinon = require('sinon');
const _ = require('lodash');

const MESSAGE_CHANNEL = 'MESSAGE';
const LOG_CHANNEL = 'LOG';
const DEPLOY_CHANNEL = 'DEPLOY';

const MESSAGE_EVENT = 'message';
const DATA_EVENT = 'data';

// logger
const logger = {
  info: sinon.spy(),
  verbose: sinon.spy(),
  silly: sinon.spy(),
  warn: sinon.spy(),
  error: sinon.spy()
};

// pubsub
const pubsub = {
  pub: sinon.spy(function(message) {
    this.emit(MESSAGE_CHANNEL, message);
    return Promise.resolve();
  }),
  sub: sinon.spy(function(callback) {
    this.on(MESSAGE_CHANNEL, callback);
    return Promise.resolve();
  }),
  publish: sinon.spy(() => Promise.resolve()),
  channels: {
    MESSAGE: MESSAGE_CHANNEL,
    DEPLOY: DEPLOY_CHANNEL,
    LOG: LOG_CHANNEL
  },
  reset() {
    this.pub.resetHistory();
    this.sub.resetHistory();
    this.publish.resetHistory();
    this.removeAllListeners(MESSAGE_CHANNEL);
  },
  __proto__: events.EventEmitter.prototype
};

// board service
const boardService = {
  startup: sinon.spy(() => Promise.resolve()),
  digitalRead: sinon.spy(),
  digitalWrite: sinon.spy(),
  analogRead: sinon.spy(),
  analogWrite: sinon.spy(),
  pins: {
    PIN_0: 0,
    PIN_1: 1,
    PIN_2: 2,
    PIN_3: 3,
    PIN_4: 4,
    PIN_5: 5,
    PIN_6: 6,
    PIN_7: 7,
    PIN_8: 8,
    PIN_9: 9,
    PIN_10: 10,
    PIN_11: 11,
    PIN_12: 12,
    PIN_13: 13,
    PIN_A0: 'A0',
    PIN_A1: 'A1',
    PIN_A2: 'A2',
    PIN_A3: 'A3',
    PIN_A4: 'A4',
    PIN_A5: 'A5'
  }
};

// led service
const ledService = {
  startup: sinon.spy(() => Promise.resolve()),
  indicateStartupSuccess: sinon.spy(() => Promise.resolve()),
  indicateError: sinon.spy(),
  turnOffAllLeds: sinon.spy()
};

// navigation service
const navigationService = {
  startup: sinon.spy(() => Promise.resolve()),
  moveForward: sinon.spy(),
  moveBackward: sinon.spy(),
  stop: sinon.spy(),
  turnRight: sinon.spy(),
  turnLeft: sinon.spy()
};

// connection service
const connectionService = {
  startup: sinon.spy(() => Promise.resolve())
};

// lodash
sinon.stub(_, 'random').callsFake(max => max);
const lodash = _;

// johnny-five board
const board = {
  digitalRead: sinon.spy(),
  digitalWrite: sinon.spy(),
  analogRead: sinon.spy(),
  analogWrite: sinon.spy(),
  __proto__: events.EventEmitter.prototype
};

// sucess led
const successLedStopOn = sinon.spy();
const successLedStopOff = sinon.spy();

const successLed = {
  blink: sinon.spy(),
  stop: sinon.stub().returns({
    on: successLedStopOn,
    off: successLedStopOff
  })
};

// error led
const errorLedStopOn = sinon.spy();
const errorLedStopOff = sinon.spy();

const errorLed = {
  blink: sinon.spy(),
  on: sinon.spy(),
  stop: sinon.stub().returns({
    on: errorLedStopOn,
    off: errorLedStopOff
  })
};

// left wheel
const leftWheel = {
  stop: sinon.spy(),
  cw: sinon.spy(),
  ccw: sinon.spy(),
  reset() {
    this.stop.resetHistory();
    this.cw.resetHistory();
    this.ccw.resetHistory();
  }
};

// right wheel
const rightWheel = {
  stop: sinon.spy(),
  cw: sinon.spy(),
  ccw: sinon.spy(),
  reset() {
    this.stop.resetHistory();
    this.cw.resetHistory();
    this.ccw.resetHistory();
  }
};

// proximity sensor
const proximitySensor = {
  read(proximity) {
    this.cm = proximity;
    this.emit(DATA_EVENT);
  },
  reset() {
    this.removeAllListeners(DATA_EVENT);
  },
  __proto__: events.EventEmitter.prototype
};

// johnny-five
const johnnyFive = {
  Board: sinon.stub().returns(board),
  Led: sinon.spy(pin => {
    return pin === 2 ? successLed : errorLed;
  }),
  Servo: {
    Continuous: sinon.spy(options => {
      return options.pin === 5 ? leftWheel : rightWheel;
    })
  },
  Proximity: sinon.stub().returns(proximitySensor)
};

// path
const path = {
  resolve: sinon.stub()
};

// util
const util = {
  inherits: sinon.spy()
};

// dotenv
const dotenv = {
  config: sinon.spy()
};

// winston
const loggerAdd = sinon.spy();

const winston = {
  Logger: sinon.stub().returns({
    add: loggerAdd
  }),
  add: sinon.spy(),
  error: sinon.spy(),
  transports: {
    Console: sinon.spy(),
    File: sinon.spy()
  },
  Transport: {},
  reset() {
    this.Logger.reset();
    this.add.resetHistory();
    this.error.resetHistory();
    this.transports.Console.resetHistory();
    this.transports.File.resetHistory();
    loggerAdd.resetHistory();
  }
};

// winston default logger
const winstonDefault = {
  Logger: sinon.stub().returns({
    info: sinon.spy(),
    verbose: sinon.spy(),
    silly: sinon.spy(),
    warn: sinon.spy(),
    error: sinon.spy()
  }),
  transports: {
    Console: sinon.spy(),
    File: sinon.spy()
  }
};

// pubnub
const pubnubEmitter = {
  __proto__: events.EventEmitter.prototype
};

const pubnubPublish = sinon.spy(({ message, channel }, callback) => {
  pubnubEmitter.emit(channel, { message });
  callback({});
  return Promise.resolve();
});

const pubnubSubscribe = sinon.spy(() => {
  return Promise.resolve();
});

const pubnubAddListener = sinon.spy(({ message, channel = MESSAGE_CHANNEL }) => {
  pubnubEmitter.on(channel, message);
  return Promise.resolve();
});

const pubnub = sinon.stub().returns({
  publish: pubnubPublish,
  subscribe: pubnubSubscribe,
  addListener: pubnubAddListener
});

pubnub.reset = function() {
  pubnub.resetHistory();

  pubnubPublish.resetHistory();
  pubnubSubscribe.resetHistory();

  pubnubEmitter.removeAllListeners(MESSAGE_CHANNEL);
  pubnubEmitter.removeAllListeners(LOG_CHANNEL);
  pubnubEmitter.removeAllListeners(DEPLOY_CHANNEL);
};

const worker = {
  postMessage: sinon.spy(function(message) {
    this.emit(MESSAGE_EVENT, message);
  }),
  __proto__: events.EventEmitter.prototype
};

const workerThreads = {
  Worker: sinon.stub().returns(worker)
};

const token = 'cat';

const authToken = {
  token,
  generateToken: sinon.spy(() => Promise.resolve(token))
};

module.exports = {
  logger,
  pubsub,
  boardService,
  ledService,
  navigationService,
  connectionService,
  lodash,
  johnnyFive,
  board,
  successLed,
  errorLed,
  successLedStopOn,
  successLedStopOff,
  errorLedStopOn,
  errorLedStopOff,
  leftWheel,
  rightWheel,
  proximitySensor,
  path,
  dotenv,
  util,
  winston,
  winstonDefault,
  authToken,
  pubnub,
  workerThreads,
  worker
};
