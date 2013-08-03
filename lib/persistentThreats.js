var ccc = require("./ccc");
var CONST = require("./const");
const {Cc,Ci,Cr} = require("chrome");
var vulStatus = {code_vul:false, referral_vul:false, secret_in_body_vul:false};

function TracingListener() {
    this.originalListener = null;
}

TracingListener.prototype =
{
    onDataAvailable: function(request, context, inputStream, offset, count)
    {
        this.originalListener.onDataAvailable(request, context,inputStream, offset, count);
    },

    onStartRequest: function(request, context) {
        this.originalListener.onStartRequest(request, context);
    },

    onStopRequest: function(request, context, statusCode)
    {
        this.originalListener.onStopRequest(request, context, statusCode);
    },

    QueryInterface: function (aIID) {
        if (aIID.equals(Ci.nsIStreamListener) ||
            aIID.equals(Ci.nsISupports)) {
            return this;
        }
        throw Cr.NS_NOINTERFACE;
    }
}

var httpRequestObserver =
{
    observe: function(aSubject, aTopic, aData)
    {
        if (aTopic == "http-on-examine-response")
        {	
			var gchannel = aSubject.QueryInterface(Ci.nsIHttpChannel)
			var url = gchannel.URI.spec;
			if (url.indexOf('https://graph.facebook.com/oauth/access_token')==0 && url.indexOf('client_secret')!=-1 && !vulStatus.code_vul) {
				//if there is EVER a visit to the above URL, this vulnerability exists.
				ccc.log(ccc.siteToTest() + " is vulnerable to [2], client secret seen.");
				ccc.log(ccc.siteToTest() + " is vulnerable to [2], client secret seen.",true);
				vulStatus.code_vul = true;
				return;
			}
        }
    },

    QueryInterface : function (aIID)
    {
        if (aIID.equals(Ci.nsIObserver) ||
            aIID.equals(Ci.nsISupports))
        {
            return this;
        }

        throw Cr.NS_NOINTERFACE;

    }
};

function init(){
	if ((ccc.detectionMode() & CONST.dm.code_vul) != 0) {
		var observerService = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
		observerService.addObserver(httpRequestObserver, "http-on-examine-response", false);
	}
}

exports.vulStatus = function() {return vulStatus;};
exports.newTest = function() {vulStatus.code_vul=false; vulStatus.referral_vul=false; vulStatus.secret_in_body_vul=false;};
exports.init = init;