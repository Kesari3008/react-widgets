import {assert} from 'chai';

import {createSpace, disconnectDevices, registerDevices, setupGroupTestUsers} from '../../../lib/test-users';
import waitForPromise from '../../../lib/wait-for-promise';
import {jobNames, renameJob, updateJobStatus} from '../../../lib/test-helpers';
import {elements as spaceElements} from '../../../lib/test-helpers/space-widget/main';
import {sendMessage, verifyMessageReceipt} from '../../../lib/test-helpers/space-widget/messaging';

import {
  displayAndReadIncomingMessage,
  displayIncomingMessage,
  elements as recentsElements
} from '../../../lib/test-helpers/recents-widget';

describe('Multiple Widgets', () => {
  const browserLocal = browser.select('browserLocal');
  const browserRemote = browser.select('browserRemote');
  const jobName = jobNames.smokeMultiple;

  let docbrown, lorraine, marty, participants;
  let conversation;
  let local, remote;
  let allPassed = true;

  it('start new sauce session', () => {
    browser.reload();
    browser.call(() => renameJob(jobName, browser));
    browserLocal.url('/multiple.html?local');
    browserRemote.url('/multiple.html?remote');
  });

  it('create test users and spaces', () => {
    participants = setupGroupTestUsers();
    [docbrown, lorraine, marty] = participants;
    assert.lengthOf(participants, 3, 'Test users were not created');
    registerDevices(participants);
    conversation = createSpace({sparkInstance: marty.spark, participants, displayName: 'Test Widget Space'});
  });

  it('open widgets local', () => {
    local = {browser: browserLocal, user: marty, displayName: conversation.displayName};
    browserLocal.execute((localAccessToken) => {
      const options = {
        accessToken: localAccessToken,
        onEvent: (eventName) => {
          window.ciscoSparkEvents.push({widget: 'recents', eventName});
        }
      };

      window.openRecentsWidget(options);
    }, marty.token.access_token);
    browserLocal.waitForVisible(recentsElements.recentsWidget);

    browserLocal.execute((localAccessToken, spaceId) => {
      const options = {
        accessToken: localAccessToken,
        destinationId: spaceId,
        destinationType: 'spaceId',
        onEvent: (eventName) => {
          window.ciscoSparkEvents.push({widget: 'space', eventName});
        }
      };

      window.openSpaceWidget(options);
    }, marty.token.access_token, conversation.hydraId);
    browserLocal.waitForVisible(spaceElements.spaceWidget);
  });

  it('open widgets remote', () => {
    remote = {browser: browserRemote, user: docbrown, displayName: conversation.displayName};
    browserRemote.execute((localAccessToken) => {
      const options = {
        accessToken: localAccessToken,
        onEvent: (eventName) => {
          window.ciscoSparkEvents.push({widget: 'recents', eventName});
        }
      };

      window.openRecentsWidget(options);
    }, docbrown.token.access_token);
    browserRemote.waitForVisible(recentsElements.recentsWidget);

    browserRemote.execute((localAccessToken, spaceId) => {
      const options = {
        accessToken: localAccessToken,
        destinationId: spaceId,
        destinationType: 'spaceId',
        onEvent: (eventName) => {
          window.ciscoSparkEvents.push({widget: 'space', eventName});
        }
      };

      window.openSpaceWidget(options);
    }, docbrown.token.access_token, conversation.hydraId);
    browserRemote.waitForVisible(spaceElements.spaceWidget);
  });

  it('has the page loaded', () => {
    const expectedTitle = 'Cisco Spark Multiple Widget Test';

    assert.equal(browserLocal.getTitle(), expectedTitle, 'page title does not match expected');
  });

  describe('recents widget functionality', () => {
    it('displays a new incoming message', () => {
      const lorraineText = 'Marty, will we ever see you again?';

      displayIncomingMessage(browserLocal, lorraine, conversation, lorraineText);
    });

    it('removes unread indicator when read', () => {
      const lorraineText = 'You\'re safe and sound now!';

      displayAndReadIncomingMessage(browserLocal, lorraine, marty, conversation, lorraineText);
    });
  });

  describe('space widget functionality', () => {
    before('wait for conversation to be ready', () => {
      const textInputField = `[placeholder="Send a message to ${conversation.displayName}"]`;

      browserLocal.waitForVisible(textInputField);
    });

    describe('Activity Section', () => {
      it('has a message button', () => {
        browserLocal.waitForVisible(spaceElements.messageActivityButton);
      });

      it('switches to message widget', () => {
        browserLocal.click(spaceElements.messageActivityButton);
        assert.isTrue(browserLocal.isVisible(spaceElements.messageWidget));
      });
    });

    describe('messaging', () => {
      it('sends and receives messages', () => {
        const martyText = 'Wait a minute. Wait a minute, Doc. Ah... Are you telling me that you built a time machine... out of a DeLorean?';
        const docText = 'The way I see it, if you\'re gonna build a time machine into a car, why not do it with some style?';
        const lorraineText = 'Marty, will we ever see you again?';
        const martyText2 = 'I guarantee it.';

        sendMessage(remote, local, martyText);
        verifyMessageReceipt(local, remote, martyText);
        sendMessage(remote, local, docText);
        verifyMessageReceipt(local, remote, docText);
        // Send a message from a 'client'
        waitForPromise(lorraine.spark.internal.conversation.post(conversation, {
          displayName: lorraineText
        }));
        // Wait for both widgets to receive client message
        verifyMessageReceipt(local, remote, lorraineText);
        verifyMessageReceipt(remote, local, lorraineText);
        sendMessage(local, remote, martyText2);
        verifyMessageReceipt(remote, local, martyText2);
      });
    });
  });

  it('disconnects test users', () => disconnectDevices(participants));

  /* eslint-disable-next-line func-names */
  afterEach(function () {
    allPassed = allPassed && (this.currentTest.state === 'passed');
  });

  after(() => browser.call(() => updateJobStatus(jobName, allPassed)));
});
