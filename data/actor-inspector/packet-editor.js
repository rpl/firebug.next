/* See license.txt for terms of usage */

define(function(require, exports, module) {

// Dependencies
const React = require("react");
const ReactBootstrap = require("react-bootstrap");
const { Reps } = require("reps/reps");

// Reps
require("reps/undefined");
require("reps/string");
require("reps/number");
require("reps/array");
require("reps/object");

// Shortcuts
const OverlayTrigger = React.createFactory(ReactBootstrap.OverlayTrigger);
const Popover = React.createFactory(ReactBootstrap.Popover);
const ButtonGroup = React.createFactory(ReactBootstrap.ButtonGroup);
const Button = React.createFactory(ReactBootstrap.Button);

const { UL, LI, SPAN, DIV, TABLE, TBODY, THEAD, TFOOT, TR, TD, BUTTON, TEXTAREA } = Reps.DOM;

var PacketField = React.createFactory(React.createClass({
  displayName: "PacketField",

  getInitialState: function() {
    return {};
  },

  render: function() {
    var { open, label, cursor, actions, level, hasChildren } = this.props;

    var { edit, valid } = this.state;
    var { editorRawValue } = this.state;

    var value = cursor.deref();
    value = value && value.toJS ? value.toJS() : value;

    var content = [];

    var editorClassName = editorRawValue && !valid ? "invalid" : "valid";
    var valueStr = editorRawValue ? editorRawValue : JSON.stringify(value);
    var valueSummary = Reps.getRep(value)({ object: value });

    var valueEl = !edit ? valueSummary :
          TEXTAREA({ value: valueStr, onChange: this.onChange,
                     className: editorClassName, style: { width: '88%' } });

    content = content.concat([
      TD({ onClick: this.onToggleOpen,
           className: "memberLabelCell",
           style: { paddingLeft: 8 * level }
         },
         SPAN({ className: "memberLabel domLabel"}, label)),
      TD({ onDoubleClick: this.onDoubleClick,
           className: "memberValueCell" }, open ? "..." : valueEl)
    ]);

    var rowClassName = "memberRow domRow";

    if (hasChildren) {
      rowClassName += " hasChildren";
    }

    if (open) {
      rowClassName += " opened";
    }

    return (
      OverlayTrigger({
        ref: "popover", trigger: "manual", placement: "bottom",
        overlay: Popover({ title: label }, this.renderContextMenu())
      }, TR({ className: rowClassName }, content))
    );
  },

  onDoubleClick: function(evt) {
    this.props.actions.togglePopover(this.refs.popover);

    evt.stopPropagation();
  },

  renderContextMenu: function() {
    var cursor = this.props.cursor;
    var isCollection = (v) => v && (v instanceof Immutable.Map ||
                                    v instanceof Immutable.List);

    var value = cursor.deref();
    var buttons = [
      Button({ onClick: this.onToggleEdit,
               bsSize: "xsmall" }, this.state.edit ? "Save" : "Edit"),
      Button({ onClick: this.onRemoveFromParent,
                            bsSize: "xsmall" }, "Remove")
    ];

    if (isCollection(value)) {
      buttons.push(Button({ onClick: this.onAddNewChild,
                            bsSize: "xsmall" }, "Add New Child"));
    }

    return ButtonGroup({ }, buttons);
  },

  onAddNewChild: function(event) {
    var { actions, keyPath } = this.props;
    actions.addNewFieldInto(keyPath);
  },

  onRemoveFromParent: function(event) {
    var { actions, keyPath } = this.props;
    actions.removeFieldFromParent(keyPath);
  },

  onChange: function(event) {
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
    console.log("TOGGLE OPEN", this.props.keyPath);

    if (!this.props.hasChildren || this.state.edit) {
      return;
    }

    if (this.refs.popover) {
      this.refs.popover.hide();
    }

    this.props.actions.toggleOpen(this.props.keyPath);
    evt.stopPropagation();
  },
  onToggleEdit: function(event) {
    if (this.refs.popover) {
      this.refs.popover.hide();
    }

    var { value, edit, valid } = this.state;
    var { cursor } = this.props;

    if (edit && valid) {
      cursor.update(() => Immutable.fromJS(value));
    }
    this.setState({
      edit: !edit,
      value: edit ? cursor.deref() : null,
      editorRawValue: null
    });
  }

}));

/**
 * TODO docs
 */

var PackageEditorToolbar = React.createClass({
  displayName: "PackageEditorToolbar",

  render: function() {
    return ReactBootstrap.Navbar({fixedBottom: true, style: { minHeight: 36}}, [
      ReactBootstrap.Nav({}, [
        ReactBootstrap.ButtonToolbar({}, [
          ReactBootstrap.Button({ onClick: this.props.onSend,
                                  bsStyle: "primary", bsSize: "xsmall",
                                  style: { marginLeft: 12 } }, "Send"),

          ReactBootstrap.Button({ onClick: this.props.onUndo,
                                  className: "pull-right",
                                  bsStyle: "", bsSize: "xsmall",
                                  style: { marginRight: 6 } }, "Undo"),
          ReactBootstrap.Button({ onClick: this.props.onRedo,
                                  className: "pull-right",
                                  bsStyle: "", bsSize: "xsmall",
                                  style: { marginRight: 6 } }, "Redo"),

          ReactBootstrap.Button({ onClick: this.props.onClear,
                                  className: "pull-right",
                                  bsStyle: "", bsSize: "xsmall",
                                  style: { marginRight: 6 } }, "Clear")
        ]),
      ])
    ]);
  }
});

/**
 * TODO docs
 */

var ObserveReferenceMixin = {
  componentWillUnmount: function() {
    if (this._unobserve) {
      this._unobserve();
      this._unobserve = null;
    }
  },

  componentDidMount: function() {
    this._unobserve = this.props.reference.observe(this.onUpdatedReference);
  },

  getInitialState: function() {
    return {
      cursor: this.props.reference.cursor()
    };
  },

  onUpdatedReference: function() {
    console.log("UPDATED REFERENCE", this.props.reference.cursor().deref().toJS());
    this.setState({
      cursor: this.props.reference.cursor()
    });
  },
};

function nestedObjectToFlattenList(key, level, cursor, keyPath) {
  keyPath = keyPath || [];

  var data = cursor.deref();
  var res = [];
  var hasChildren = data instanceof Immutable.List ||
                    data instanceof Immutable.Map;

  if (level >= 0) {  // skip the fake root packet object level
    res.push({ key: key, level: level, cursor: cursor,
               keyPath: keyPath, hasChildren: hasChildren});
  }

  if (hasChildren) {
    data.forEach(function (value, subkey) {
      res = res.concat(nestedObjectToFlattenList(subkey, level + 1, cursor.cursor(subkey), keyPath.concat(subkey)));
    });
  }

  return res;
}

var PacketEditor = React.createClass({
  displayName: "PacketEditor",
  mixins: [ObserveReferenceMixin],

  render: function() {
    var rows = [];
    var { actions, reference } = this.props;
    var { cursor } = this.state;

    var packetCursor = cursor.cursor("packet");
    var openedKeyPaths = cursor.cursor("openedKeyPaths");

    nestedObjectToFlattenList("packet", -1, packetCursor)
      .forEach(function ({key, level, cursor, keyPath, hasChildren}) {
        var parentKeyPath = keyPath.slice(0,-1);
        if (level == 0 || openedKeyPaths.cursor(parentKeyPath).deref()) {
          rows.push(PacketField({ key: keyPath.join("-"), label: key, level: level,
                                  hasChildren: hasChildren, keyPath: keyPath,
                                  open: !!openedKeyPaths.cursor(keyPath).deref(),
                                  cursor: cursor, actions: actions }));
        }
    });

    return (
      DIV({}, [
        TABLE({
          className: "domTable", cellPadding: 0, cellSpacing: 0
        }, [TBODY({}, rows)] ),
        PackageEditorToolbar({
          onSend: this.onSend,
          onClear: this.onClear,
          onUndo: this.onUndo,
          onredo: this.onRedo
        })
      ])
    );
  },

  // Event Handlers
  onUndo: function(event) {
    this.props.actions.undo();
  },
  onRedo: function(event) {
    this.props.actions.redo();
  },

  onClear: function(event) {
    this.props.actions.clearPacket();
  },

  onSend: function(event) {
    var { actions, reference } = this.props;
    actions.sendPacket(reference.cursor("packet").deref().toJS());
  }
});

// Exports from this module
exports.PacketEditor = React.createFactory(PacketEditor);
});
