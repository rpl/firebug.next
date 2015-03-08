/* See license.txt for terms of usage */

define(function(require) {
  var React = require("react");
  var Baobab = require("baobab");
  var { PacketEditor } = require("./packet-editor");

  var stateTree = new Baobab({
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
      stateTree.select('models', 'packet').edit({
        to: 'root',
        type: 'requestTypes'
      });
    },
    sendPacket: function(packet) {
      postChromeMessage("send-new-packet", JSON.stringify(packet));
    },
    togglePopover: function(popover) {
      var oldPopover = stateTree.get('views', 'currentPopover');
      if (oldPopover && oldPopover._lifeCycleState == "UNMOUNTED") {
        oldPopover = null;
      }

      if (oldPopover) {
        oldPopover.hide();
      }

      stateTree.select('views', 'currentPopover').edit(popover);
      popover.toggle();
    }
  };

  // Event Listeners Registration
  window.addEventListener("devtools:select", onSelect);

  React.render(PacketEditor({ cursor: stateTree.select('models', 'packet'),
                              actions: packetEditorActions }), document.body);

  function onSelect(event) {
    try {
      stateTree.select('models', 'packet').edit(JSON.parse(event.data));
    } catch(e) {
      console.log("EDITOR EXCEPTION", e);
    }
  }

});
