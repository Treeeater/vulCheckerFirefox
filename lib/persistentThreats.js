var ccc = require("./ccc");
var CONST = require("./const");
const {Cc,Ci,Cr} = require("chrome");
var vulStatus = {code_vul:false, referrer_vul:false, secret_in_body_vul:false};

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
exports.initPTCSWorker = function(worker) {
	worker.port.on('access_token_seen',function(res){
		if (res == "HTML") {
			vulStatus.secret_in_body_vul=true;
			ccc.log(ccc.siteToTest() + " is vulnerable to [5], user access_token visible in HTML content.", true);
		}
		else {
			vulStatus.referrer_vul=true;
			ccc.log(ccc.siteToTest() + " is vulnerable to [5], user access_token visible in URL as a 3rd-p referrer.", true);
		}
	});
	worker.port.on('code_seen',function(res){
		if (res == "HTML") {
			vulStatus.secret_in_body_vul=true;
			ccc.log(ccc.siteToTest() + " is vulnerable to [5], user code visible in HTML content.", true);
		}
		else {
			vulStatus.referrer_vul=true;
			ccc.log(ccc.siteToTest() + " is vulnerable to [5], user code visible in URL as a 3rd-p referrer.", true);
		}
	});
	worker.port.on('signed_request_seen',function(res){
		if (res == "HTML") {
			vulStatus.secret_in_body_vul=true;
			ccc.log(ccc.siteToTest() + " is vulnerable to [5], user signed_request visible in HTML content.", true);
		}
		else {
			vulStatus.referrer_vul=true;
			ccc.log(ccc.siteToTest() + " is vulnerable to [5], user signed_request visible in URL as a 3rd-p referrer.", true);
		}
	});
	
	if (ccc.capturingPhase()<=3 || ccc.capturingPhase()>5) return;			//too early or too late, no need to detect.
	worker.port.emit("detect",ccc.credentialsForPersistentThreats());
};

exports.vulStatus = function() {return vulStatus;};
exports.newTest = function() {vulStatus.code_vul=false; vulStatus.referrer_vul=false; vulStatus.secret_in_body_vul=false;};
exports.init = init;