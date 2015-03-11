/* See license.txt for terms of usage */

define(function(require, exports, module) {

// Dependencies
const React = require("react");
const ReactBootstrap = require("react-bootstrap");
const { Reps } = require("reps/reps");

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
    var { label, cursor, actions } = this.props;

    var { open, edit, valid } = this.state;
    var { editorRawValue } = this.state;

    var value = cursor.deref();
    var keyStr = label + ": ";

    var content = [];

    if ((open && !edit) && !!value
        && (value instanceof Immutable.List ||
            value instanceof Immutable.Map)) {
      var childs = [];
      value.forEach(function (value, key) {
        var fieldCursor = cursor.cursor(key);
        childs.push(PacketField({ cursor: fieldCursor, key: key, label: key,
                                  inCollection: true,  actions: actions }));
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
      cursor.update(() => Immutable.fromJS(value));
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

var ObserveReferenceMixin = {
  componentWillUnmount: function() {
    if (this._unobserve) {
      this._unobserve();
      this._unobserve = null;
    }
  },

  componentDidMount: function() {
    this._unobserve = this.props.reference.observe(this.onUpdatedReference);
    this.onUpdatedReference();
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

var PacketEditor = React.createClass({
  displayName: "PacketEditor",
  mixins: [ObserveReferenceMixin],

  render: function() {
    var rows = [];
    var { actions, reference } = this.props;
    var { cursor } = this.state;
    var packet = cursor.deref();

    packet.forEach(function (value, key) {
      var fieldCursor = cursor.cursor(key);
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
    var { actions, reference } = this.props;
    actions.sendPacket(reference.cursor().deref().toJS());
  }
});

// Exports from this module
exports.PacketEditor = React.createFactory(PacketEditor);
});
