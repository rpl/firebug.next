/* See license.txt for terms of usage */

define(function(require) {
  require("immutable-global"); // WORKAROUND: needed by immstruct

  var React = require("react");
  var immstruct = require("immstruct");
  var { PacketEditor } = require("./packet-editor");

  var stateTree = immstruct.withHistory({
    packetEditor: {
      packet: {
        to: "root",
        type: "requestTypes"
      },
      openedKeyPaths: {}
    },
    currentPopover: null
  });

  var packetEditorActions = {
    undo: function() {
      stateTree.undo();
      stateTree.forceHasSwapped(null, null, ["packetEditor"]);
    },
    redo: function() {
      stateTree.redo();
      stateTree.forceHasSwapped(null, null, ["packetEditor"]);
    },
    toggleOpen: function(keyPath) {
      var openedKeyPathCursor = stateTree.cursor(
        ["packetEditor", "openedKeyPaths"].concat(keyPath)
      );

      var parentKeyPathCursor = stateTree.cursor(
        ["packetEditor", "openedKeyPaths"].concat(keyPath.slice(0, -1))
      );


      if (openedKeyPathCursor.deref()) {
        parentKeyPathCursor.delete(keyPath.slice(-1)[0]);
      } else {
        openedKeyPathCursor.update(() => Immutable.fromJS({}));
      }
    },
    clearPacket: function() {
      stateTree.cursor(['packetEditor']).update(_ => {
        return Immutable.fromJS({
          packet: {
            to: 'root',
            type: 'requestTypes'
          },
          openedKeyPaths: {}
        });
      });
    },
    sendPacket: function(packet) {
      postChromeMessage("send-new-packet", JSON.stringify(packet));
    },
    togglePopover: function(popover) {
      var oldPopover = stateTree.cursor(['currentPopover']).deref();
      if (oldPopover && oldPopover._lifeCycleState == "UNMOUNTED") {
        oldPopover = null;
      }

      if (oldPopover) {
        oldPopover.hide();
      }

      stateTree.cursor(['currentPopover']).update(_ => popover);
      popover.toggle();
    }
  };

  // Event Listeners Registration
  window.addEventListener("devtools:select", onSelect);

  React.render(PacketEditor({ reference: stateTree.reference(['packetEditor']),
                              actions: packetEditorActions }), document.body);

  function onSelect(event) {
    try {
      stateTree.cursor(['packetEditor']).update(_ => {
        return Immutable.fromJS({
          packet: JSON.parse(event.data),
          openedKeyPaths: {}
        });
      });
    } catch(e) {
      console.log("EDITOR EXCEPTION", e);
    }
  }

});
