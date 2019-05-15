// board service tests
'use strict';

const chai = require('chai');
const mockery = require('mockery');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');

const messages = require('../messages');
const mocks = require('./util/mocks');
const shared = require('./util/shared');

const should = chai.should(); // eslint-disable-line no-unused-vars
chai.use(sinonChai);

describe('boardService', () => {
  before(() => {
    // enable mockery
    mockery.enable({
      useCleanCache: true,
      warnOnUnregistered: false
    });

    // the module under test, messages, and keymirror shouldn't be mocked
    mockery.registerAllowables(['../boardService', './messages', 'keymirror']);

    mockery.registerMock('johnny-five', mocks.johnnyFive);
    mockery.registerMock('./logger', mocks.logger);
    mockery.registerMock('./pubsub', mocks.pubsub);

    // get service with dependencies mocked out
    this.boardService = require('../boardService');
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
    this.startup = this.boardService.startup();

    // emit board ready event
    mocks.board.emit('ready');
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

  it('should init johnny-five board and send board ready message', () => {
    return this.startup.then(() => {
      // should have created johnny-five Board
      mocks.johnnyFive.Board.should.have.been.called;

      // and sent board ready message
      return mocks.pubsub.pub.should.have.been.calledWith(messages.BOARD_READY);
    });
  });

  it('should allow registering a callback for reading value of a digital pin', () => {
    const pin = 0;
    const callback = sinon.spy();

    return this.startup.then(() => {
      // call digitalRead
      this.boardService.digitalRead(pin, callback);

      // should pass pin and callback to johnny-five's Board.digitalRead
      mocks.board.digitalRead.should.have.been.calledWith(pin, callback);
    });
  });

  it('should allow writing a value to a digital pin', () => {
    const pin = 0;
    const value = 42;

    return this.startup.then(() => {
      // call digitalWrite
      this.boardService.digitalWrite(pin, value);

      // should pass pin and value to johnny-five's Board.digitalWrite
      mocks.board.digitalWrite.should.have.been.calledWith(pin, value);
    });
  });

  it('should allow registering a callback for reading value of an analog pin', () => {
    const pin = 'A0';
    const callback = sinon.spy();

    return this.startup.then(() => {
      // call analogRead
      this.boardService.analogRead(pin, callback);

      // should pass pin and callback to johnny-five's Board.analogRead
      mocks.board.analogRead.should.have.been.calledWith(pin, callback);
    });
  });

  it('should allow writing a value to an analog pin', () => {
    const pin = 'A0';
    const value = 42;

    return this.startup.then(() => {
      // call analogWrite
      this.boardService.analogWrite(pin, value);

      // should pass pin and value to johnny-five's Board.analogWrite
      mocks.board.analogWrite.should.have.been.calledWith(pin, value);
    });
  });
});
