// led service tests
'use strict';

const chai = require('chai');
const mockery = require('mockery');
const sinonChai = require('sinon-chai');

const messages = require('../messages');
const mocks = require('./util/mocks');
const shared = require('./util/shared');

const should = chai.should(); // eslint-disable-line no-unused-vars
chai.use(sinonChai);

describe('ledService', () => {
  before(() => {
    // enable mockery
    mockery.enable({
      useCleanCache: true,
      warnOnUnregistered: false
    });

    // the module under test, messages, and keymirror shouldn't be mocked
    mockery.registerAllowables(['../ledService', './messages', 'keymirror']);

    mockery.registerMock('johnny-five', mocks.johnnyFive);
    mockery.registerMock('lodash', mocks.lodash);
    mockery.registerMock('./logger', mocks.logger);
    mockery.registerMock('./pubsub', mocks.pubsub);
    mockery.registerMock('./boardService', mocks.boardService);

    // get service with dependencies mocked out
    this.ledService = require('../ledService');
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
    this.startup = this.ledService.startup();
  });

  afterEach(() => {
    // restore sandbox
    shared.restoreSandbox.call(this);

    // reset pubsub
    mocks.pubsub.reset();

    // reset led objects
    mocks.johnnyFive.Led.resetHistory();

    mocks.successLed.blink.resetHistory();
    mocks.successLed.stop.resetHistory();

    mocks.errorLed.blink.resetHistory();
    mocks.errorLed.on.resetHistory();

    mocks.successLedStopOn.resetHistory();
    mocks.successLedStopOff.resetHistory();

    mocks.errorLedStopOn.resetHistory();
    mocks.errorLedStopOff.resetHistory();
  });

  it('should notify app and exit on uncaught exception', () => {
    // should handle uncaught exception
    shared.testUncaughtExcpetion.call(this);
  });

  it('should init two leds', () => {
    return this.startup.then(() => {
      // should create two Leds
      mocks.johnnyFive.Led.should.have.been.calledTwice;
    });
  });

  it('should blink success led when indicateStartupSuccess is called', () => {
    return this.startup
      .then(() => {
        // call indicateStartupSuccess
        const indicateStartupSuccess = this.ledService.indicateStartupSuccess();

        this.clock.tick(this.ledService.startupLedDelay);
        return indicateStartupSuccess;
      })
      .then(() => {
        // successs led should start blinking
        mocks.successLed.blink.should.have.been.called;

        // and then stop blinking and remain on
        mocks.successLed.stop.should.have.been.called;
        mocks.successLedStopOn.should.have.been.called;
      });
  });

  it('should blink success led when cat is detected', () => {
    return this.startup
      .then(() => {
        // send cat detected message
        return mocks.pubsub.pub(messages.CAT_DETECTED);
      })
      .then(() => {
        // and blink success led
        mocks.successLed.blink.should.have.been.called;

        // and then stop blinking
        this.clock.tick(this.ledService.catDetectedLedDelay);
        mocks.successLed.stop.should.have.been.called;
      });
  });

  it('should blink error led if robot is in error state', () => {
    return this.startup
      .then(() => {
        // send error state message
        return mocks.pubsub.pub(messages.ERROR_STATE);
      })
      .then(() => {
        // should turn off success led
        mocks.successLed.stop.should.have.been.called;
        mocks.successLedStopOff.should.have.been.called;

        // and blink error led
        mocks.errorLed.blink.should.have.been.called;
      });
  });

  it('should turn on error led if robot is crashing', () => {
    return this.startup
      .then(() => {
        // send crashing message
        return mocks.pubsub.pub(messages.CRASHING);
      })
      .then(() => {
        // should turn off success led
        mocks.successLed.stop.should.have.been.called;
        mocks.successLedStopOff.should.have.been.called;

        // and blink error led
        mocks.errorLed.on.should.have.been.called;
      });
  });

  it('should turn off all leds if robot is shutting down', () => {
    return this.startup
      .then(() => {
        // send shutting down message
        return mocks.pubsub.pub(messages.SHUTTING_DOWN);
      })
      .then(() => {
        // should stop leds
        mocks.successLed.stop.should.have.been.called;
        mocks.errorLed.stop.should.have.been.called;

        // and turn them off
        mocks.successLedStopOff.should.have.been.called;
        mocks.errorLedStopOff.should.have.been.called;
      });
  });
});
