/* See license.txt for terms of usage */

define(function(require, exports, module) {

// Dependencies
const React = require("react");
const Immutable = require("immutable");
const ReactBootstrap = require("react-bootstrap");
const { Reps } = require("reps/reps");

// Shortcuts
const OverlayTrigger = React.createFactory(ReactBootstrap.OverlayTrigger);
const Popover = React.createFactory(ReactBootstrap.Popover);
const ButtonGroup = React.createFactory(ReactBootstrap.ButtonGroup);
const Button = React.createFactory(ReactBootstrap.Button);

const { UL, LI, SPAN, DIV, TABLE, TBODY, TFOOT, TR, TD, BUTTON, TEXTAREA } = Reps.DOM;

var PacketField = React.createFactory(React.createClass({
  displayName: "PacketField",
  componentWillMount: function() {
    this.setState(this.props);
  },

  componentWillReceiveProps: function(props) {
    this.setState(props);
  },

  render: function() {
    var open = this.state.open;
    var edit = this.state.edit;
    var valid = this.state.valid;
    var keys = this.state.keys;
    var cursor = this.state.cursor;
    var editorRawValue = this.state.editorRawValue;

    var { key, value } = this.state.kv;

    var keyStr = typeof key == "number" ? "[" + key + "]: " : key + ": ";

    var onUpdateCursor = this.props.onUpdateCursor;
    var onContextMenu = this.props.onContextMenu;
    var content = [];

    if ((open && !edit)
        && (value instanceof Immutable.Map ||
            value instanceof Immutable.List)) {
      var childs = [];
      value.forEach(function (value, key) {
        childs.push(PacketField({ cursor: cursor, keys: keys.concat(key),
                                  key: key,
                                  kv: {value: value, key: key},
                                  onContextMenu: onContextMenu,
                                  onUpdateCursor: onUpdateCursor }));
      });
      content = content.concat([TD({ colSpan: 2, className: "memberLabelCell" }, [
        SPAN({ onClick: this.onToggleOpen, className: "memberLabel domLabel" }, keyStr),
        TABLE({ className: "", cellPadding: 0, cellSpacing: 0,
                style: { marginLeft: "0.4em" } }, childs)
      ])]);
    } else {
      var editorClassName = editorRawValue && !valid ? "invalid" : "valid";
      var valueStr = editorRawValue ? editorRawValue : JSON.stringify(value);
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

    if (value instanceof Immutable.Map || value instanceof Immutable.List) {
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
    this.props.onContextMenu(this.refs.popover);

    evt.stopPropagation();
  },

  renderContextMenu: function() {
    var isCollection = this.state.kv.value instanceof Immutable.Map ||
          this.state.kv.value instanceof Immutable.List;

    console.log("IS COLLECTION", isCollection);

    var buttons = [
      Button({ onClick: this.onToggleEdit }, this.state.edit ? "Save" : "Edit"),
      Button({}, "Add"),
      Button({}, "Remove")
    ];

    if (!isCollection) {
      buttons.splice(1,1);
    }

    return ButtonGroup({ }, buttons);
  },

  onChange: function(event) {
    //console.log("ONCHANGE", event, event.target.value);
    var newValue, valid, error = false;

    try {
      newValue = JSON.parse(event.target.value);
      valid = true;
    } catch(e) {
      valid = false;
      error = e;
    }
    this.setState({
      editorRawValue: event.target.value,
      kv: {
        key: this.state.kv.key,
        value: newValue ? Immutable.fromJS(newValue) : this.state.kv.value
      },
      valid: valid,
      error: error
    });
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

    console.log("TOGGLE EDIT");
    var edit = this.state.edit;
    if (edit) {
      var { cursor, keys, kv: { value } } = this.state;
      console.log("UPDATE IN", cursor, keys, value);
      this.props.onUpdateCursor(cursor.setIn(keys, value));
    }
    this.setState({
      edit: !edit
    });
  }

}));

/**
 * TODO docs
 */
var PacketEditor = React.createClass({
  displayName: "PacketEditor",

  componentWillMount: function() {
    console.log("MOUNT", this.props);
    this.setState(this.props);
  },

  componentWillReceiveProps: function(props) {
    console.log("WILL RECEIVE PROPS", props);
    this.setState(props);
  },

  render: function() {
    var rows = [];
    var cursor = this.state.cursor;
    var onUpdateCursor = this.onUpdateCursor;
    var onContextMenu = this.props.onContextMenu;

    cursor.forEach(function (value, key) {
      rows.push(PacketField({ cursor: cursor, keys: [key],
                              key: key,
                              kv: { value: value, key: key },
                              onContextMenu: onContextMenu,
                              onUpdateCursor: onUpdateCursor }));
    });

    var buttons = [
      TR({ style: {textAlign: "center"}}, [
        TD({ key: "send" }, BUTTON({}, "Send")),
        TD({ key: "clear" }, BUTTON({}, "Clear"))
      ])
    ];

    return (
      TABLE({
        className: "domTable", cellPadding: 0, cellSpacing: 0
      }, [TBODY({}, rows), TFOOT({}, buttons)] )
    );
  },

  // Event Handlers
  onClick: function(event) {
    postChromeMessage("send-packet", JSON.stringify(this.state.cursor.toJS()));
  },

  onUpdateCursor: function(cursor) {
    console.log("UPDATED", cursor);
    this.setState({
      cursor: cursor
    });
  }
});

// Exports from this module
exports.PacketEditor = React.createFactory(PacketEditor);
});
