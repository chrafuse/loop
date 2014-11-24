/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/*jshint newcap:false*/
/*global loop, sinon */

var expect = chai.expect;
var TestUtils = React.addons.TestUtils;
var sharedActions = loop.shared.actions;
var sharedUtils = loop.shared.utils;

describe("loop.panel", function() {
  "use strict";

  var sandbox, notifications, fakeXHR, requests = [];

  beforeEach(function(done) {
    sandbox = sinon.sandbox.create();
    fakeXHR = sandbox.useFakeXMLHttpRequest();
    requests = [];
    // https://github.com/cjohansen/Sinon.JS/issues/393
    fakeXHR.xhr.onCreate = function (xhr) {
      requests.push(xhr);
    };
    notifications = new loop.shared.models.NotificationCollection();

    navigator.mozLoop = {
      doNotDisturb: true,
      fxAEnabled: true,
      getStrings: function() {
        return JSON.stringify({textContent: "fakeText"});
      },
      get locale() {
        return "en-US";
      },
      setLoopPref: sandbox.stub(),
      getLoopPref: sandbox.stub().returns("unseen"),
      getPluralForm: function() {
        return "fakeText";
      },
      copyString: sandbox.stub(),
      noteCallUrlExpiry: sinon.spy(),
      composeEmail: sinon.spy(),
      telemetryAdd: sinon.spy(),
      contacts: {
        getAll: function(callback) {
          callback(null, []);
        },
        on: sandbox.stub()
      },
      rooms: {
        getAll: function(version, callback) {
          callback(null, []);
        },
        on: sandbox.stub()
      }
    };

    document.mozL10n.initialize(navigator.mozLoop);
    // XXX prevent a race whenever mozL10n hasn't been initialized yet
    setTimeout(done, 0);
  });

  afterEach(function() {
    delete navigator.mozLoop;
    sandbox.restore();
  });

  describe("#init", function() {
    beforeEach(function() {
      sandbox.stub(React, "renderComponent");
      sandbox.stub(document.mozL10n, "initialize");
      sandbox.stub(document.mozL10n, "get").returns("Fake title");
    });

    it("should initalize L10n", function() {
      loop.panel.init();

      sinon.assert.calledOnce(document.mozL10n.initialize);
      sinon.assert.calledWithExactly(document.mozL10n.initialize,
        navigator.mozLoop);
    });

    it("should render the panel view", function() {
      loop.panel.init();

      sinon.assert.calledOnce(React.renderComponent);
      sinon.assert.calledWith(React.renderComponent,
        sinon.match(function(value) {
          return TestUtils.isDescriptorOfType(value,
            loop.panel.PanelView);
      }));
    });

    it("should dispatch an loopPanelInitialized", function(done) {
      function listener() {
        done();
      }

      window.addEventListener("loopPanelInitialized", listener);

      loop.panel.init();

      window.removeEventListener("loopPanelInitialized", listener);
    });
  });

  describe("loop.panel.AvailabilityDropdown", function() {
    var view;

    beforeEach(function() {
      view = TestUtils.renderIntoDocument(loop.panel.AvailabilityDropdown());
    });

    describe("doNotDisturb preference change", function() {
      beforeEach(function() {
        navigator.mozLoop.doNotDisturb = true;
      });

      it("should toggle the value of mozLoop.doNotDisturb", function() {
        var availableMenuOption = view.getDOMNode()
                                    .querySelector(".dnd-make-available");

        TestUtils.Simulate.click(availableMenuOption);

        expect(navigator.mozLoop.doNotDisturb).eql(false);
      });

      it("should toggle the dropdown menu", function() {
        var availableMenuOption = view.getDOMNode()
                                    .querySelector(".dnd-status span");

        TestUtils.Simulate.click(availableMenuOption);

        expect(view.state.showMenu).eql(true);
      });
    });
  });

  describe("loop.panel.PanelView", function() {
    var fakeClient, dispatcher, roomStore, callUrlData;

    beforeEach(function() {
      callUrlData = {
        callUrl: "http://call.invalid/",
        expiresAt: 1000
      };

      fakeClient = {
        requestCallUrl: function(_, cb) {
          cb(null, callUrlData);
        }
      };

      dispatcher = new loop.Dispatcher();
      roomStore = new loop.store.RoomStore(dispatcher, {
        mozLoop: navigator.mozLoop
      });
    });

    function createTestPanelView() {
      return TestUtils.renderIntoDocument(loop.panel.PanelView({
        notifications: notifications,
        client: fakeClient,
        showTabButtons: true,
        dispatcher: dispatcher,
        roomStore: roomStore
      }));
    }

    describe('TabView', function() {
      var view, callTab, roomsTab, contactsTab;

      describe("loop.rooms.enabled on", function() {
        beforeEach(function() {
          navigator.mozLoop.getLoopPref = function(pref) {
            if (pref === "rooms.enabled" ||
                pref === "gettingStarted.seen") {
              return true;
            }
          };

          view = createTestPanelView();

          [roomsTab, contactsTab] =
            TestUtils.scryRenderedDOMComponentsWithClass(view, "tab");
        });

        it("should select contacts tab when clicking tab button", function() {
          TestUtils.Simulate.click(
            view.getDOMNode().querySelector("li[data-tab-name=\"contacts\"]"));

          expect(contactsTab.getDOMNode().classList.contains("selected"))
            .to.be.true;
        });

        it("should select rooms tab when clicking tab button", function() {
          TestUtils.Simulate.click(
            view.getDOMNode().querySelector("li[data-tab-name=\"rooms\"]"));

          expect(roomsTab.getDOMNode().classList.contains("selected"))
            .to.be.true;
        });
      });

      describe("loop.rooms.enabled off", function() {
        beforeEach(function() {
          navigator.mozLoop.getLoopPref = function(pref) {
            if (pref === "rooms.enabled") {
              return false;
            } else if (pref === "gettingStarted.seen") {
              return true;
            }
          };

          view = createTestPanelView();

          [callTab, contactsTab] =
            TestUtils.scryRenderedDOMComponentsWithClass(view, "tab");
        });

        it("should select contacts tab when clicking tab button", function() {
          TestUtils.Simulate.click(
            view.getDOMNode().querySelector("li[data-tab-name=\"contacts\"]"));

          expect(contactsTab.getDOMNode().classList.contains("selected"))
            .to.be.true;
        });

        it("should select call tab when clicking tab button", function() {
          TestUtils.Simulate.click(
            view.getDOMNode().querySelector("li[data-tab-name=\"call\"]"));

          expect(callTab.getDOMNode().classList.contains("selected"))
            .to.be.true;
        });
      });
    });

    describe("AuthLink", function() {
      it("should trigger the FxA sign in/up process when clicking the link",
        function() {
          navigator.mozLoop.loggedInToFxA = false;
          navigator.mozLoop.logInToFxA = sandbox.stub();

          var view = createTestPanelView();

          TestUtils.Simulate.click(
            view.getDOMNode().querySelector(".signin-link a"));

          sinon.assert.calledOnce(navigator.mozLoop.logInToFxA);
        });

      it("should be hidden if FxA is not enabled",
        function() {
          navigator.mozLoop.fxAEnabled = false;
          var view = TestUtils.renderIntoDocument(loop.panel.AuthLink());
          expect(view.getDOMNode()).to.be.null;
      });

      afterEach(function() {
        navigator.mozLoop.fxAEnabled = true;
      });
    });

    describe("SettingsDropdown", function() {
      beforeEach(function() {
        navigator.mozLoop.logInToFxA = sandbox.stub();
        navigator.mozLoop.logOutFromFxA = sandbox.stub();
        navigator.mozLoop.openFxASettings = sandbox.stub();
      });

      afterEach(function() {
        navigator.mozLoop.fxAEnabled = true;
      });

      it("should be hidden if FxA is not enabled",
        function() {
          navigator.mozLoop.fxAEnabled = false;
          var view = TestUtils.renderIntoDocument(loop.panel.SettingsDropdown());
          expect(view.getDOMNode()).to.be.null;
      });

      it("should show a signin entry when user is not authenticated",
        function() {
          navigator.mozLoop.loggedInToFxA = false;

          var view = TestUtils.renderIntoDocument(loop.panel.SettingsDropdown());

          expect(view.getDOMNode().querySelectorAll(".icon-signout"))
            .to.have.length.of(0);
          expect(view.getDOMNode().querySelectorAll(".icon-signin"))
            .to.have.length.of(1);
        });

      it("should show a signout entry when user is authenticated", function() {
        navigator.mozLoop.userProfile = {email: "test@example.com"};

        var view = TestUtils.renderIntoDocument(loop.panel.SettingsDropdown());

        expect(view.getDOMNode().querySelectorAll(".icon-signout"))
          .to.have.length.of(1);
        expect(view.getDOMNode().querySelectorAll(".icon-signin"))
          .to.have.length.of(0);
      });

      it("should show an account entry when user is authenticated", function() {
        navigator.mozLoop.userProfile = {email: "test@example.com"};

        var view = TestUtils.renderIntoDocument(loop.panel.SettingsDropdown());

        expect(view.getDOMNode().querySelectorAll(".icon-account"))
          .to.have.length.of(1);
      });

      it("should open the FxA settings when the account entry is clicked", function() {
        navigator.mozLoop.userProfile = {email: "test@example.com"};

        var view = TestUtils.renderIntoDocument(loop.panel.SettingsDropdown());

        TestUtils.Simulate.click(
          view.getDOMNode().querySelector(".icon-account"));

        sinon.assert.calledOnce(navigator.mozLoop.openFxASettings);
      });

      it("should hide any account entry when user is not authenticated",
        function() {
          navigator.mozLoop.loggedInToFxA = false;

          var view = TestUtils.renderIntoDocument(loop.panel.SettingsDropdown());

          expect(view.getDOMNode().querySelectorAll(".icon-account"))
            .to.have.length.of(0);
        });

      it("should sign in the user on click when unauthenticated", function() {
        navigator.mozLoop.loggedInToFxA = false;
        var view = TestUtils.renderIntoDocument(loop.panel.SettingsDropdown());

        TestUtils.Simulate.click(
          view.getDOMNode().querySelector(".icon-signin"));

        sinon.assert.calledOnce(navigator.mozLoop.logInToFxA);
      });

      it("should sign out the user on click when authenticated", function() {
        navigator.mozLoop.userProfile = {email: "test@example.com"};
        var view = TestUtils.renderIntoDocument(loop.panel.SettingsDropdown());

        TestUtils.Simulate.click(
          view.getDOMNode().querySelector(".icon-signout"));

        sinon.assert.calledOnce(navigator.mozLoop.logOutFromFxA);
      });
    });

    describe("Help", function() {
      var supportUrl = "https://example.com";

      beforeEach(function() {
        navigator.mozLoop.getLoopPref = function(pref) {
          if (pref === "support_url")
            return supportUrl;
          return "unseen";
        };

        sandbox.stub(window, "open");
        sandbox.stub(window, "close");
      });

      it("should open a tab to the support page", function() {
        var view = TestUtils.renderIntoDocument(loop.panel.SettingsDropdown());

        TestUtils.Simulate
          .click(view.getDOMNode().querySelector(".icon-help"));

        sinon.assert.calledOnce(window.open);
        sinon.assert.calledWithExactly(window.open, supportUrl);
      });
    });

    describe("#render", function() {
      it("should render a ToSView", function() {
        var view = createTestPanelView();

        TestUtils.findRenderedComponentWithType(view, loop.panel.ToSView);
      });

      it("should not render a ToSView when the view has been 'seen'", function() {
        navigator.mozLoop.getLoopPref = function() {
          return "seen";
        };
        var view = createTestPanelView();

        try {
          TestUtils.findRenderedComponentWithType(view, loop.panel.ToSView);
          sinon.assert.fail("Should not find the ToSView if it has been 'seen'");
        } catch (ex) {}
      });

      it("should render a GettingStarted view", function() {
        navigator.mozLoop.getLoopPref = function(pref) {
          return false;
        };
        var view = createTestPanelView();

        TestUtils.findRenderedComponentWithType(view, loop.panel.GettingStartedView);
      });

      it("should not render a GettingStartedView when the view has been seen", function() {
        navigator.mozLoop.getLoopPref = function() {
          return true;
        };
        var view = createTestPanelView();

        try {
          TestUtils.findRenderedComponentWithType(view, loop.panel.GettingStartedView);
          sinon.assert.fail("Should not find the GettingStartedView if it has been seen");
        } catch (ex) {}
      });

    });
  });

  describe("loop.panel.CallUrlResult", function() {
    var fakeClient, callUrlData, view;

    beforeEach(function() {
      callUrlData = {
        callUrl: "http://call.invalid/fakeToken",
        expiresAt: 1000
      };

      fakeClient = {
        requestCallUrl: function(_, cb) {
          cb(null, callUrlData);
        }
      };

      sandbox.stub(notifications, "reset");
      view = TestUtils.renderIntoDocument(loop.panel.CallUrlResult({
        notifications: notifications,
        client: fakeClient
      }));
    });

    describe("Rendering the component should generate a call URL", function() {

      beforeEach(function() {
        document.mozL10n.initialize({
          getStrings: function(key) {
            var text;

            if (key === "share_email_subject4")
              text = "email-subject";
            else if (key === "share_email_body4")
              text = "{{callUrl}}";

            return JSON.stringify({textContent: text});
          }
        });
      });

      it("should make a request to requestCallUrl", function() {
        sandbox.stub(fakeClient, "requestCallUrl");
        var view = TestUtils.renderIntoDocument(loop.panel.CallUrlResult({
          notifications: notifications,
          client: fakeClient
        }));

        sinon.assert.calledOnce(view.props.client.requestCallUrl);
        sinon.assert.calledWithExactly(view.props.client.requestCallUrl,
                                       sinon.match.string, sinon.match.func);
      });

      it("should set the call url form in a pending state", function() {
        // Cancel requestCallUrl effect to keep the state pending
        fakeClient.requestCallUrl = sandbox.stub();
        var view = TestUtils.renderIntoDocument(loop.panel.CallUrlResult({
          notifications: notifications,
          client: fakeClient
        }));

        expect(view.state.pending).eql(true);
      });

      it("should update state with the call url received", function() {
        expect(view.state.pending).eql(false);
        expect(view.state.callUrl).eql(callUrlData.callUrl);
      });

      it("should clear the pending state when a response is received",
        function() {
          expect(view.state.pending).eql(false);
        });

      it("should update CallUrlResult with the call url", function() {
        var urlField = view.getDOMNode().querySelector("input[type='url']");

        expect(urlField.value).eql(callUrlData.callUrl);
      });

      it("should have 0 pending notifications", function() {
        expect(view.props.notifications.length).eql(0);
      });

      it("should display a share button for email", function() {
        fakeClient.requestCallUrl = sandbox.stub();
        var composeCallUrlEmail = sandbox.stub(sharedUtils, "composeCallUrlEmail");
        var view = TestUtils.renderIntoDocument(loop.panel.CallUrlResult({
          notifications: notifications,
          client: fakeClient
        }));
        view.setState({pending: false, callUrl: "http://example.com"});

        TestUtils.findRenderedDOMComponentWithClass(view, "button-email");
        TestUtils.Simulate.click(view.getDOMNode().querySelector(".button-email"));

        sinon.assert.calledOnce(composeCallUrlEmail);
        sinon.assert.calledWithExactly(composeCallUrlEmail, "http://example.com");
      });

      it("should feature a copy button capable of copying the call url when clicked", function() {
        fakeClient.requestCallUrl = sandbox.stub();
        var view = TestUtils.renderIntoDocument(loop.panel.CallUrlResult({
          notifications: notifications,
          client: fakeClient
        }));
        view.setState({
          pending: false,
          copied: false,
          callUrl: "http://example.com",
          callUrlExpiry: 6000
        });

        TestUtils.Simulate.click(view.getDOMNode().querySelector(".button-copy"));

        sinon.assert.calledOnce(navigator.mozLoop.copyString);
        sinon.assert.calledWithExactly(navigator.mozLoop.copyString,
          view.state.callUrl);
      });

      it("should note the call url expiry when the url is copied via button",
        function() {
          var view = TestUtils.renderIntoDocument(loop.panel.CallUrlResult({
            notifications: notifications,
            client: fakeClient
          }));
          view.setState({
            pending: false,
            copied: false,
            callUrl: "http://example.com",
            callUrlExpiry: 6000
          });

          TestUtils.Simulate.click(view.getDOMNode().querySelector(".button-copy"));

          sinon.assert.calledOnce(navigator.mozLoop.noteCallUrlExpiry);
          sinon.assert.calledWithExactly(navigator.mozLoop.noteCallUrlExpiry,
            6000);
        });

      it("should call mozLoop.telemetryAdd when the url is copied via button",
        function() {
          var view = TestUtils.renderIntoDocument(loop.panel.CallUrlResult({
            notifications: notifications,
            client: fakeClient
          }));
          view.setState({
            pending: false,
            copied: false,
            callUrl: "http://example.com",
            callUrlExpiry: 6000
          });

          // Multiple clicks should result in the URL being counted only once.
          TestUtils.Simulate.click(view.getDOMNode().querySelector(".button-copy"));
          TestUtils.Simulate.click(view.getDOMNode().querySelector(".button-copy"));

          sinon.assert.calledOnce(navigator.mozLoop.telemetryAdd);
          sinon.assert.calledWith(navigator.mozLoop.telemetryAdd,
                                  "LOOP_CLIENT_CALL_URL_SHARED",
                                  true);
        });

      it("should note the call url expiry when the url is emailed",
        function() {
          var view = TestUtils.renderIntoDocument(loop.panel.CallUrlResult({
            notifications: notifications,
            client: fakeClient
          }));
          view.setState({
            pending: false,
            copied: false,
            callUrl: "http://example.com",
            callUrlExpiry: 6000
          });

          TestUtils.Simulate.click(view.getDOMNode().querySelector(".button-email"));

          sinon.assert.calledOnce(navigator.mozLoop.noteCallUrlExpiry);
          sinon.assert.calledWithExactly(navigator.mozLoop.noteCallUrlExpiry,
            6000);
        });

      it("should call mozLoop.telemetryAdd when the url is emailed",
        function() {
          var view = TestUtils.renderIntoDocument(loop.panel.CallUrlResult({
            notifications: notifications,
            client: fakeClient
          }));
          view.setState({
            pending: false,
            copied: false,
            callUrl: "http://example.com",
            callUrlExpiry: 6000
          });

          // Multiple clicks should result in the URL being counted only once.
          TestUtils.Simulate.click(view.getDOMNode().querySelector(".button-email"));
          TestUtils.Simulate.click(view.getDOMNode().querySelector(".button-email"));

          sinon.assert.calledOnce(navigator.mozLoop.telemetryAdd);
          sinon.assert.calledWith(navigator.mozLoop.telemetryAdd,
                                  "LOOP_CLIENT_CALL_URL_SHARED",
                                  true);
        });

      it("should note the call url expiry when the url is copied manually",
        function() {
          var view = TestUtils.renderIntoDocument(loop.panel.CallUrlResult({
            notifications: notifications,
            client: fakeClient
          }));
          view.setState({
            pending: false,
            copied: false,
            callUrl: "http://example.com",
            callUrlExpiry: 6000
          });

          var urlField = view.getDOMNode().querySelector("input[type='url']");
          TestUtils.Simulate.copy(urlField);

          sinon.assert.calledOnce(navigator.mozLoop.noteCallUrlExpiry);
          sinon.assert.calledWithExactly(navigator.mozLoop.noteCallUrlExpiry,
            6000);
        });

      it("should call mozLoop.telemetryAdd when the url is copied manually",
        function() {
          var view = TestUtils.renderIntoDocument(loop.panel.CallUrlResult({
            notifications: notifications,
            client: fakeClient
          }));
          view.setState({
            pending: false,
            copied: false,
            callUrl: "http://example.com",
            callUrlExpiry: 6000
          });

          // Multiple copies should result in the URL being counted only once.
          var urlField = view.getDOMNode().querySelector("input[type='url']");
          TestUtils.Simulate.copy(urlField);
          TestUtils.Simulate.copy(urlField);

          sinon.assert.calledOnce(navigator.mozLoop.telemetryAdd);
          sinon.assert.calledWith(navigator.mozLoop.telemetryAdd,
                                  "LOOP_CLIENT_CALL_URL_SHARED",
                                  true);
        });

      it("should notify the user when the operation failed", function() {
        fakeClient.requestCallUrl = function(_, cb) {
          cb("fake error");
        };
        sandbox.stub(notifications, "errorL10n");
        TestUtils.renderIntoDocument(loop.panel.CallUrlResult({
          notifications: notifications,
          client: fakeClient
        }));

        sinon.assert.calledOnce(notifications.errorL10n);
        sinon.assert.calledWithExactly(notifications.errorL10n,
                                       "unable_retrieve_url");
      });
    });
  });

  describe("loop.panel.RoomEntry", function() {
    var dispatcher, roomData;

    beforeEach(function() {
      dispatcher = new loop.Dispatcher();
      roomData = {
        roomToken: "QzBbvGmIZWU",
        roomUrl: "http://sample/QzBbvGmIZWU",
        roomName: "Second Room Name",
        maxSize: 2,
        participants: [
          { displayName: "Alexis", account: "alexis@example.com",
            roomConnectionId: "2a1787a6-4a73-43b5-ae3e-906ec1e763cb" },
          { displayName: "Adam",
            roomConnectionId: "781f012b-f1ea-4ce1-9105-7cfc36fb4ec7" }
        ],
        ctime: 1405517418
      };
    });

    function mountRoomEntry(props) {
      return TestUtils.renderIntoDocument(loop.panel.RoomEntry(props));
    }

    describe("Copy button", function() {
      var roomEntry, copyButton;

      beforeEach(function() {
        roomEntry = mountRoomEntry({
          dispatcher: dispatcher,
          deleteRoom: sandbox.stub(),
          room: new loop.store.Room(roomData)
        });
        copyButton = roomEntry.getDOMNode().querySelector("button.copy-link");
      });

      it("should not display a copy button by default", function() {
        expect(copyButton).to.not.equal(null);
      });

      it("should copy the URL when the click event fires", function() {
        sandbox.stub(dispatcher, "dispatch");

        TestUtils.Simulate.click(copyButton);

        sinon.assert.called(dispatcher.dispatch);
        sinon.assert.calledWithExactly(dispatcher.dispatch,
          new sharedActions.CopyRoomUrl({roomUrl: roomData.roomUrl}));
      });

      it("should set state.urlCopied when the click event fires", function() {
        TestUtils.Simulate.click(copyButton);

        expect(roomEntry.state.urlCopied).to.equal(true);
      });

      it("should switch to displaying a check icon when the URL has been copied",
        function() {
          TestUtils.Simulate.click(copyButton);

          expect(copyButton.classList.contains("checked")).eql(true);
        });

      it("should not display a check icon after mouse leaves the entry",
        function() {
          var roomNode = roomEntry.getDOMNode();
          TestUtils.Simulate.click(copyButton);

          TestUtils.SimulateNative.mouseOut(roomNode);

          expect(copyButton.classList.contains("checked")).eql(false);
        });
    });

    describe("Delete button click", function() {
      var roomEntry, deleteButton;

      beforeEach(function() {
        roomEntry = mountRoomEntry({
          dispatcher: dispatcher,
          room: new loop.store.Room(roomData)
        });
        deleteButton = roomEntry.getDOMNode().querySelector("button.delete-link");
      });

      it("should not display a delete button by default", function() {
        expect(deleteButton).to.not.equal(null);
      });

      it("should call the delete function when clicked", function() {
        sandbox.stub(dispatcher, "dispatch");

        TestUtils.Simulate.click(deleteButton);

        sinon.assert.calledOnce(dispatcher.dispatch);
        sinon.assert.calledWithExactly(dispatcher.dispatch,
          new sharedActions.DeleteRoom({roomToken: roomData.roomToken}));
      });
    });

    describe("Room URL click", function() {
      var roomEntry;

      it("should dispatch an OpenRoom action", function() {
        sandbox.stub(dispatcher, "dispatch");
        roomEntry = mountRoomEntry({
          dispatcher: dispatcher,
          room: new loop.store.Room(roomData)
        });
        var urlLink = roomEntry.getDOMNode().querySelector("p > a");

        TestUtils.Simulate.click(urlLink);

        sinon.assert.calledOnce(dispatcher.dispatch);
        sinon.assert.calledWithExactly(dispatcher.dispatch,
          new sharedActions.OpenRoom({roomToken: roomData.roomToken}));
      });
    });
  });

  describe("loop.panel.RoomList", function() {
    var roomStore, dispatcher, fakeEmail;

    beforeEach(function() {
      fakeEmail = "fakeEmail@example.com";
      dispatcher = new loop.Dispatcher();
      roomStore = new loop.store.RoomStore(dispatcher, {
        mozLoop: navigator.mozLoop
      });
      roomStore.setStoreState({
        pendingCreation: false,
        pendingInitialRetrieval: false,
        rooms: [],
        error: undefined
      });
    });

    function createTestComponent() {
      return TestUtils.renderIntoDocument(loop.panel.RoomList({
        store: roomStore,
        dispatcher: dispatcher,
        userDisplayName: fakeEmail
      }));
    }

    it("should dispatch a GetAllRooms action on mount", function() {
      var dispatch = sandbox.stub(dispatcher, "dispatch");

      createTestComponent();

      sinon.assert.calledOnce(dispatch);
      sinon.assert.calledWithExactly(dispatch, new sharedActions.GetAllRooms());
    });

    it("should dispatch a CreateRoom action when clicking on the Start a " +
       "conversation button",
      function() {
        navigator.mozLoop.userProfile = {email: fakeEmail};
        var dispatch = sandbox.stub(dispatcher, "dispatch");
        var view = createTestComponent();

        TestUtils.Simulate.click(view.getDOMNode().querySelector("button"));

        sinon.assert.calledWith(dispatch, new sharedActions.CreateRoom({
          nameTemplate: "fakeText",
          roomOwner: fakeEmail
        }));
      });

    it("should disable the create button when a creation operation is ongoing",
      function() {
        var dispatch = sandbox.stub(dispatcher, "dispatch");
        roomStore.setStoreState({pendingCreation: true});

        var view = createTestComponent();

        var buttonNode = view.getDOMNode().querySelector("button[disabled]");
        expect(buttonNode).to.not.equal(null);
      });

    it("should disable the create button when a list retrieval operation is pending",
      function() {
        var dispatch = sandbox.stub(dispatcher, "dispatch");
        roomStore.setStoreState({pendingInitialRetrieval: true});

        var view = createTestComponent();

        var buttonNode = view.getDOMNode().querySelector("button[disabled]");
        expect(buttonNode).to.not.equal(null);
      });
  });

  describe('loop.panel.ToSView', function() {

    it("should render when the value of loop.seenToS is not set", function() {
      var view = TestUtils.renderIntoDocument(loop.panel.ToSView());

      TestUtils.findRenderedDOMComponentWithClass(view, "terms-service");
    });

    it("should not render when the value of loop.seenToS is set to 'seen'",
      function(done) {
        navigator.mozLoop.getLoopPref = function() {
          return "seen";
        };

        try {
          TestUtils.findRenderedDOMComponentWithClass(view, "tos");
        } catch (err) {
          done();
        }
    });
  });
});
