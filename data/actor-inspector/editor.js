/* See license.txt for terms of usage */

define(function(require) {
  var React = require("react");
  var Immutable = require("immutable");
  var { PacketEditor } = require("./packet-editor");

  // Event Listeners Registration
  window.addEventListener("devtools:select", onSelect);

  function onSelect(event) {
    try {
      var cursor = Immutable.fromJS(JSON.parse(event.data));

      React.render(PacketEditor({ cursor: cursor, onContextMenu: onContextMenu }), document.body);
    } catch(e) {
      console.log("EDITOR EXCEPTION", e);
    }
  }

  var oldPopover;

  function onContextMenu(popover) {
    if (oldPopover && oldPopover._lifeCycleState == "UNMOUNTED") {
      oldPopover = null;
    }

    if (oldPopover) {
      oldPopover.hide();
    }

    if (oldPopover !== popover) {
      oldPopover = popover;
      popover.show();
    } else {
      oldPopover = null;
    }
  }
});
