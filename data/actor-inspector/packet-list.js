/* See license.txt for terms of usage */

define(function(require, exports, module) {

// Dependencies
const React = require("react");
const { Reps } = require("reps/reps");
const { Packet } = require("./packet");

// Shortcuts
const { DIV } = Reps.DOM;

/**
 * @template This template represents a list of packets displayed
 * inside the panel content.
 */
var PacketList = React.createClass({
  getInitialState: function() {
    return { data: [] };
  },

  render: function() {
    var output = [];

    var packets = this.state.data;
    for (var i in packets) {
      output.push(Packet(packets[i]));
    };

    return (
      DIV({className: "packetListBox"},
        output
      )
    );
  }
});

// Exports from this module
exports.PacketList = React.createFactory(PacketList);
});
