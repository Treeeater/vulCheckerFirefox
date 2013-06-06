var checkToken = require("./checkToken");
var file = require("file");
var profilePath = require("system").pathFor("ProfD");

//this is previously in utilities.js

var debug = true;
var IdPDomains = ["https://www.facebook.com/dialog/oauth", "https://www.facebook.com/dialog/permissions.request", "https://www.facebook.com/login.php"];
exports.IdPDomains = IdPDomains;
var excludedPattern = ['display=none'];
exports.excludedPattern = excludedPattern;
const {Cc,Ci,Cr} = require("chrome");
if (typeof CCIN == "undefined") {
	function CCIN(cName, ifaceName){
		return Cc[cName].createInstance(Ci[ifaceName]);
	}
}
if (typeof CCSV == "undefined") {
	function CCSV(cName, ifaceName){
		if (Cc[cName])
			// if fbs fails to load, the error can be _CC[cName] has no properties
			return Cc[cName].getService(Ci[ifaceName]); 
		else
			dumpError("CCSV fails for cName:" + cName);
	};
}
var window = Cc["@mozilla.org/appshell/appShellService;1"].getService(Ci.nsIAppShellService).hiddenDOMWindow;
var setTimeout = window.setTimeout;
var pressLoginButtonWorker;
var automateSSOWorker;
var testSuiteWorker;
var totalTabNo = 0;
var FBSDKDetermined = false;
var loginClickAttempts = 0;
var sendPressLoginButtonTimer;
var tryFindInvisibleLoginButton = false;
var sawDialogOAuth = false;

var log = function(str)
{
	if (debug) console.log(str);
}

if (typeof String.prototype.startsWith != 'function') {
	String.prototype.startsWith = function (str){
		return this.indexOf(str) == 0;
	};
}

var checkAgainstFilter = function(url, capturingPhase)
{
	var i = 0;
	if (capturingPhase == 0 || capturingPhase == 1 || capturingPhase == 4 || capturingPhase == 6 || capturingPhase == 7 || capturingPhase == 10){
		for (; i < capturingURLs.length; i++)
		{
			if (url == capturingURLs[i]) {
				return true;
			}
		}
		return false;
	}
	else if (capturingPhase == 2 || capturingPhase == 8 || ((capturingPhase == 3 || capturingPhase == 9) && usedFBSDK)){
		//check idp domains and excluded patterns
		for (i = 0; i < excludedPattern.length; i++)
		{
			if (url.indexOf(excludedPattern[i])!=-1) {
				return false;
			}
		}
		for (i = 0; i < IdPDomains.length; i++)
		{
			if (url.startsWith(IdPDomains[i])) {
				return true;
			}
		}
		return false;
	}
	else if (!usedFBSDK && redirectDomain != "" && (capturingPhase == 3 || capturingPhase == 9))
	{
		//we also need to account for visits to redirectDomain
		if (url.startsWith(redirectDomain)) {
			return true;
		}
	}
	return false;
}

var removeByHeuristics = function (suspects){
	for (var i = suspects.length - 1; i >= 0 ; i--)
	{
		if (suspects[i].startsWith('__utm')) suspects.splice(i,1);
	}
	return suspects;
}

var trafficRecord = function(){
	this.url = "";
	this.anonymousSessionRequest = {};
	this.anonymousSessionResponse = {};
	this.anonymousSessionRequest2 = {};
	this.anonymousSessionResponse2 = {};
	this.facebookDialogOAuthRequest = {};
	this.facebookDialogOAuthResponse = {};
	this.authenticatedSessionRequest = {};
	this.authenticatedSessionResponse = {};
	this.authenticatedSessionRequest2 = {};
	this.authenticatedSessionResponse2 = {};
	return this;
}

var RequestRecord = function(){
	this.cookies = "";
	this.postDATA = "";
	this.url = "";
}

var ResponseRecord = function(){
	this.setCookies = "";
	this.body = "";
	this.url = "";
}

var deleteCookies = function(){
	Cc["@mozilla.org/cookiemanager;1"].getService(Ci.nsICookieManager).removeAll();
}

function getWindowForRequest(request)
//request is aSubject param in observerservice
{
  if (request instanceof Ci.nsIRequest)
  {
    try
    {
      if (request.notificationCallbacks)
      {
        return request.notificationCallbacks
                      .getInterface(Ci.nsILoadContext)
                      .associatedWindow;
      }
    } catch(e) {}

    try
    {
      if (request.loadGroup && request.loadGroup.notificationCallbacks)
      {
        return request.loadGroup.notificationCallbacks
                      .getInterface(Ci.nsILoadContext)
                      .associatedWindow;
      }
    } catch(e) {}
  }

  return null;
}

function fileNameSanitize(str)
{
	return str.replace(/[^a-zA-Z]*/g,"").substr(0,32)+".txt";
}
//-------------------------------------end utilities.js-----------


var token_url = "https://www.facebook.com/dialog/oauth/?client_id=265286580246983&redirect_uri=http://chromium.cs.virginia.edu/test.php&scope=email&response_type=token";
var code_url = "https://www.facebook.com/dialog/oauth/?client_id=265286580246983&redirect_uri=http://chromium.cs.virginia.edu/test.php&scope=email&response_type=code";
var code_for_token_url = "https://graph.facebook.com/oauth/access_token?client_id=265286580246983&redirect_uri=http://chromium.cs.virginia.edu/test.php&client_secret=30d36a8bea17b5307cf8dd167e32c0a2&code="
var signed_request_url = "";
var old_token = "CAADxRthhGccBAMnmKEYGr0MaZCeUkIbvPkb92BUSCuAenpWtQBC9UvUqWud1G91gPTcmGlRyNhc1eIf3Ino3DXUBm31QXFZBma0TZAgCdd17keiJZACRFwHOKD5FoLuvxYknZBOvpZAZAHKe4xujCPH";
var old_code = "";
var old_signed_request = "";
var siteToTest = "";
var domainToTest = "";
var capturingURLs = [];						//urls to look for in the sea of requests.
var capturingPhase = -1;
var bufferedRequests = {};					//used to store freshly captured requests
var bufferedResponses = {};
var responseTextContent = [];				//index: FBAccount
var storageRecord = {};						//used by processing functions to dump buffered requests to 'more persistent and managed records'.
var loginButtonClicked = false;				//used to indicate whether login button has been clicked.
var SSOAutomationStarted = false;			//used to indicate whether SSOAutomation has started.
var testTab;								//reference to the tab that's being used to test.
var FBAccount = 1;
var usedFBSDK = true;						//used to indicate if the site used FB SDK or not. If true, the redirect_uri parameter when calling dialog/oauth is set to http(s)://(s-)static.ak.facebook.com/connect/xd_arbiter.php?xxxx; otherwise it is customized to its own domain.
//https%3A%2F%2Fs-static.ak.facebook.com%2Fconnect%2Fxd_arbiter.php
var redirectDomain = "";					//if the website doesn't use FBSDK, this stores its redirect_uri parameter.
var loginButtonXPath = "";
var loginButtonOuterHTML = "";
var networkFailure = false;

function testSuitePhase1(url){
	//Getting initial anonymous session headers data.
	//capturingPhase == 1 will trigger this.
	log('Phase 1 - recorded anonymous header data');
	var tempRecord = new trafficRecord();
	tempRecord.url = siteToTest;
	tempRecord.anonymousSessionRequest = bufferedRequests[url];
	tempRecord.anonymousSessionResponse = bufferedResponses[url];
	storageRecord[siteToTest] = tempRecord;
	capturingPhase++;
}

function testSuitePhase2(url){
	//Clicked on the facebook login button and https://www.facebook.com/dialog/oauth/ is visited.
	//capturingPhase == 2 will trigger this.
	log('Phase 2 - https://www.facebook.com/dialog/oauth/ request header and url captured for session A');
	storageRecord[siteToTest].facebookDialogOAuthRequest = bufferedRequests[url];
	capturingPhase++;
	loginClickAttempts = 0;
}

function testSuitePhase3(url){
	//After visit to https://www.facebook.com/dialog/oauth/, this function is called when subsequent visit to https://www.facebook.com/dialog/oauth/read or write or permissions.request happens.
	if (bufferedResponses[url].body.substr(0,42)=='<script type="text/javascript">var message' && usedFBSDK)
	{
		log('Phase 3 - captured FB OAuth response');
		storageRecord[siteToTest].facebookDialogOAuthResponse = bufferedResponses[url];
		capturingPhase++;
		setTimeout(delayRefreshTestTab,10000);			//after 10 seconds, refresh the homepage.
	}
	else if (!usedFBSDK)
	{
		log('Phase 3 - captured FB OAuth response');
		storageRecord[siteToTest].facebookDialogOAuthResponse = bufferedRequests[url];			//Counter-intuitive here: it's not a bug, OAuthResponse stores whatever outcome the OAuth protocol is, not necessarily a literal response!
		capturingPhase++;
		setTimeout(delayRefreshTestTab,10000);			//after 10 seconds, refresh the homepage.
	}
}

function testSuitePhase4(url){
	//Getting authenticated session headers data.
	//capturingPhase == 4 will trigger this.
	log('Phase 4 - recorded account A header data');
	storageRecord[siteToTest].authenticatedSessionRequest = bufferedRequests[url];
	storageRecord[siteToTest].authenticatedSessionResponse = bufferedResponses[url];
	capturingPhase++;
	setTimeout(checkLoginButtonRemoved, 10000);
}

function delayRefreshTestTab()
{
	//This function is only invoked when the site uses javascript (as opposed to reloading) to manipulate after user logs in.
	//capturingPhase == 4 || 10 will trigger this.
	if (capturingPhase == 4 || capturingPhase == 10) {
		try{testSuiteWorker.port.emit("action",{"action": "navigateTo", "site":siteToTest});} catch(ex){console.log("testSuiteWorker phase 4 hidden frame error");}
	}
}

function checkLoginButtonRemoved(){
	try{pressLoginButtonWorker.port.emit("action", "sendLoginButtonInformation");} catch(ex){console.log("pressloginworker hidden frame error");}
}

function revisitSiteAnonymously(){	
	if (capturingPhase != 5) return;
	//capturingPhase == 5 will trigger this.
	log('Phase 5 - deleting cookies and revisit the test site for a second time');
	deleteCookies();
	capturingPhase++;
	try{testSuiteWorker.port.emit("action",{"action": "navigateTo", "site":siteToTest});} catch(ex){console.log("testsuiteworker hidden frame error");}
}

function testSuitePhase7(url){
	//capturingPhase == 7 will trigger this.
	log('Phase 7 - recorded anonymous header data for a second time');
	storageRecord[siteToTest].anonymousSessionRequest2 = bufferedRequests[url];
	storageRecord[siteToTest].anonymousSessionResponse2 = bufferedResponses[url];
	capturingPhase++;
}

function testSuitePhase8(url){
	//Clicked on the facebook login button and https://www.facebook.com/dialog/oauth/ is visited.
	//capturingPhase == 8 will trigger this.
	log('Phase 8 - For session B we saw visit to https://www.facebook.com/dialog/oauth/, but we do not need to capture this time.');
	capturingPhase++;
	loginClickAttempts = 0;				//reset login click attempts
}

function testSuitePhase9(url){
	//After visit to https://www.facebook.com/dialog/oauth/, this function is called when subsequent visit to https://www.facebook.com/dialog/oauth/read or write or permissions.request happens.
	if (bufferedResponses[url].body.substr(0,42)=='<script type="text/javascript">var message' && usedFBSDK)
	{
		log('Phase 9 - captured FB OAuth response for session B');
		storageRecord[siteToTest].facebookDialogOAuthResponse = bufferedResponses[url];
		capturingPhase++;
		setTimeout(delayRefreshTestTab,10000);			//after 10 seconds, refresh the homepage.
	}
	else if (!usedFBSDK)
	{
		log('Phase 9 - captured FB OAuth response for session B');
		storageRecord[siteToTest].facebookDialogOAuthResponse = bufferedRequests[url];			//Counter-intuitive here: it's not a bug, OAuthResponse stores whatever outcome the OAuth protocol is, not necessarily a literal response!
		capturingPhase++;
		setTimeout(delayRefreshTestTab,10000);			//after 10 seconds, refresh the homepage.
	}
}

function extractContent(){
	try{testSuiteWorker.port.emit("action",{"action":"extractContent"});} catch(ex){console.log("testSuiteworker hidden frame error");}
}

function testSuitePhase10(url){
	//capturingPhase == 10 will trigger this.
	log('Phase 10 - recorded account B header data');
	storageRecord[siteToTest].authenticatedSessionRequest2 = bufferedRequests[url];
	storageRecord[siteToTest].authenticatedSessionResponse2 = bufferedResponses[url];
	setTimeout(extractContent, 10000);
	capturingPhase++;
}

function saveToFile(fileName, content)
{
	fileName = fileNameSanitize(fileName);
	var filePath = file.join(profilePath, "testResults", fileName);					//Note: if testResults folder doesn't exist in the profile folder, the extension halts! So always create the folder before execution.
	var writer = file.open(filePath, "w");
	writer.writeAsync(content, function(error)
	{
		if (error){
			console.log("Error in writing to file: " + error);
		}
		else{
			console.log("Success in writing to file!");
		}
		if (!writer.closed){
			writer.close();
		}
	});
}

function processBuffer(url)
{
	//Phase 0: onload event fired on first visit to test page, anonymous session 1.
	//Phase 1: headers received on second visit to test page, anonymous session 1.
	if (capturingPhase == 1 && checkAgainstFilter(url, capturingPhase))
	{
		//visit the page for the second time, anonymous session 1.
		testSuitePhase1(url);
		FBAccount = 1;
		return;
	}
	//Phase 2: headers received on FB login SSO page.
	if (capturingPhase == 2 && checkAgainstFilter(url, capturingPhase) && loginButtonClicked && sawDialogOAuth)
	{
		testSuitePhase2(url);
		sawDialogOAuth = false;
		return;
	}
	//Phase 3: saw response from FB SSO process for session A.
	if (capturingPhase == 3 && checkAgainstFilter(url, capturingPhase) && loginButtonClicked)
	{
		testSuitePhase3(url);
		return;
	}
	//Phase 4: headers received on first visit to test page, authenticated session A.
	if (capturingPhase == 4 && checkAgainstFilter(url, capturingPhase))
	{
		//visit the page with authenticated cookies
		loginButtonClicked = false;				//set it up for the next authenticated session visit.
		testSuitePhase4(url);
		return;
	}
	//Phase 5: From 5 seconds after Phase 4. Delete all cookies and revisit the test page. Not triggered by an event.
	//Phase 6: onload event fired on first visit to test page, anonymous session 2.
	//Phase 7: headers received on second visit to test page, anonymous session 2.
	if (capturingPhase == 7 && checkAgainstFilter(url, capturingPhase))
	{
		//revisit the page without cookies
		testSuitePhase7(url);
		FBAccount = 2;
		return;
	}
	//Phase 8: onload event fired on FB login SSO page for account B.
	if (capturingPhase == 8 && checkAgainstFilter(url, capturingPhase) && loginButtonClicked && sawDialogOAuth)
	{
		testSuitePhase8(url);
		sawDialogOAuth = false;
		return;
	}
	//Phase 9: saw response from FB SSO process for session B.
	if (capturingPhase == 9 && checkAgainstFilter(url, capturingPhase) && loginButtonClicked)
	{
		testSuitePhase9(url);
		return;
	}
	//Phaes 10: headers received on first visit to test page, authenticated session B.
	if (capturingPhase == 10 && checkAgainstFilter(url, capturingPhase))
	{
		//after clicking login button, enter different credential and receive headers.
		loginButtonClicked = false;				//set it up for the next authenticated session visit.
		testSuitePhase10(url);
		return;
	}
}

function processLoaded(url){
	if (capturingPhase == 0 && checkAgainstFilter(url, capturingPhase))
	{
		//first visit done
		log('Phase 0 - done loading anonymously the first time.');
		setTimeout( function(){capturingPhase++;try{testSuiteWorker.port.emit("action",{"action": "navigateTo", "site":siteToTest});} catch(ex){console.log("testSuiteWorker hidden frame error");}}, 2000);
		return;
	}
	if (capturingPhase == 6 && checkAgainstFilter(url, capturingPhase))
	{
		//second visit done
		log('Phase 6 - done loading anonymously the second time.');
		setTimeout( function(){capturingPhase++;try{testSuiteWorker.port.emit("action",{"action": "navigateTo", "site":siteToTest});} catch(ex){console.log("testSuiteworker hidden frame error");}}, 2000);
		return;
	}
	capturingPhase = checkToken.processLoaded(url);			//access_token vulnerability
}



//Traffic interceptors.



/*
//This function works, just pass in aSubject.
var readPostTextFromRequest = function(request) {
	this.readFromStream = function(stream, charset, noClose) {

	    var sis = CCSV("@mozilla.org/binaryinputstream;1", 
                            "nsIBinaryInputStream");
	    sis.setInputStream(stream);

	    var segments = [];
	    for (var count = stream.available(); count; count = stream.available())
	        segments.push(sis.readBytes(count));

	    if (!noClose)
	        sis.close();

	    var text = segments.join("");
	    return text;
	};
	try
	{
		var is = request.QueryInterface(Ci.nsIUploadChannel).uploadStream;
		if (is)
		{
			var ss = is.QueryInterface(Ci.nsISeekableStream);
			var prevOffset;
			if (ss)
			{
				prevOffset = ss.tell();
				ss.seek(Ci.nsISeekableStream.NS_SEEK_SET, 0);
			}

			// Read data from the stream..
		var charset = "UTF-8";
		var text = this.readFromStream(is, charset, true);
			console.log(text);

			if (ss && prevOffset == 0)
				ss.seek(Ci.nsISeekableStream.NS_SEEK_SET, 0);

			return text;
		}
	else {
		console.log("Failed to Query Interface for upload stream.\n");
	}
	}
	catch(exc)
	{
	}

	return null;
};
*/

var observerService = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);

observerService.addObserver({
    observe: function(aSubject, aTopic, aData) {
		if ("http-on-modify-request" == aTopic) {
			var gchannel = aSubject.QueryInterface(Ci.nsIHttpChannel)
			var url = gchannel.URI.spec;
			if (!checkAgainstFilter(url, capturingPhase)) return;									//this filters lots of urls.
			//--------This is the url of interest, we should start recording here--------------
			var postDATA = "";
			var cookies = "";
			var requestRecord = new RequestRecord();
			requestRecord.url = url;
			try {cookies = gchannel.getRequestHeader("cookie");} catch(e){}						//this creates lots of errors if not caught
			requestRecord.cookies = cookies;
			//console.log(url);
			//console.log(cookies);
			if (gchannel.requestMethod == "POST")
			{
				//console.log(readPostTextFromRequest(gchannel));
				var channel = gchannel.QueryInterface(Ci.nsIUploadChannel).uploadStream;  
				var prevOffset = channel.QueryInterface(Ci.nsISeekableStream).tell();
				channel.QueryInterface(Ci.nsISeekableStream).seek(Ci.nsISeekableStream.NS_SEEK_SET, 0);  
				var stream = Cc["@mozilla.org/binaryinputstream;1"].createInstance(Ci.nsIBinaryInputStream);  
				stream.setInputStream(channel);  
				var postBytes = stream.readByteArray(stream.available());  			//this is going to mess up with POST action.
				poststr = String.fromCharCode.apply(null, postBytes);  
				
				//This is a workaround that sometimes the POST data contains Content-type and Content-length header.
				//This here may cause a bug, as we are simply discarding all \ns and get the last segment.
				var splitted = poststr.split('\n');									
				poststr = splitted[splitted.length-1];
				requestRecord.postDATA = poststr;
				//console.log("POSTDATA is: "+poststr);
				
				channel.QueryInterface(Ci.nsISeekableStream).seek(Ci.nsISeekableStream.NS_SEEK_SET, prevOffset);
				//This following may alter post data.
				//var inputStream = Cc["@mozilla.org/io/string-input-stream;1"].createInstance(Ci.nsIStringInputStream);
				//inputStream.setData(poststr, poststr.length); 
				//var uploadChannel = gchannel.QueryInterface(Ci.nsIUploadChannel);
				//uploadChannel.setUploadStream(inputStream, "application/x-www-form-urlencoded", -1);
				//uploadChannel.requestMethod = "POST";
			}
			bufferedRequests[url] = requestRecord;
		}
    }
}, "http-on-modify-request", false);


function TracingListener() {
    this.originalListener = null;
	this.receivedData = [];
	this.setCookieHeader = "";
}

TracingListener.prototype =
{
    onDataAvailable: function(request, context, inputStream, offset, count)
    {
        var binaryInputStream = CCIN("@mozilla.org/binaryinputstream;1",
                "nsIBinaryInputStream");
        var storageStream = CCIN("@mozilla.org/storagestream;1", "nsIStorageStream");
        var binaryOutputStream = CCIN("@mozilla.org/binaryoutputstream;1",
                "nsIBinaryOutputStream");

        binaryInputStream.setInputStream(inputStream);
        storageStream.init(8192, count, null);
        binaryOutputStream.setOutputStream(storageStream.getOutputStream(0));

        // Copy received data as they come.
        var data = binaryInputStream.readBytes(count);
        this.receivedData.push(data);
				
		//to modify response, modify the variable 'data' above. The next statement is going to write data into outputStream and then pass it to the next listener (and eventually the renderer).
        binaryOutputStream.writeBytes(data, count);

        this.originalListener.onDataAvailable(request, context,
            storageStream.newInputStream(0), offset, count);
    },

    onStartRequest: function(request, context) {
        this.originalListener.onStartRequest(request, context);
    },

    onStopRequest: function(request, context, statusCode)
    {
        // Get entire response
        var responseBody = this.receivedData.join();
		var url = request.URI.spec;										//request.URI means the current URI (after 302 redirect)
		//if (capturingPhase == 2 || capturingPhase == 8) url = request.originalURI.spec;		//request.originalURI means the first URI (before 302 redirect)
		//For FB, oauth/dialog API is the original URI.
		//Note: originalURI at observe function (outside of this) needs to be URI, not originalURI, lol.
		if (checkAgainstFilter(url, capturingPhase))
		{
			var responseRecord = new ResponseRecord();
			responseRecord.url = url;
			responseRecord.body = responseBody.substr(0,1500);				//now only record 1500 characters
			responseRecord.setCookies = this.setCookieHeader;
			bufferedResponses[url] = responseRecord;
			processBuffer(url);
		}
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
			if (checkAgainstFilter(url, capturingPhase)){
				//if (true){
				if (url.startsWith("https://www.facebook.com/dialog/oauth") && !FBSDKDetermined){
					FBSDKDetermined = true;
					if (url.indexOf("static.ak.facebook.com")==-1) 
					{
						log('This site does NOT use FB SDK');
						usedFBSDK = false;
						if (redirectDomain=="")
						{
							redirectDomain = url.substr(url.indexOf('redirect_uri='),url.length);
							if (redirectDomain.indexOf('&')!=-1)
							{
								redirectDomain = decodeURIComponent(redirectDomain.substr(13,redirectDomain.indexOf('&')-13));
							}
							else
							{
								redirectDomain = decodeURIComponent(redirectDomain.substr(13,redirectDomain.length));
							}
							var protocol = redirectDomain.substr(0,redirectDomain.indexOf('/')) + "//";
							redirectDomain = redirectDomain.substr(redirectDomain.indexOf('/')+2,redirectDomain.length);
							redirectDomain = redirectDomain.substr(0,redirectDomain.indexOf('/'));
							redirectDomain = protocol + redirectDomain;
							//above is a workaround on FB's decode URI function differs from JS's decodeURIComponent function. It abandons the tail of the URL.
						}
						log('the redirect domain is: '+redirectDomain);
					}
					else {
						usedFBSDK = true;
						log('This site uses FB SDK');
					}
				}
				//need to check dialog oauth existence to allow capturingPhase to grow to 3/9
				if (url.startsWith("https://www.facebook.com/dialog/oauth")) {
					sawDialogOAuth = true;
				}
				var newListener = new TracingListener();
				try {newListener.setCookieHeader = gchannel.getResponseHeader('Set-Cookie');} catch(ex){};		//stupid FF sliently fails if no set-cookie header is present in a response header, STUPID!  This is a workaround.
				aSubject.QueryInterface(Ci.nsITraceableChannel);
				newListener.originalListener = aSubject.setNewListener(newListener);
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

observerService.addObserver(httpRequestObserver, "http-on-examine-response", false);



function sendPressLoginButton(response){
	var shouldClick = (capturingPhase == 2 || capturingPhase == 8);
	shouldClick = shouldClick || checkToken.shouldClickLoginButton();
	if (shouldClick) {
		loginButtonClicked = true;
		if (loginClickAttempts > 2) {
			if (tryFindInvisibleLoginButton){
				log("Too many attempts (>2) to click login button and still haven't seen FB traffic, probably failed to locate login button."); 
				return;
			}
			else {
				startOver();
				tryFindInvisibleLoginButton = true;
				capturingPhase = 0;
				console.log("trying to switch to detecting invisible button mode.");
				try {testSuiteWorker.port.emit("action",{"action": "navigateTo", "site":siteToTest});} catch(ex){console.log("testSuiteWorker hidden frame error");}
				return;
			}
		}
		loginClickAttempts++;
		try {pressLoginButtonWorker.port.emit("pressedLoginButton",{"shouldClick":shouldClick, "tryFindInvisibleLoginButton":tryFindInvisibleLoginButton});} catch(ex){console.log("pressLoginButtonWorker hidden frame error");}
		sendPressLoginButtonTimer = setTimeout(sendPressLoginButton,10000);			//delay should be large enough to let the page load.
	}
}

//exports
exports.initPressLoginButton = function(worker){

	if (worker.tab.i == undefined)
	{
		totalTabNo++;
		worker.tab.i = totalTabNo;
		if (worker.tab.i == 1)
		{
			testSuiteWorker = worker;
		}
		else return;
	}
	else{
		if (worker.tab.i == 1)
		{
			testSuiteWorker = worker;
		}
		else return;
	}
	pressLoginButtonWorker = worker;
	//listen to events
	pressLoginButtonWorker.port.on("loginInfo",function(info){
			if (loginButtonOuterHTML == "") {
				loginButtonOuterHTML = info.loginButtonOuterHTML;		//only record the first time we press the login button.
				log(loginButtonOuterHTML);
			}
			if (loginButtonXPath == "") 
			{
				loginButtonXPath = info.loginButtonXPath;					//only record the first time we press the login button.
				log(loginButtonXPath);
			}
			try { pressLoginButtonWorker.port.emit("readyToClick","readyToClick");} catch(ex){console.log("pressLoginButtonWorker hidden frame error");}
		}
	);
	pressLoginButtonWorker.port.on("pressedLoginButton", sendPressLoginButton);
	pressLoginButtonWorker.port.on("checkTestingStatus", function(response){
		if (sendPressLoginButtonTimer) window.clearTimeout(sendPressLoginButtonTimer);			//this happens when a new page loads. When this happens, we want to clear the old timer, and try to click the login button in this new page.
		var shouldClick = (capturingPhase == 2 || capturingPhase == 8);
		shouldClick = shouldClick || checkToken.shouldClickLoginButton();
		try {if (shouldClick) pressLoginButtonWorker.port.emit("checkTestingStatus",{"shouldClick":shouldClick});} catch(ex){console.log("pressLoginButtonWorker hidden frame error");}
	});
	pressLoginButtonWorker.port.on("sendLoginButtonInformation", function(response){
		console.log(response.loginButtonXPath);
		console.log(loginButtonXPath);
		if (response.loginButtonXPath == loginButtonXPath && response.loginButtonOuterHTML == loginButtonOuterHTML) {
			log("login failed! After logging in the login button is still present!")
			return;
		}
		log("login successful!, log in button different from anonymous session.");
		
		try{ testSuiteWorker.port.emit("action",{"action":"extractContent"});} catch(ex){console.log("testSuiteWorker hidden frame error");}
	});
};

exports.initAutomateSSOWorker = function(worker){
	automateSSOWorker = worker;
	automateSSOWorker.port.on("requestFBAccount",function(){
		automateSSOWorker.port.emit("requestFBAccount",FBAccount);
	});
	/*automateSSOWorker.port.on("unloadedURL",function(url){
		if (url != undefined) processUnLoad(url);
	});*/
}

exports.initTestSuiteWorker = function(worker){
	if (typeof worker.tab.i == "undefined")
	{
		totalTabNo++;
		worker.tab.i = totalTabNo;
		if (worker.tab.i == 1)
		{
			testSuiteWorker = worker;
		}
		else return;
	}
	else{
		if (worker.tab.i == 1)
		{
			testSuiteWorker = worker;
		}
		else return;
	}
	testSuiteWorker.port.on("loadedURL",function(url){
		if (url != undefined) processLoaded(url);
	});
	testSuiteWorker.port.on("siteToTest", function(site) {
		siteToTest = site;
		capturingURLs.push(siteToTest);
		
		var temp = siteToTest.substr(siteToTest.indexOf(':')+3,siteToTest.length) + '/';
		temp = temp.substr(0,temp.indexOf('/'));
		while ((temp.match(/\./g)||[]).length>1)
		{
			temp = temp.substr(temp.indexOf('.')+1, temp.length);
		}
		domainToTest = temp;
		
		try{testSuiteWorker.port.emit("action", {"site": siteToTest, "action": "navigateTo"});} catch(ex){console.log("testSuiteWorker hidden frame error");}
	});
	testSuiteWorker.port.on("extractedContent", function(response){
		responseTextContent[FBAccount] = response;
		if (FBAccount == 1){
			console.log("Recorded extracted content from session 1.");
			revisitSiteAnonymously();
		}
		else if (FBAccount == 2){
			console.log("Phase 11: recorded extracted content from session 2, ready to evaluate for access_token vulnerability.");
			capturingPhase++;
			checkToken.init();
		}
	});
}

exports.deleteCookies = deleteCookies;

exports.check_and_redo_credentials = function () {
	var tabs = require("sdk/tabs");
	
	tabs.open({url: token_url, inNewWindow: true});
	tabs.on('open', function(tab){
		tab.on('ready', function(tab){
			if (tab.url.startsWith("http://chromium.cs.virginia.edu/test.php"))
			{
				var temp = tab.url;
				old_token = temp.substr(temp.indexOf("=")+1, temp.indexOf("&") - temp.indexOf("=") - 1);
				console.log(old_token);
				window.setTimeout(function(){tab.close();},500);			//to workaround the ff jetpack error.
			}
		});
	});
}

exports.testSuiteStart = function(worker){
	startOver();
	capturingPhase++;
	//user clicked on start test suite button, we get his/her input and navigate to that site.
	worker.port.emit("action",{"action": "testSuiteStart","site":""});
}

exports.saveToFile = saveToFile;
exports.debug = function(){return debug;};
exports.siteToTest = function(){return siteToTest;};
exports.storageRecord = function(){return storageRecord;};
exports.responseTextContent = function(){return responseTextContent;};
exports.testSuiteWorker = function(){return testSuiteWorker;};
exports.automateSSOWorker = function(){return automateSSOWorker;};
exports.pressLoginButtonWorker = function(){return pressLoginButtonWorker;};
exports.capturingPhase = function(){return capturingPhase;};
exports.capturingURLs = function(){return capturingURLs;};
exports.loginButtonXPath = function(){return loginButtonXPath;};
exports.loginButtonOuterHTML = function(){return loginButtonOuterHTML;};
exports.usedFBSDK = function(){return usedFBSDK;};
exports.redirectDomain = function(){return redirectDomain;};
exports.loginButtonClicked = function(){return loginButtonClicked;};
exports.old_token = function(){return old_token;};
exports.setCapturingPhase = function(p){capturingPhase = p; return;};
exports.setFBAccount = function(p){FBAccount = p; return;};
exports.addModifiedTokenStorageRecord = function(p){storageRecord[siteToTest].modifiedTokenStorageRecord = p;};

function startOver(){
	loginClickAttempts = 0;
	loginButtonClicked = false;
	capturingPhase = -1;
	loginButtonOuterHTML = "";
	loginButtonXPath = "";
	redirectDomain = "";
	FBAccount = 1;
	usedFBSDK = true;
	deleteCookies();
	FBSDKDetermined = false;
	tryFindInvisibleLoginButton = false;
	sawDialogOAuth = false;
}

function doneTesting(){
	console.log("test done.");
	capturingPhase = -1;
}

startOver();
if (!file.exists(file.join(profilePath, "testResults"))) file.mkpath(file.join(profilePath, "testResults"));
log("AVC v0.2 ccc.js loaded.");