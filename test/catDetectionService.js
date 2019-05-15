// cat detection service
'use strict';

const chai = require('chai');
const mockery = require('mockery');
const sinonChai = require('sinon-chai');

const messages = require('../messages');
const mocks = require('./util/mocks');
const shared = require('./util/shared');

const should = chai.should(); // eslint-disable-line no-unused-vars
chai.use(sinonChai);

const CAT_CLASS = 'cat';
const NOT_CAT_CLASS = 'dog';

describe('catDetectionService', () => {
  before(() => {
    // enable mockery
    mockery.enable({
      useCleanCache: true,
      warnOnUnregistered: false
    });

    // the module under test, messages, and keymirror shouldn't be mocked
    mockery.registerAllowables(['../catDetectionService', './messages', 'keymirror']);

    mockery.registerMock('worker_threads', mocks.workerThreads);
    mockery.registerMock('./logger', mocks.logger);
    mockery.registerMock('./pubsub', mocks.pubsub);

    // get service with dependencies mocked out
    this.catDetectionService = require('../catDetectionService');
  });

  after(() => {
    // disable mockery
    mockery.deregisterAll();
    mockery.disable();
  });

  beforeEach(() => {
    // create sandbox
    shared.createSandbox.call(this);

    // startup service
    this.startup = this.catDetectionService.startup();
  });

  afterEach(() => {
    // restore sandbox
    shared.restoreSandbox.call(this);

    // reset pubsub
    mocks.pubsub.reset();
  });

  it('should notify app and exit on uncaught exception', () => {
    // should handle uncaught exception
    shared.testUncaughtExcpetion.call(this);
  });

  it('should create cat detection worker thread and tell it to initialize', () => {
    const { initializeMessage } = this.catDetectionService;

    return this.startup.then(() => {
      // should have created worker thread
      mocks.workerThreads.Worker.should.have.been.called;

      // and sent it a message to initialize
      mocks.worker.postMessage.should.have.been.calledWith({
        message: initializeMessage
      });
    });
  });

  it('should send cat detected message if it receives predictions with cat class with high probability', () => {
    const { predictionsMessage, minProbability } = this.catDetectionService;

    return this.startup.then(() => {
      // receives predictions with cat class with high probability
      mocks.worker.postMessage({
        message: predictionsMessage,
        predictions: [
          {
            className: CAT_CLASS,
            probability: minProbability
          }
        ]
      });

      // should have sent cat detected message
      mocks.pubsub.pub.should.have.been.calledWith(messages.CAT_DETECTED);
    });
  });

  it('should not send cat detected message if it receives predictions with cat class with low probability', () => {
    const { predictionsMessage, minProbability } = this.catDetectionService;

    return this.startup.then(() => {
      // receives predictions with cat class with high probability
      mocks.worker.postMessage({
        message: predictionsMessage,
        predictions: [
          {
            className: CAT_CLASS,
            probability: minProbability - 1
          }
        ]
      });

      // should not have sent cat detected message
      mocks.pubsub.pub.should.not.have.been.calledWith(messages.CAT_DETECTED);
    });
  });

  it('should not send cat detected message if it receives predictions with no cat class', () => {
    const { predictionsMessage, minProbability } = this.catDetectionService;

    return this.startup.then(() => {
      // receives predictions with cat class with high probability
      mocks.worker.postMessage({
        message: predictionsMessage,
        predictions: [
          {
            className: NOT_CAT_CLASS,
            probability: minProbability + 1
          }
        ]
      });

      // should not have sent cat detected message
      mocks.pubsub.pub.should.not.have.been.calledWith(messages.CAT_DETECTED);
    });
  });
});
