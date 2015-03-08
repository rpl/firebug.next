/* See license.txt for terms of usage */

define(function(require, exports, module) {

// Dependencies
const React = require("react");
const Baobab = require("baobab");
const ReactBootstrap = require("react-bootstrap");
const { Reps } = require("reps/reps");

// Shortcuts
const OverlayTrigger = React.createFactory(ReactBootstrap.OverlayTrigger);
const Popover = React.createFactory(ReactBootstrap.Popover);
const ButtonGroup = React.createFactory(ReactBootstrap.ButtonGroup);
const Button = React.createFactory(ReactBootstrap.Button);

const { UL, LI, SPAN, DIV, TABLE, TBODY, THEAD, TFOOT, TR, TD, BUTTON, TEXTAREA } = Reps.DOM;

var CursorMixin = {
  componentWillUnmount: function() {
    this.props.cursor.off('update', this.onUpdatedCursor);
  },

  componentDidMount: function() {
    this.props.cursor.on('update', this.onUpdatedCursor);
    this.onUpdatedCursor();
  }
};

var PacketField = React.createFactory(React.createClass({
  displayName: "PacketField",
  mixins: [CursorMixin],
  getInitialState: function() {
    return {
      value: this.props.cursor.get()
    };
  },
  onUpdatedCursor: function() {
    this.setState({
      value: this.props.cursor.get()
    });
  },

  render: function() {
    console.log("PROPS", this.props);
    var { label, cursor, actions } = this.props;

    var { open, edit, valid } = this.state;
    var { value, editorRawValue } = this.state;

    value = value ? value : cursor.get();

    var keyStr = label + ": ";

    var content = [];

    if ((open && !edit) && !!value
        && (value instanceof Array ||
            value instanceof Object)) {
      var childs = [];
      Object.keys(value).forEach(function (key) {
        var fieldCursor = cursor.select(key);
        childs.push(PacketField({ cursor: fieldCursor, key: key, label: key,
                                  inCollection: true,
                                  actions: actions }));
      });
      content = content.concat([TD({ colSpan: 2, className: "memberLabelCell" }, [
        SPAN({ onClick: this.onToggleOpen, className: "memberLabel domLabel" }, keyStr),
        TABLE({ className: "", cellPadding: 0, cellSpacing: 0,
                style: { marginLeft: "0.4em" } }, childs)
      ])]);
    } else {
      var editorClassName = editorRawValue && !valid ? "invalid" : "valid";
      var valueStr = editorRawValue ? editorRawValue : JSON.stringify(value);
      console.log("VALUE", value, valueStr, editorRawValue);
      var valueSummary = valueStr.length > 33 ? valueStr.slice(0,30) + "..." : valueStr;
      var valueEl = !edit ? valueSummary :
            TEXTAREA({ value: valueStr, onChange: this.onChange,
                       className: editorClassName, style: { width: '88%' } });

      content = content.concat([
        TD({ onClick: this.onToggleOpen,
             className: "memberLabelCell" },
           SPAN({ className: "memberLabel domLabel"}, keyStr)),
        TD({ onDoubleClick: this.onDoubleClick,
             className: "memberValueCell" }, valueEl)
      ]);
    }

    var rowClassName = "memberRow domRow";

    if (value && (value instanceof Array || value instanceof Object)) {
      rowClassName += " hasChildren";
    }

    return (
      OverlayTrigger({
        ref: "popover", trigger: "manual", placement: "bottom",
        overlay: Popover({ title: keyStr }, this.renderContextMenu())
      }, TR({ className: rowClassName }, content))
    );
  },

  onDoubleClick: function(evt) {
    this.props.actions.togglePopover(this.refs.popover);

    evt.stopPropagation();
  },

  renderContextMenu: function() {
    var cursor = this.props.cursor;
    var isCollection = (v) => v && (v instanceof Array ||
                                    v instanceof Object);

    var value = cursor.get();
    console.log("IS COLLECTION", isCollection(value));
    var buttons = [
      Button({ onClick: this.onToggleEdit }, this.state.edit ? "Save" : "Edit")
    ];

    if (isCollection(value)) {
      buttons.push(Button({ onClick: this.onAdd }, "Add"));
    }

    if (this.props.inCollection) {
      buttons.push(Button({ onClick: this.onRemoveFromParent }, "Remove"));
    }


    return DIV({}, [
      ButtonGroup({ }, buttons)
    ]);
  },

  onAdd: function(event) {

  },

  onRemoveFromParent: function(event) {

  },

  onChange: function(event) {
    //console.log("ONCHANGE", event, event.target.value);
    var stateUpdate = {
      editorRawValue: event.target.value,
      valid: false,
      error: null
    };

    try {
      stateUpdate.value = JSON.parse(event.target.value);
      stateUpdate.valid = true;
    } catch(e) {
      stateUpdate.valid = false;
      stateUpdate.error = e;
    }

    this.setState(stateUpdate);
  },
  onToggleOpen: function(evt) {
    if (this.refs.popover) {
      this.refs.popover.hide();
    }

    if (this.state.edit) {
      return;
    }

    var open = this.state && this.state.open;
    this.setState({
      open: !open
    });

    evt.stopPropagation();
  },
  onToggleEdit: function(event) {
    if (this.refs.popover) {
      this.refs.popover.hide();
    }

    var { value, edit } = this.state;
    if (edit) {
      var { cursor } = this.props;
      cursor.edit(value);
    }
    this.setState({
      edit: !edit,
      editorRawValue: null
    });
  }

}));

/**
 * TODO docs
 */
var PacketEditor = React.createClass({
  displayName: "PacketEditor",
  mixins: [CursorMixin],

  getInitialState: function() {
    return {
      packet: this.props.cursor.get()
    };
  },

  onUpdatedCursor: function() {
    this.setState({
      packet: this.props.cursor.get()
    });
  },

  render: function() {
    var rows = [];
    var { packet } = this.state;
    var { cursor, actions } = this.props;

    packet = packet ? packet : cursor.get();

    Object.keys(packet).forEach(function (key) {
      console.log("PACKET KEY", key);
      var fieldCursor = cursor.select(key);
      rows.push(PacketField({ key: key, label: key, inCollection: true,
                              cursor: fieldCursor, actions: actions }));
    });

    var buttons = [
      TR({ style: {textAlign: "center"}}, [
        TD({ key: "send" }, BUTTON({ onClick: this.onSend }, "Send")),
        TD({ key: "clear" }, BUTTON({ onClick: this.onClear }, "Clear")),
        TD({ key: "add-field" }, BUTTON({ onClick: this.onAddField }, "Add Field"))
      ])
    ];

    return (
      DIV({}, [
        buttons,
        TABLE({
          className: "domTable", cellPadding: 0, cellSpacing: 0
        }, [TBODY({}, rows)] )
      ])
    );
  },

  // Event Handlers
  onClear: function(event) {
    this.props.actions.clearPacket();
  },

  onSend: function(event) {
    var { actions, cursor } = this.props;
    actions.sendPacket(cursor.get());
  }
});

// Exports from this module
exports.PacketEditor = React.createFactory(PacketEditor);
});
