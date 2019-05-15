// pubsub tests
'use strict';

const chai = require('chai');
const mockery = require('mockery');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');

const mocks = require('./util/mocks');
const shared = require('./util/shared');

const should = chai.should(); // eslint-disable-line no-unused-vars
chai.use(sinonChai);

const MESSAGE_CHANNEL = 'MESSAGE';
const LOG_CHANNEL = 'LOG';
const DEPLOY_CHANNEL = 'DEPLOY';

describe('pubsub', () => {
  before(() => {
    // enable mockery
    mockery.enable({
      useCleanCache: true,
      warnOnUnregistered: false
    });

    // the module under test shouldn't be mocked
    mockery.registerAllowables(['../pubsub']);

    mockery.registerMock('pubnub', mocks.pubnub);
    mockery.registerMock('dotenv', mocks.dotenv);
    mockery.registerMock('winston', mocks.winstonDefault);
    mockery.registerMock('path', mocks.path);
  });

  after(() => {
    // disable mockery
    mockery.deregisterAll();
    mockery.disable();
  });

  beforeEach(() => {
    // create sandbox
    shared.createSandbox.call(this);
  });

  afterEach(() => {
    // restore sandbox
    shared.restoreSandbox.call(this);

    // reset winston and pubnub objects
    mocks.winston.reset();
    // mocks.pubnub.reset();

    // reset mockery cache
    mockery.resetCache();
  });

  it('should export message, log, and deploy channels', () => {
    // get pubsub
    const pubsub = require('../pubsub');

    // should export message, log, and deploy channels
    pubsub.channels.MESSAGE.should.equal(MESSAGE_CHANNEL);
    pubsub.channels.LOG.should.equal(LOG_CHANNEL);
    pubsub.channels.DEPLOY.should.equal(DEPLOY_CHANNEL);
  });

  it('should have publish method for publishing a message to a channel', () => {
    // get pubsub
    const pubsub = require('../pubsub');

    const channel = MESSAGE_CHANNEL;
    const message = 'a message';

    // publish message
    pubsub.publish(channel, message).then(() => {
      // should have published message on PubNub
      const pubnubPublish = mocks.pubnub.returnValues[0].publish;
      pubnubPublish.should.have.been.called;
      pubnubPublish.getCall(0).args[0].channel.should.equal(channel);
      pubnubPublish.getCall(0).args[0].message.should.equal(message);
    });
  });

  it('should have pub method for publishing a message to the default channel', () => {
    // get pubsub
    const pubsub = require('../pubsub');

    const message = 'a message';
    const defaultChannel = MESSAGE_CHANNEL;

    // publish message
    pubsub.pub(message).then(() => {
      // should have published message on the default channel
      const pubnubPublish = mocks.pubnub.returnValues[0].publish;
      pubnubPublish.should.have.been.called;
      pubnubPublish.getCall(0).args[0].channel.should.equal(defaultChannel);
      pubnubPublish.getCall(0).args[0].message.should.equal(message);
    });
  });

  it('should have subscribe method for subscribing to messages on a channel', () => {
    // get pubsub
    const pubsub = require('../pubsub');

    const channel = MESSAGE_CHANNEL;

    const firstListener = sinon.spy();
    const secondListener = sinon.spy();
    const thirdListener = sinon.spy();

    const firstMessage = 'first message';
    const secondMessage = 'second message';
    const thirdMessage = 'third message';

    return Promise.all(
      // subscribe first two listeners to channel
      [
        pubsub.subscribe(channel, firstListener),
        pubsub.subscribe(channel, secondListener)
      ]
    )
      .then(() => {
        return Promise.all([
          // publish two messages
          pubsub.publish(channel, firstMessage),
          pubsub.publish(channel, secondMessage)
        ]);
      })
      .then(() => {
        // first two listeners should receive both messages
        firstListener.should.have.been.calledWith(firstMessage);
        firstListener.should.have.been.calledWith(secondMessage);

        secondListener.should.have.been.calledWith(firstMessage);
        secondListener.should.have.been.calledWith(secondMessage);

        thirdListener.should.not.have.been.calledWith(firstMessage);
        thirdListener.should.not.have.been.calledWith(secondMessage);

        // subscribe third listener
        return pubsub.subscribe(channel, thirdListener);
      })
      .then(() => {
        // publish another message
        return pubsub.publish(channel, thirdMessage);
      })
      .then(() => {
        // all three listeners should receive third message
        firstListener.should.have.been.calledWith(thirdMessage);
        secondListener.should.have.been.calledWith(thirdMessage);
        thirdListener.should.have.been.calledWith(thirdMessage);
      });
  });

  it('should have sub method for subscribing to messages on the default channel', () => {
    // get pubsub
    const pubsub = require('../pubsub');

    const listener = sinon.spy();
    const message = 'a message';

    // subscribe to default channel
    return pubsub
      .sub(listener)
      .then(() => {
        // publish message
        return pubsub.pub(message);
      })
      .then(() => {
        // should have received message
        listener.should.have.been.calledWith(message);
      });
  });
});
