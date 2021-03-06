/* See license.txt for terms of usage */

"use strict";

module.metadata = {
  "stability": "experimental"
};

const { Cu, Ci, Cc } = require("chrome");
const { Trace, TraceError } = require("../../core/trace.js").get(module.id);
const { Locale } = require("../../core/locale.js");
const { Str } = require("../../core/string.js");
const { StrEx } = require("../../core/string-ex.js");
const { Class } = require("sdk/core/heritage");
const { Events } = require("../../core/events.js");
const { Css } = require("../../core/css.js");
const { Dom } = require("../../core/dom.js");
const { Options } = require("../../core/options.js");
const { Win } = require("../../core/window.js");
const { emit } = require("sdk/event/core");

// DevTools
const { devtools } = Cu.import("resource://gre/modules/devtools/Loader.jsm", {});
const { Messages } = devtools["require"]("devtools/webconsole/console-output");
const { makeInfallible } = devtools["require"]("devtools/toolkit/DevToolsUtils.js");

// Domplate
const { Domplate } = require("../../core/domplate.js");
const { domplate, DIV, TAG, A, TABLE, TBODY, SPAN } = Domplate;
const { Rep } = require("../../reps/rep.js");
const { Reps } = require("../../reps/reps.js");
const { NetInfoHeaders } = require("./net-info-headers.js");
const { NetInfoPostData } = require("./net-info-post-data.js");
const { ResponseSizeLimit } = require("./response-size-limit.js");

/**
 * @rep
 */
const NetInfoBody = domplate(Rep,
{
  tag:
    DIV({"class": "netInfoBody", _repObject: "$object",
      onclick: "$onClickBody"},
      TAG("$infoTabs", {object: "$object"}),
      TAG("$infoBodies", {object: "$object"})
    ),

  infoTabs:
    DIV({"class": "netInfoTabs focusRow subFocusRow", "role": "tablist",
      onclick: "$onClickTab"},
      A({"class": "netInfoParamsTab netInfoTab a11yFocus", "role": "tab",
        $collapsed: "$object|hideParams",
        view: "Params"},
        Locale.$STR("xhrSpy.urlParameters")
      ),
      A({"class": "netInfoHeadersTab netInfoTab a11yFocus", "role": "tab",
        view: "Headers"},
        Locale.$STR("xhrSpy.headers")
      ),
      A({"class": "netInfoPostTab netInfoTab a11yFocus", "role": "tab",
          $collapsed: "$object|hidePost",
          view: "Post"},
          Locale.$STR("xhrSpy.post")
      ),
      A({"class": "netInfoResponseTab netInfoTab a11yFocus", "role": "tab",
        $collapsed: "$object|hideResponse",
        view: "Response"},
        Locale.$STR("xhrSpy.response")
      )
    ),

  infoBodies:
    DIV({"class": "netInfoBodies outerFocusRow"},
      TABLE({"class": "netInfoParamsText netInfoText netInfoParamsTable",
        "role": "tabpanel", cellpadding: 0, cellspacing: 0}, TBODY()),
      DIV({"class": "netInfoHeadersText netInfoText", "role": "tabpanel"}),
      DIV({"class": "netInfoPostText netInfoText", "role": "tabpanel"}),
      DIV({"class": "netInfoResponseText netInfoText", "role": "tabpanel"})
    ),

  customTab:
    A({"class": "netInfo$tabId\\Tab netInfoTab",
      view: "$tabId", "role": "tab"},
      "$tabTitle"
    ),

  // Custom Tabs

  customBody:
    DIV({"class": "netInfo$tabId\\Text netInfoText", "role": "tabpanel"}),

  appendTab: function(netInfoBody, tabId, tabTitle) {
    // Create new tab and body.
    var args = {
      tabId: tabId,
      tabTitle: tabTitle
    };

    this.customTab.append(args, netInfoBody.querySelector(".netInfoTabs"));
    this.customBody.append(args, netInfoBody.querySelector(".netInfoBodies"));
  },

  // Accessors

  hideResponse: function(file) {
    return false;
  },

  hideParams: function(file) {
    return !file.urlParams || !file.urlParams.length;
  },

  hidePost: function(file) {
    return !file.method || file.method.toUpperCase() != "POST";
  },

  // Event Handlers

  onClickBody: function(event) {
    Events.cancelEvent(event);
  },

  onClickTab: function(event) {
    let tab = Dom.getAncestorByClass(event.target, "netInfoTab");
    this.selectTab(tab);
  },

  selectTabByName: function(netInfoBody, tabName) {
    let tab = netInfoBody.querySelector(".netInfo" + tabName + "Tab");
    if (!tab) {
      return false;
    }

    this.selectTab(tab);
    return true;
  },

  selectTab: function(tab) {
    let netInfoBody = Dom.getAncestorByClass(tab, "netInfoBody");

    let view = tab.getAttribute("view");
    if (netInfoBody.selectedTab) {
      netInfoBody.selectedTab.removeAttribute("selected");
      netInfoBody.selectedText.removeAttribute("selected");
      netInfoBody.selectedTab.setAttribute("aria-selected", "false");
    }

    let textBodyName = "netInfo" + view + "Text";

    netInfoBody.selectedTab = tab;
    netInfoBody.selectedText = netInfoBody.getElementsByClassName(textBodyName).item(0);

    netInfoBody.selectedTab.setAttribute("selected", "true");
    netInfoBody.selectedText.setAttribute("selected", "true");
    netInfoBody.selectedTab.setAttribute("aria-selected", "true");

    let request = Reps.getRepObject(netInfoBody);
    this.updateInfo(netInfoBody, request);
  },

  // Update

  updateInfo: function(netInfoBody, file) {
    Trace.sysout("netInfoBody.updateInfo; " + file.actorId, file);

    // Update content of the selected tab.
    let tab = netInfoBody.selectedTab;
    if (tab.classList.contains("netInfoParamsTab")) {
      this.updateParams(netInfoBody, file, tab)
    } else if (tab.classList.contains("netInfoHeadersTab")) {
      this.updateHeaders(netInfoBody, file, tab);
    } else if (tab.classList.contains("netInfoResponseTab")) {
      this.updateResponse(netInfoBody, file, tab);
    } else if (tab.classList.contains("netInfoPostTab")) {
      this.updatePostData(netInfoBody, file, tab);
    }

    // Notify listeners about update so, content of custom tabs can be updated.
    emit(NetInfoBody, "updateTabBody", {
      netInfoBody: netInfoBody,
      file: file
    });
  },

  updateParams: function(netInfoBody, file, tab) {
    if (!netInfoBody.urlParamsPresented) {
      netInfoBody.urlParamsPresented = true;

      this.insertHeaderRows(netInfoBody, file.urlParams, "Params");
    }
  },

  /**
   * Render request/response/cached headers
   */
  updateHeaders: makeInfallible(function(netInfoBody, file, tab) {
    if (!netInfoBody.requestHeadersPresented) {
      netInfoBody.requestHeadersPresented = true;

      file.requestData("getRequestHeaders").then(response => {
        file.requestHeadersText = response.rawHeaders;
        file.requestHeaders = response.headers;

        let headersText = netInfoBody.querySelector(".netInfoHeadersText");
        NetInfoHeaders.renderHeaders(headersText, file.requestHeaders,
          "RequestHeaders");
      });
    }

    if (!netInfoBody.responseHeadersPresented) {
      netInfoBody.responseHeadersPresented = true;

      file.requestData("getResponseHeaders").then(response => {
        file.responseHeadersText = response.rawHeaders;
        file.responseHeaders = response.headers;

        let headersText = netInfoBody.querySelector(".netInfoHeadersText");
        NetInfoHeaders.renderHeaders(headersText, file.responseHeaders,
          "ResponseHeaders");
      });
    }
  }),

  updatePostData: function(netInfoBody, file, tab) {
    if (netInfoBody.postPresented) {
      return;
    }

    netInfoBody.postPresented = true;

    let postTextBox = netInfoBody.querySelector(".netInfoPostText");

    // Show warning if request/response post bodies are not tracked.
    if (file.discardResponseBody) {
      Dom.clearNode(postTextBox);
      let tag = SPAN({"class": "netInfoBodiesDiscarded"},
        Locale.$STR("xhrSpy.requestBodyDiscarded"))
      tag.append({}, postTextBox);
      return;
    }

    file.requestData("getRequestPostData").then(response => {
      file.postText = response.postData.text;
      NetInfoPostData.render(postTextBox, file);
    });
  },

  updateResponse: function(netInfoBody, file, tab) {
    if (netInfoBody.responsePresented) {
      return;
    }

    netInfoBody.responsePresented = true;

    let responseTextBox = netInfoBody.querySelector(".netInfoResponseText");

    // Show warning if response bodies are not tracked.
    if (file.discardResponseBody) {
      Dom.clearNode(responseTextBox);
      let tag = SPAN({"class": "netInfoBodiesDiscarded"},
        Locale.$STR("xhrSpy.responseBodyDiscarded"))
      tag.append({}, responseTextBox);
      return;
    }

    file.requestData("getResponseContent").then(response => {
      let text = response.content.text;
      let limit = Options.get("netDisplayedResponseLimit") + 15;
      let limitReached = text ? (text.length > limit) : false;

      if (limitReached) {
        text = text.substr(0, limit) + "...";
      }

      // Insert the response into the UI.
      if (text) {
        StrEx.insertWrappedText(text, responseTextBox);
      }
      else {
        StrEx.insertWrappedText("", responseTextBox);
      }

      // Append a message informing the user that the response
      // isn't fully displayed.
      if (limitReached) {
        let object = {
          text: Locale.$STR("xhrSpy.responseSizeLimitMessage"),
          onClickLink: function() {
            openResponseInTab(file);
          }
        };

        ResponseSizeLimit.append(object, responseTextBox);
      }
    });
  },

  // Rendering

  insertHeaderRows: function(netInfoBody, headers, tableName, rowName) {
    if (!headers.length) {
      return;
    }

    let headersTable = netInfoBody.querySelector(".netInfo" + tableName + "Table");
    let tbody = headersTable.querySelector(".netInfo" + rowName + "Body");
    if (!tbody) {
      tbody = headersTable.firstChild;
    }

    headers.sort(function(a, b) {
      return a.name > b.name ? 1 : -1;
    });

    let titleRow = tbody.querySelector(".netInfo" + rowName + "Title");
    NetInfoHeaders.headerDataTag.insertRows({headers: headers}, titleRow ? titleRow : tbody);

    Css.removeClass(titleRow, "collapsed");
  },
});

// Helpers
// xxxHonza: duplicated in NetUtils
var openResponseInTab = makeInfallible(request => {
  let response = request.content.text;
  let inputStream = Http.getInputStreamFromString(response);
  let stream = Cc["@mozilla.org/binaryinputstream;1"].
    createInstance(Ci.nsIBinaryInputStream);

  stream.setInputStream(inputStream);

  let encodedResponse = btoa(stream.readBytes(stream.available()));
  let dataUri = "data:" + file.request.contentType + ";base64," + encodedResponse;

  Win.openNewTab(dataUri);
});

// Exports from this module
exports.NetInfoBody = NetInfoBody;
