/* See license.txt for terms of usage */

"use strict";

module.metadata = {
  "stability": "experimental"
};

const { Cu, Ci, Cc } = require("chrome");
const { Trace, TraceError } = require("../../core/trace.js").get(module.id);
const { Locale } = require("../../core/locale.js");
const { Options } = require("../../core/options.js");
const { Str } = require("../../core/string.js");
const { Http } = require("../../core/http.js");

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //

const mimeExtensionMap =
{
    "html": "text/html",
    "htm": "text/html",
    "xhtml": "text/html",
    "xml": "text/xml",
    "css": "text/css",
    "js": "application/x-javascript",
    "jss": "application/x-javascript",
    "jpg": "image/jpg",
    "jpeg": "image/jpeg",
    "gif": "image/gif",
    "png": "image/png",
    "bmp": "image/bmp",
    "woff": "application/font-woff",
    "ttf": "application/x-font-ttf",
    "otf": "application/x-font-otf",
    "swf": "application/x-shockwave-flash",
    "xap": "application/x-silverlight-app",
    "flv": "video/x-flv",
    "webm": "video/webm"
};

const mimeCategoryMap =
{
    // xxxHonza: note that there is no filter for 'txt' category,
    // shell we use e.g. 'media' instead?
    "text/plain": "txt",

    "application/octet-stream": "bin",
    "text/html": "html",
    "text/xml": "html",
    "application/rss+xml": "html",
    "application/atom+xml": "html",
    "application/xhtml+xml": "html",
    "application/mathml+xml": "html",
    "application/rdf+xml": "html",
    "text/css": "css",
    "application/x-javascript": "js",
    "text/javascript": "js",
    "application/javascript" : "js",
    "text/ecmascript": "js",
    "application/ecmascript" : "js", // RFC4329
    "image/jpeg": "image",
    "image/jpg": "image",
    "image/gif": "image",
    "image/png": "image",
    "image/bmp": "image",
    "application/x-shockwave-flash": "plugin",
    "application/x-silverlight-app": "plugin",
    "video/x-flv": "media",
    "audio/mpeg3": "media",
    "audio/x-mpeg-3": "media",
    "video/mpeg": "media",
    "video/x-mpeg": "media",
    "video/webm": "media",
    "video/mp4": "media",
    "video/ogg": "media",
    "audio/ogg": "media",
    "application/ogg": "media",
    "application/x-ogg": "media",
    "application/x-midi": "media",
    "audio/midi": "media",
    "audio/x-mid": "media",
    "audio/x-midi": "media",
    "music/crescendo": "media",
    "audio/wav": "media",
    "audio/x-wav": "media",
    "application/x-woff": "font",
    "application/font-woff": "font",
    "application/x-font-woff": "font",
    "application/x-ttf": "font",
    "application/x-font-ttf": "font",
    "font/ttf": "font",
    "font/woff": "font",
    "application/x-otf": "font",
    "application/x-font-otf": "font"
};

const requestProps =
{
    "allowPipelining": 1,
    "allowSpdy": 1,
    "canceled": 1,
    "channelIsForDownload": 1,
    "contentCharset": 1,
    "contentLength": 1,
    "contentType": 1,
    "forceAllowThirdPartyCookie": 1,
    "loadAsBlocking": 1,
    "loadUnblocked": 1,
    "localAddress": 1,
    "localPort": 1,
    "name": 1,
    "redirectionLimit": 1,
    "remoteAddress": 1,
    "remotePort": 1,
    "requestMethod": 1,
    "requestSucceeded": 1,
    "responseStatus": 1,
    "responseStatusText": 1,
    "status": 1,
};

var NetUtils =
{
    mimeExtensionMap: mimeExtensionMap,
    mimeCategoryMap: mimeCategoryMap,

    findHeader: function(headers, name)
    {
        if (!headers)
            return null;

        name = name.toLowerCase();
        for (var i = 0; i < headers.length; ++i)
        {
            var headerName = headers[i].name.toLowerCase();
            if (headerName == name)
                return headers[i].value;
        }
    },

    formatPostText: function(text)
    {
        if (text instanceof window.XMLDocument)
            return Xml.getElementXML(text.documentElement);
        else
            return text;
    },

    getPostText: function(file, noLimit)
    {
        if (!file.postText)
            return file.postText;

        var limit = Options.get("netDisplayedPostBodyLimit");
        if (limit !== 0 && file.postText.length > limit && !noLimit)
        {
            return Str.cropString(file.postText, limit,
                "\n\n... " + Locale.$STR("net.postDataSizeLimitMessage") + " ...\n\n");
        }

        return file.postText;
    },

    getResponseText: function(file)
    {
        return file.responseText;
    },

    matchesContentType: function(headerValue, contentType)
    {
        var contentTypes = (typeof contentType == "string" ? [contentType] : contentType);
        for (var i = 0; i < contentTypes.length; ++i)
        {
            // The header value doesn't have to match the content type exactly;
            // there can be a charset specified. So, test for a prefix instead.
            if (Str.hasPrefix(headerValue, contentTypes[i]))
                return true;
        }
        return false;
    },

    isURLEncodedRequest: function(file)
    {
        var text = NetUtils.getPostText(file);
        if (text && Str.hasPrefix(text.toLowerCase(), "content-type: application/x-www-form-urlencoded"))
            return true;

        var headerValue = NetUtils.findHeader(file.requestHeaders, "content-type");
        return (headerValue &&
            NetUtils.matchesContentType(headerValue, "application/x-www-form-urlencoded"));
    },

    isMultiPartRequest: function(file)
    {
        var text = NetUtils.getPostText(file);
        if (text && Str.hasPrefix(text.toLowerCase(), "content-type: multipart/form-data"))
            return true;
        return false;
    },

    getMimeType: function(mimeType, uri)
    {
        // Get rid of optional charset, e.g. "text/html; charset=UTF-8".
        // We need pure mime type so, we can use it as a key for look up.
        if (mimeType)
            mimeType = mimeType.split(";")[0];

        // If the mime-type exists and is known just return it...
        if (mimeType && mimeCategoryMap.hasOwnProperty(mimeType))
            return mimeType;

        // ... otherwise we need guess it according to the file extension.
        var ext = Url.getFileExtension(uri);
        if (!ext)
            return mimeType;

        var extMimeType = mimeExtensionMap[ext.toLowerCase()];
        return extMimeType ? extMimeType : mimeType;
    },

    openResponseInTab: function(file)
    {
        try
        {
            var response = NetUtils.getResponseText(file, this.context);
            var inputStream = Http.getInputStreamFromString(response);
            var stream = Xpcom.CCIN("@mozilla.org/binaryinputstream;1", "nsIBinaryInputStream");
            stream.setInputStream(inputStream);
            var encodedResponse = btoa(stream.readBytes(stream.available()));
            var dataURI = "data:" + file.request.contentType + ";base64," + encodedResponse;

            var tabBrowser = Firefox.getTabBrowser();
            tabBrowser.selectedTab = tabBrowser.addTab(dataURI);
        }
        catch (err)
        {
            if (FBTrace.DBG_ERRORS)
                FBTrace.sysout("net.openResponseInTab EXCEPTION", err);
        }
    },

    /**
     * Returns a content-accessible 'real object' that is used by 'Inspect in DOM Panel'
     * or 'Use in Command Line' features. Firebug is primarily a tool for web developers
     * and thus shouldn't expose internal chrome objects.
     */
    getRealObject: function(file, context)
    {
        var global = context.getCurrentGlobal();
        var clone = {};

        function cloneHeaders(headers)
        {
            var newHeaders = new global.Array();
            for (var i=0; headers && i<headers.length; i++)
            {
                var header = {name: headers[i].name, value: headers[i].value};
                header = Wrapper.cloneIntoContentScope(global, header);
                newHeaders.push(header);
            }
            return newHeaders;
        }

        // Iterate over all properties of the request object (nsIHttpChannel)
        // and pick only those that are specified in 'requestProps' list.
        var request = file.request;
        for (var p in request)
        {
            if (!(p in requestProps))
                continue;

            try
            {
                clone[p] = request[p];
            }
            catch (err)
            {
                // xxxHonza: too much unnecessary output
                //if (FBTrace.DBG_ERRORS)
                //    FBTrace.sysout("net.getRealObject EXCEPTION " + err, err);
            }
        }

        // Additional props from |file|
        clone.responseBody = file.responseText;
        clone.postBody = file.postBody;
        clone.requestHeaders = cloneHeaders(file.requestHeaders);
        clone.responseHeaders = cloneHeaders(file.responseHeaders);

        return Wrapper.cloneIntoContentScope(global, clone);
    },

    generateCurlCommand: function(file, addCompressedArgument)
    {
        var command = ["curl"];
        var ignoredHeaders = {};
        var inferredMethod = "GET";

        function escapeCharacter(x)
        {
            var code = x.charCodeAt(0);
            if (code < 256)
            {
                // Add leading zero when needed to not care about the next character.
                return code < 16 ? "\\x0" + code.toString(16) : "\\x" + code.toString(16);
            }
            code = code.toString(16);
            return "\\u" + ("0000" + code).substr(code.length, 4);
        }

        function escape(str)
        {
            // String has unicode characters or single quotes
            if (/[^\x20-\x7E]|'/.test(str))
            {
                // Use ANSI-C quoting syntax
                return "$\'" + str.replace(/\\/g, "\\\\")
                    .replace(/'/g, "\\\'")
                    .replace(/\n/g, "\\n")
                    .replace(/\r/g, "\\r")
                    .replace(/[^\x20-\x7E]/g, escapeCharacter) + "'";
            }
            else
            {
                // Use single quote syntax.
                return "'" + str + "'";
            }
        }

        // Create data
        var data = [];
        var postText = NetUtils.getPostText(file, true);
        var isURLEncodedRequest = NetUtils.isURLEncodedRequest(file, this.context);
        var isMultipartRequest = NetUtils.isMultiPartRequest(file, this.context);

        if (postText && isURLEncodedRequest || file.method == "PUT")
        {
            var lines = postText.split("\n");
            var params = lines[lines.length - 1];

            data.push("--data");
            data.push(escape(params));

            // Ignore content length as cURL will resolve this
            ignoredHeaders["Content-Length"] = true;

            inferredMethod = "POST";
        }
        else if (postText && isMultipartRequest)
        {
            data.push("--data-binary");
            data.push(escape(this.removeBinaryDataFromMultipartPostText(postText)));

            ignoredHeaders["Content-Length"] = true;
            inferredMethod = "POST";
        }

        // Add URL
        command.push(escape(file.href));

        // Fix method if request is not a GET or POST request
        if (file.method != inferredMethod)
        {
            command.push("-X");
            command.push(file.method);
        }

        // Add request headers
        // fixme: for multipart request, content-type should be omitted
        var requestHeaders = file.requestHeaders;
        var postRequestHeaders = Http.getHeadersFromPostText(file.request, postText);
        var headers = requestHeaders.concat(postRequestHeaders);
        for (var i=0; i<headers.length; i++)
        {
            var header = headers[i];

            if (header.name in ignoredHeaders)
                continue;

            command.push("-H");
            command.push(escape(header.name + ": " + header.value));
        }

        // Add data
        command = command.concat(data);

        // Add --compressed
        if (addCompressedArgument)
            command.push("--compressed");

        return command.join(" ");
    },

    removeBinaryDataFromMultipartPostText: function (postText)
    {
        var textWithoutBinaryData = "";

        var boundaryRe = /^--.+/gm;

        var boundaryString = boundaryRe.exec(postText)[0];

        var parts = postText.split(boundaryRe);

        var part;
        var contentDispositionLine;

        for (var i = 0; i<parts.length; i++)
        {
            part = parts[i];

            // The second line in a part holds the content disposition form-data
            contentDispositionLine = part.split("\r\n")[1];

            if (/^Content-Disposition: form-data/im.test(contentDispositionLine))
            {
                // filename= tells us that the form data is file input type
                if (/filename=/im.test(contentDispositionLine))
                {
                    // For file input parts
                    // Remove binary data. Only the Content-Disposition and Content-Type lines
                    // should remain.
                    textWithoutBinaryData += boundaryString
                        + part.match(/[\r\n]+Content-Disposition.+$[\r\n]+Content-Type.+$[\r\n]+/im).toString();
                }
                else
                {
                    textWithoutBinaryData += boundaryString + part;
                }
            }
        }

        textWithoutBinaryData += boundaryString + "--\r\n";

        return textWithoutBinaryData;
    }

};

exports.NetUtils = NetUtils;
