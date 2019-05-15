// shared helpers
'use strict';

const sinon = require('sinon');
const mocks = require('./mocks');
const messages = require('../../messages');

const UNCAUGHT_EXCEPTION = 'uncaughtException';
const EXIT = 'exit';

exports.testUncaughtExcpetion = function testUncaughtExcpetion() {
  // stub the process.exit
  const processExit = sinon.stub(process, EXIT);

  // save uncaughtException listeners
  const listeners = process.listeners(UNCAUGHT_EXCEPTION);

  // remove mocha listener
  process.removeListener(UNCAUGHT_EXCEPTION, listeners[0]);

  // emit uncaughtException
  process.emit(UNCAUGHT_EXCEPTION);

  // and put listeners back
  process.removeAllListeners(UNCAUGHT_EXCEPTION);
  for (const listener of listeners) {
    process.addListener(UNCAUGHT_EXCEPTION, listener);
  }

  // should have logged error, sent crashing messages
  mocks.logger.error.should.have.been.called;
  mocks.pubsub.pub.should.have.been.calledWith(messages.CRASHING);

  // and exited with failure code
  this.clock.tick(1500);
  processExit.should.have.been.calledWith(1);

  // restore process.exit
  processExit.restore();
};

exports.createSandbox = function createSandbox() {
  // create sandbox
  this.sandbox = sinon.createSandbox();

  // use fake timers
  this.clock = this.sandbox.useFakeTimers();
};

exports.restoreSandbox = function restoreSandbox() {
  // restore sandbox
  this.sandbox.restore();
};
