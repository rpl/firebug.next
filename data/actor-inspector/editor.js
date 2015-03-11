/* See license.txt for terms of usage */

define(function(require) {
  require("immutable-global"); // WORKAROUND: needed by immstruct

  var React = require("react");
  var immstruct = require("immstruct");
  var { PacketEditor } = require("./packet-editor");

  var stateTree = immstruct({
    models: {
      packet: {
        to: "root",
        type: "requestTypes"
      }
    },
    views: {
      currentPopover: null
    }
  });

  var packetEditorActions = {
    clearPacket: function() {
      stateTree.cursor(['models', 'packet']).update(_ => {
        return Immutable.fromJS({
          to: 'root',
          type: 'requestTypes'
        });
      });
    },
    sendPacket: function(packet) {
      postChromeMessage("send-new-packet", JSON.stringify(packet));
    },
    togglePopover: function(popover) {
      var oldPopover = stateTree.cursor(['views', 'currentPopover']).deref();
      if (oldPopover && oldPopover._lifeCycleState == "UNMOUNTED") {
        oldPopover = null;
      }

      if (oldPopover) {
        oldPopover.hide();
      }

      stateTree.cursor(['views', 'currentPopover']).update(_ => popover);
      popover.toggle();
    }
  };

  // Event Listeners Registration
  window.addEventListener("devtools:select", onSelect);

  React.render(PacketEditor({ reference: stateTree.reference(['models', 'packet']),
                              actions: packetEditorActions }), document.body);

  function onSelect(event) {
    try {
      stateTree.cursor(['models', 'packet']).update(_ => {
        return Immutable.fromJS(JSON.parse(event.data));
      });
    } catch(e) {
      console.log("EDITOR EXCEPTION", e);
    }
  }

});
