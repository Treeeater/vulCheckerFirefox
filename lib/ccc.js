//this is previously in utilities.js
var debug = true;
var IdPDomains = ["https://www.facebook.com/dialog/oauth"];
var excludedPattern = ['display=none'];
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
	else if (capturingPhase == 2 || capturingPhase == 8){
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
//-------------------------------------end utilities.js-----------


var token_url = "https://www.facebook.com/dialog/oauth/?client_id=265286580246983&redirect_uri=http://chromium.cs.virginia.edu/test.php&scope=email&response_type=token";
var code_url = "https://www.facebook.com/dialog/oauth/?client_id=265286580246983&redirect_uri=http://chromium.cs.virginia.edu/test.php&scope=email&response_type=code";
var code_for_token_url = "https://graph.facebook.com/oauth/access_token?client_id=265286580246983&redirect_uri=http://chromium.cs.virginia.edu/test.php&client_secret=30d36a8bea17b5307cf8dd167e32c0a2&code="
var signed_request_url = "";
var old_token = "";
var old_code = "";
var old_signed_request = "";
var siteToTest = "";
var domainToTest = "";
var capturingURLs = [];						//urls to look for in the sea of requests.
var capturingPhase = -1;
var bufferedRequests = {};					//used to store freshly captured requests
var bufferedResponses = {};
var storageRecord = {};						//used by processing functions to dump buffered requests to 'more persistent and managed records'.
var loginButtonClicked = false;				//used to indicate whether login button has been clicked.
var SSOAutomationStarted = false;			//used to indicate whether SSOAutomation has started.
var testTab;								//reference to the tab that's being used to test.
var FBAccount = 1;
var loginButtonXPath = "";
var loginButtonOuterHTML = "";
var networkFailure = false;


function doneTesting(){
	capturingPhase = -1;
}

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
	log('Phase 2 - captured fb oauth request header and url');
	storageRecord[siteToTest].facebookDialogOAuthRequest = bufferedRequests[url];
	capturingPhase++;
}

function processUnLoad(url)
{
	if (url.startsWith("https://www.facebook.com/dialog/permissions.request") && (capturingPhase == 3 || capturingPhase == 9))
	//This condition is not always correct. If the app does ask for extra permissions, this URL is visted twice before SSO is complete.
	{
		//user has went through SSO, should reload test page and record headers.
		//However, lots of sites automatically reload the homepage after SSO is done, so we add a delay and test only when the site does not reload itself.
		//capturingPhase == 3 || 9 will trigger this.
		log('Phase ' + capturingPhase.toString() + ' - FB OAuth SSO process detected for account A');
		capturingPhase++;			//tell processBuffer that it's time to record authenticated session credentials.
		setTimeout(delayRefreshTestTab,10000);			//after 10 seconds, refresh the homepage.
	}
	//This is just for testing purposes.
	//In the real testing scenario, it should end at permissions.request, becomes presumably the test account has not granted access to the app.
	if (url.startsWith("https://www.facebook.com/login.php") && (capturingPhase == 3 || capturingPhase == 9))
	{
		log('Phase ' + capturingPhase.toString() + ' - FB OAuth SSO process detected for account A');
		capturingPhase++;			//tell processBuffer that it's time to record authenticated session credentials.
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
		testSuiteWorker.port.emit("action",{"action": "navigateTo", "site":siteToTest});
	}
}

function checkLoginButtonRemoved(){
	pressLoginButtonWorker.port.emit("action", "sendLoginButtonInformation");
}

function revisitSiteAnonymously(){	
	if (capturingPhase != 5) return;
	//capturingPhase == 5 will trigger this.
	log('Phase 5 - deleting cookies and revisit the test site for a second time');
	deleteCookies();
	capturingPhase++;
	testSuiteWorker.port.emit("action",{"action": "navigateTo", "site":siteToTest});
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
	log('Phase 8 - second time saw fb oauth request header and url, but we do not need to capture this time.');
	capturingPhase++;
}

function testSuitePhase10(url){
	//capturingPhase == 10 will trigger this.
	log('Phase 10 - recorded account B header data');
	storageRecord[siteToTest].authenticatedSessionRequest2 = bufferedRequests[url];
	storageRecord[siteToTest].authenticatedSessionResponse2 = bufferedResponses[url];
	capturingPhase++;
	//testSuitePhase11();
}

function testSuitePhase11(url){

	//capturingPhase == 11 will trigger this.
	//This phase tries to learn what is the key cookie to authenticate the user.
	log('Phase 11 - learning suspected cookies');
	var record = storageRecord[siteToTest];
	
	var authenticatedSessionRequest = record.authenticatedSessionRequest.requestHeaders;
	var authenticatedSessionCookies = [];
	
	var i = 0;
	for (i = 0; i < authenticatedSessionRequest.length; i++)
	{
		if (authenticatedSessionRequest[i].name == "Cookie") {
			authenticatedSessionCookies = authenticatedSessionRequest[i].value;
			break;
		}
	}
	suspects = authenticatedSessionCookies.split('; ');			//suspected cookies - initial guess.
	
	//check if any of the two anonymous request has the same cookie.
	
	//anonymous session 1
	var anonymousSessionRequest = record.anonymousSessionRequest.requestHeaders;
	var anonymousSessionCookies = [];
	for (i = 0; i < anonymousSessionRequest.length; i++)
	{
		if (anonymousSessionRequest[i].name == "Cookie") {
			anonymousSessionCookies = anonymousSessionRequest[i].value;
			break;
		}
	}
	anonymousSessionCookies = anonymousSessionCookies.split('; ');					//anonymous Session 1 cookies.
	
	for (i = suspects.length - 1; i >= 0 ; i--)
	{
		if (anonymousSessionCookies.indexOf(suspects[i]) != -1) {
			suspects.splice(i, 1);					//get it out of here.												
		}
	}
	
	//anonymouse session 2
	var anonymousSessionRequest2 = record.anonymousSessionRequest2.requestHeaders;
	var anonymousSessionCookies2 = [];
	for (i = 0; i < anonymousSessionRequest2.length; i++)
	{
		if (anonymousSessionRequest2[i].name == "Cookie") {
			anonymousSessionCookies2 = anonymousSessionRequest2[i].value;
			break;
		}
	}
	anonymousSessionCookies2 = anonymousSessionCookies2.split('; ');					//anonymous Session 2 cookies.
	
	for (i = suspects.length - 1; i >= 0 ; i--)
	{
		if (anonymousSessionCookies2.indexOf(suspects[i]) != -1) {
			suspects.splice(i, 1);					//get it out of here.												
		}
	}
	
	//check if authenticated session B has the same cookie:
	
	var authenticatedSessionRequest2 = record.authenticatedSessionRequest2.requestHeaders;
	var authenticatedSessionCookies2 = [];
	for (i = 0; i < authenticatedSessionRequest2.length; i++)
	{
		if (authenticatedSessionRequest2[i].name == "Cookie") {
			authenticatedSessionCookies2 = authenticatedSessionRequest2[i].value;
			break;
		}
	}
	authenticatedSessionCookies2 = authenticatedSessionCookies2.split('; ');			//authenticated Session B cookies.
	
	for (i = suspects.length - 1; i >= 0 ; i--)
	{
		if (authenticatedSessionCookies2.indexOf(suspects[i]) != -1) {
			suspects.splice(i, 1);					//get it out of here.												
		}
	}
	
	suspects = removeByHeuristics(suspects);			//remove popular first party cookie like GA and GAds.
	
	//storage.set({storageRecord: storageRecord});
	capturingPhase++;
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
	if (capturingPhase == 2 && checkAgainstFilter(url, capturingPhase) && loginButtonClicked)
	{
		testSuitePhase2(url);
		return;
	}
	//Phase 3: onunload event fired on FB login SSO page for account A.
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
	if (capturingPhase == 8 && checkAgainstFilter(url, capturingPhase))
	{
		//revisit the page without cookies
		testSuitePhase8(url);
		return;
	}
	//Phase 9: onunload event fired on FB login SSO page for account B.
	//Phaes 10: headers received on first visit to test page, authenticated session B.
	if (capturingPhase == 10 && checkAgainstFilter(url, capturingPhase))
	{
		//after clicking login button, enter different credential and receive headers.
		testSuitePhase10(url);
		doneTesting();
		return;
	}
}

function processLoaded(url){
	if (capturingPhase == 0 && checkAgainstFilter(url, capturingPhase))
	{
		//first visit done
		log('Phase 0 - done loading anonymously the first time.');
		setTimeout( function(){capturingPhase++;testSuiteWorker.port.emit("action",{"action": "navigateTo", "site":siteToTest});}, 2000);
		return;
	}
	if (capturingPhase == 6 && checkAgainstFilter(url, capturingPhase))
	{
		//second visit done
		log('Phase 6 - done loading anonymously the second time.');
		setTimeout( function(){capturingPhase++;testSuiteWorker.port.emit("action",{"action": "navigateTo", "site":siteToTest});}, 2000);
		return;
	}
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
			requestRecord.cookies = cookies;
			requestRecord.url = url;
			try {cookies = gchannel.getRequestHeader("cookie");} catch(e){}						//this creates lots of errors if not caught
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
		if (capturingPhase == 2 || capturingPhase == 8) url = request.originalURI.spec;		//request.originalURI means the first URI (before 302 redirect)
		//For FB, oauth/dialog API is the original URI.
		//Note: originalURI at observe function (outside of this) needs to be URI, not originalURI, lol.
		if (checkAgainstFilter(url, capturingPhase))
		//if (true)
		{
			var responseRecord = new ResponseRecord();
			responseRecord.url = url;
			if (url.indexOf("https://www.facebook.com/dialog/permissions")!=-1) responseRecord.body = responseBody;
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
	}
	else{
		if (worker.tab.i == 1)
		{
			testSuiteWorker = worker;
		}
	}
	pressLoginButtonWorker = worker;
	//listen to events
	pressLoginButtonWorker.port.on("loginInfo",function(info){
			if (info.loginButtonXPath == "") 
			{
				loginButtonXPath = info.loginButtonXPath;					//only record the first time we press the login button.
				log(loginButtonXPath);
			}
			if (info.loginButtonOuterHTML == "") {
				loginButtonOuterHTML = info.loginButtonOuterHTML;		//only record the first time we press the login button.
				log(loginButtonOuterHTML);
			}
			pressLoginButtonWorker.port.emit("readyToClick","readyToClick");
		}
	);
	pressLoginButtonWorker.port.on("pressedLoginButton", function(response){
			loginButtonClicked = true;
			if (capturingPhase == 3 || capturingPhase == 4 || capturingPhase == 9 || capturingPhase == 10) return;
			//try {pressLoginButtonWorker.port.emit("pressedLoginButton",{"capturingPhase":capturingPhase});} catch (ex) {};
			try {pressLoginButtonWorker.port.emit("pressedLoginButton",{"capturingPhase":capturingPhase});} catch(ex) { console.log("Caught Exception: hidden frame error");}
		}
	);
	pressLoginButtonWorker.port.on("checkTestingStatus", function(response){
			if (capturingPhase == 3 || capturingPhase == 4 || capturingPhase == 9 || capturingPhase == 10) return;
			pressLoginButtonWorker.port.emit("checkTestingStatus",{"capturingPhase":capturingPhase});
		}
	);
	pressLoginButtonWorker.port.on("sendLoginButtonInformation", function(response){
			if (response.loginButtonXPath == loginButtonXPath && response.loginButtonOuterHTML == loginButtonOuterHTML) {
				log("login failed! After logging in the login button is still present!")
				return;
			}
			log("login successful!, log in button different from anonymous session.");
			revisitSiteAnonymously();
		}
	);
};

exports.initAutomateSSOWorker = function(worker){
	automateSSOWorker = worker;
	automateSSOWorker.port.on("requestFBAccount",function(){
		automateSSOWorker.port.emit("requestFBAccount",FBAccount);
	});
	automateSSOWorker.port.on("unloadedURL",function(url){
		if (url != undefined) processUnLoad(url);
	});
}

exports.initTestSuiteWorker = function(worker){
	if (worker.tab.i == undefined)
	{
		totalTabNo++;
		worker.tab.i = totalTabNo;
		if (worker.tab.i == 1)
		{
			testSuiteWorker = worker;
		}
	}
	else{
		if (worker.tab.i == 1)
		{
			testSuiteWorker = worker;
		}
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
		
		testSuiteWorker.port.emit("action", {"site": siteToTest, "action": "navigateTo"});
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
	capturingPhase = 0;
	deleteCookies();
	//user clicked on start test suite button, we get his/her input and navigate to that site.
	worker.port.emit("action",{"action": "testSuiteStart","site":""});
}

function startOver(){
	totalTabNo = 0;
	loginButtonClicked = false;
	capturingPhase = -1;
	loginButtonOuterHTML = "";
	loginButtonXPath = "";
	deleteCookies();
}

startOver();
log("AVC v0.2 ccc.js loaded.");