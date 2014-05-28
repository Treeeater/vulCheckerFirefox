var ccc = require("./ccc");
var automatedTesting = require("./automatedTesting");
var CONST = require("./const");
var NM = require("./checkSR");			//NM stands for next module.

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
var inheritedPhase = 9999;
var sawDialogOAuth = false;
var delayRefreshTestTabTimer = 0;
var checkLoginButtonRemovedTimer = 0;
var delayRefreshCalled = false;
var additionalRedirectInfo = "";

var cleanup = function(){
	window.clearTimeout(delayRefreshTestTabTimer);
	window.clearTimeout(checkLoginButtonRemovedTimer);
}

var nextModule = function (success){
	try {observerService.removeObserver(httpRequestObserver, "http-on-examine-response");} catch(ex){};
	ccc.setTestOverallSuccess(success && ccc.testOverallSuccess());
	ccc.inBetweenModule();
	cleanup();
	NM.init(ccc.capturingPhase());
}

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

var bufferedResponses = {};
var modifiedResponseContent = "";			//used to store modified response content from testSuite.js
var displayFirstName = false;
var displayLastName = false;
var displayEmail = false;
var displayPicSRC = false;
var displayPicSRC2 = false;
var displayPicSRC3 = false;
var displayPicSRC4 = false;
var displayFBID = false;

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
	if (res.indexOf('access_token=')!=-1) {
		ccc.log("Access_token exists in this traffic.");
		ccc.log("Now try to verify this exploit");
		return true;
	}
	else {
		ccc.log("Access_token NOT spotted in this traffic.");
		ccc.log(ccc.siteToTest() + " is not vulnerable to [1], access_token not spotted.", true);
		nextModule(true);
		return false;
	}
}

var verifyThreat = function(testSuiteWorker)
{
	ccc.deleteCookies();
	try {
		ccc.deleteCache();
		testSuiteWorker.port.emit("action",{"action": "navigateTo", "site":ccc.siteToTest()});
	} catch (ex) {
		ccc.log('waiting for page to load...');
		setTimeout(verifyThreat.bind(window,testSuiteWorker),10000);
	}
}

var checkAgainstFilter = function(url, capturingPhase)
{
	var i = 0;
	if (capturingPhase == inheritedPhase + 1 && (url.indexOf("http://www.facebook.com/dialog/return")==0 || url.indexOf("https://www.facebook.com/dialog/return")==0|| url.indexOf("http://www.facebook.com/v1.0/dialog/return")==0 || url.indexOf("https://www.facebook.com/v1.0/dialog/return")==0)) 
	{
		//special situation for websites using social plugin button.php, see mapquest.com as an example.
		return true;
	}
	if (capturingPhase == inheritedPhase || (capturingPhase == inheritedPhase + 3 && delayRefreshCalled))
	{
		if (url.indexOf('#')!=-1) url = url.substr(0,url.indexOf('#'))		//get rid of the sharp.
		for (i = 0; i < ccc.capturingURLs().length; i++)
		{
			if (url == ccc.capturingURLs()[i] || url.substr(0,url.length-1) == ccc.capturingURLs()[i] || url == ccc.capturingURLs()[i].substr(0, ccc.capturingURLs()[i].length-1)) {
				return true;
			}
		}
		return false;
	}
	else if (capturingPhase == inheritedPhase + 1){
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
	else if (capturingPhase == inheritedPhase + 2 && ccc.usedFBSDK()){
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
	else if (!ccc.usedFBSDK() && ccc.redirectDomain() != "" && capturingPhase == inheritedPhase + 2)
	{
		if (ccc.socialButton()){
			if (url.startsWith("https://s-static.ak.facebook.com/connect/xd_arbiter") || url.startsWith("http://static.ak.facebook.com/connect/xd_arbiter")) return true;
			else return false;
		}
		//we also need to account for visits to redirectDomain
		var redirectDomain = ccc.redirectDomain();
		if (redirectDomain[redirectDomain.length-1] == ':') redirectDomain = redirectDomain.substr(0,redirectDomain.length-1);
		if (redirectDomain.substr(redirectDomain.length-3,3) == ':80') redirectDomain = redirectDomain.substr(0,redirectDomain.length-3);
		if (redirectDomain.substr(redirectDomain.length-4,4) == ':443') redirectDomain = redirectDomain.substr(0,redirectDomain.length-4);
		if (redirectDomain.indexOf(':80/')!=-1) redirectDomain = redirectDomain.substr(0,redirectDomain.indexOf(':80/')) + redirectDomain.substr(redirectDomain.indexOf(':80/')+3,redirectDomain.length);
		if (redirectDomain.indexOf(':443/')!=-1) redirectDomain = redirectDomain.substr(0,redirectDomain.indexOf(':443/')) + redirectDomain.substr(redirectDomain.indexOf(':443/')+4,redirectDomain.length);
		if (redirectDomain[redirectDomain.length-1] == '/') redirectDomain = redirectDomain.substr(0,redirectDomain.length-1);
		if (url.startsWith(redirectDomain) && ccc.credentialsInserted() && ((url + additionalRedirectInfo).indexOf('access_token=')!=-1 || (url + additionalRedirectInfo).indexOf('code=')!=-1 || (url + additionalRedirectInfo).indexOf('signed_request=')!=-1)) {
			return true;
		}
	}
	return false;
}

function checkLoginButtonRemoved(exists){
	if (exists){
		//don't need to worry about login/registration plugin here, as it would just be different from the response.xxx, which leads to this branch never be taken. 
		ccc.log("Modification failed! After Modification the login button is still present!");
		ccc.log(ccc.siteToTest() + " is not vulnerable to [1], login button still present after mod.", true);
		nextModule(true);
		return;
	}
	ccc.log("Modification successful!, log in button different from anonymous session.");
	checkStructuralDiff();
	return;
}

function checkStructuralDiff(){
	ccc.testSuiteWorker().port.on("after_modification_extractedContent",function(response){
		//ccc.saveToFile(ccc.siteToTest(), ccc.responseTextContent()[1] + "\n---------------\n" + ccc.responseTextContent()[2] + "\n---------------\n" + response);
		//ccc.log("Phase "+(inheritedPhase+5).toString()+": Saved response content to file.");
		ccc.log("Phase "+(inheritedPhase+5).toString()+": Checking extracted content and identifying session owner...\n");
		ccc.setCapturingPhase(ccc.capturingPhase() + 1);
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
		if (ccc.responseTextContent()[1].indexOf(accounts[0].fbid)!=-1&&ccc.responseTextContent()[2].indexOf(accounts[1].fbid)!=-1) displayFBID = true;
		
		ccc.log("This website displays " + (displayFirstName ? "first name, ":"" ) + (displayLastName ? "last name, ":"" ) + (displayEmail ? "email, ":"" ) + (displayPicSRC ? "picsrc, ":"" ) + (displayPicSRC2 ? "picsrc2, ":"" ) + (displayPicSRC3 ? "picsrc3, ":"" ) + (displayPicSRC4 ? "picsrc4,":"" ) + (displayFBID ? "fbid.":"" ));
		
		var sessionAScore = 0;
		var sessionBScore = 0;
		if (displayFirstName && lowerModifiedResponseContent.indexOf(accounts[0].firstName)!=-1) sessionAScore++;
		if (displayLastName && lowerModifiedResponseContent.indexOf(accounts[0].lastName)!=-1) sessionAScore++;
		if (displayEmail && lowerModifiedResponseContent.indexOf(accounts[0].email)!=-1) sessionAScore++;
		if (displayPicSRC && modifiedResponseContent.indexOf(accounts[0].picSRC)!=-1) sessionAScore++;
		if (displayPicSRC2 && modifiedResponseContent.indexOf(accounts[0].picSRC2)!=-1) sessionAScore++;
		if (displayPicSRC3 && modifiedResponseContent.indexOf(accounts[0].picSRC3)!=-1) sessionAScore++;
		if (displayPicSRC4 && modifiedResponseContent.indexOf(accounts[0].picSRC4)!=-1) sessionAScore++;
		if (displayFBID && modifiedResponseContent.indexOf(accounts[0].fbid)!=-1) sessionAScore++;
		
		if (displayFirstName && lowerModifiedResponseContent.indexOf(accounts[1].firstName)!=-1) sessionBScore++;
		if (displayLastName && lowerModifiedResponseContent.indexOf(accounts[1].lastName)!=-1) sessionBScore++;
		if (displayEmail && lowerModifiedResponseContent.indexOf(accounts[1].email)!=-1) sessionBScore++;
		if (displayPicSRC && modifiedResponseContent.indexOf(accounts[1].picSRC)!=-1) sessionBScore++;
		if (displayPicSRC2 && modifiedResponseContent.indexOf(accounts[1].picSRC2)!=-1) sessionBScore++;
		if (displayPicSRC3 && modifiedResponseContent.indexOf(accounts[1].picSRC3)!=-1) sessionBScore++;
		if (displayPicSRC4 && modifiedResponseContent.indexOf(accounts[1].picSRC4)!=-1) sessionBScore++;
		if (displayFBID && modifiedResponseContent.indexOf(accounts[1].fbid)!=-1) sessionBScore++;
		
		if (sessionAScore > 0 && sessionBScore == 0) {
			ccc.log("Web application now logged in as session A, threat successful, sessionAscore is: " + sessionAScore.toString());
			ccc.log(ccc.siteToTest() + " is vulnerable to [1]!", true);
			nextModule(true);
		}
		else if (sessionBScore > 0 && sessionAScore == 0) {
			ccc.log("Web application now logged in as session B, threat failed, sessionBscore is: " + sessionBScore.toString());
			ccc.log(ccc.siteToTest() + " is not vulnerable to [1], access_token used but session is still Bob's.", true);
			nextModule(true);
		}
		else {
			if (sessionAScore == 0 && sessionBScore == 0){
				ccc.log("Web application probably in a bad state, this means it knows something went wrong, therefore it's not vulnerable to [1].");
				ccc.log(ccc.siteToTest() + " is not vulnerable to [1], application in broken state.", true);
				nextModule(true);
			}
			else if (sessionAScore > 0 && sessionBScore > 0){
				ccc.log("Application is vulnerable to [1] because it displays both account info: "+sessionAScore.toString()+ " " + sessionBScore.toString());
				ccc.log(ccc.siteToTest() + " is vulnerable to [1](displays both account info)!", true);
				nextModule(true);
			}
		}
	});
	try {ccc.testSuiteWorker().port.emit("action",{"action":"after_modification_extractContent"});} catch (ex){
		window.setTimeout('ccc.testSuiteWorker().port.emit("action",{"action":"after_modification_extractContent"})',10000);
	}
}

function processBuffer(url)
{
	var capturingPhase = ccc.capturingPhase();
	if (capturingPhase == inheritedPhase+1 && checkAgainstFilter(url, capturingPhase) && ccc.loginButtonClicked() && sawDialogOAuth)
	{
		sawDialogOAuth = false;
		ccc.log("Phase "+(inheritedPhase+1).toString()+": Saw FB visit, waiting for access_token pattern to appear.\n");
		ccc.setCapturingPhase(capturingPhase + 1);
	}
	if (capturingPhase == inheritedPhase+3 && checkAgainstFilter(url, capturingPhase)) {
		ccc.log("Phase "+(inheritedPhase+3).toString()+": revisited the site after access_token is modified, ready to compare credentials/differences.\n");
		ccc.restoreCapturingURLs();
		ccc.setCapturingPhase(capturingPhase + 1);
	}
}

function delayRefreshTestTab()
{
	//This function is only invoked when the site uses javascript (as opposed to reloading) to manipulate after user logs in.
	if (ccc.capturingPhase() == inheritedPhase + 3) {
		ccc.log("Sub-Phase "+(inheritedPhase+2).toString()+".5: revisiting the testing site.");
		try {
			ccc.deleteCache();
			if (!ccc.oracleURL()) {
				ccc.testSuiteWorker().port.emit("action",{"action": "navigateTo", "site":ccc.siteToTest()});
			}
			else {
				//ccc.oracleURL already pushed to capturingURLs.
				ccc.testSuiteWorker().port.emit("action",{"action": "navigateTo", "site":ccc.oracleURL()});
			}
			delayRefreshCalled = true;
		}
		catch (ex) {
			log("testSuiteWorker worker hidden frame error, page probably still loading... retry in 10 secs");
			delayRefreshTestTabTimer = window.setTimeout(delayRefreshTestTab, 10000);
		}
	}
}

var observerService = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);

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
		if (ccc.usedFBSDK() && ccc.capturingPhase() == inheritedPhase + 2)
		{
			if ((data.substr(0,42) == '<script type="text/javascript">var message' || data.substr(0,42) == '<script type="text/javascript">\nvar messag' || data.substr(0,56)=='for (;;);{"__ar":1,"payload":null,"jsmods":{"define":[["') && data.indexOf('access_token=')!=-1){
				ccc.log("Phase "+(inheritedPhase+2).toString()+": App using SDK: trying to modify access_token.\n");
				var head = data.substr(0, data.indexOf('access_token='));
				var tail = data.substr(data.indexOf('access_token='), data.length);
				count = count - tail.indexOf('&');							//we know that in the SDK-returned msg, ampersand is always there, so it's safe to just get the index of it.
				count = count + ("access_token="+ccc.accountsInfo()[0].access_token).length;
				tail = tail.substr(tail.indexOf('&'),tail.length);
				data = head + "access_token=" + ccc.accountsInfo()[0].access_token + tail;
				if (delayRefreshTestTabTimer) window.clearTimeout(delayRefreshTestTabTimer);
				delayRefreshTestTabTimer = window.setTimeout(delayRefreshTestTab,15000);
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
        this.originalListener.onStartRequest(request, context);
    },

    onStopRequest: function(request, context, statusCode)
    {
        // Get entire response
        var responseBody = this.receivedData.join();
		var url = request.URI.spec;										//request.URI means the current URI (after 302 redirect)
		//if (ccc.capturingPhase() == inheritedPhase+1) url = request.originalURI.spec;		//request.originalURI means the first URI (before 302 redirect)
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
				var notAppsFacebookComDomain = true;
				if (ccc.capturingPhase() == inheritedPhase + 2 && !ccc.usedFBSDK())
				{
					//This helps tackle the 'in-between-hop' two redirects situation seen in pinterest and imgur.
					try {
						var newRedirectURI = gchannel.getResponseHeader('Location');
						if (newRedirectURI && newRedirectURI!=""){
							//if there is a redirect, we need to add that to storageRecord.facebookDialogOAuthResponse
							if (additionalRedirectInfo.indexOf(gchannel.originalURI.spec)==-1) additionalRedirectInfo = additionalRedirectInfo + gchannel.originalURI.spec + "\n";
							var urlWithoutHash = url.substr(0,url.indexOf('#'));
							if (additionalRedirectInfo.indexOf(urlWithoutHash)==-1) additionalRedirectInfo = additionalRedirectInfo + url + "\n";
							additionalRedirectInfo = additionalRedirectInfo + newRedirectURI +"\n";
						}
						var redirectDomain;
						if (newRedirectURI) redirectDomain = newRedirectURI;
						var protocol = redirectDomain.substr(0,redirectDomain.indexOf('/')) + "//";
						redirectDomain = redirectDomain.substr(redirectDomain.indexOf('/')+2,redirectDomain.length);
						if (redirectDomain.indexOf('/') != -1) redirectDomain = redirectDomain.substr(0,redirectDomain.indexOf('/'));
						redirectDomain = protocol + redirectDomain;
						ccc.setRedirectDomain(redirectDomain);
						ccc.log("Redirect Domain changed to: " + redirectDomain);
					}
					catch(ex){};
				}
				if (ccc.capturingPhase() == inheritedPhase + 3)
				{
					try {
						var newSiteToDetect = gchannel.getResponseHeader('Location');
						if (newSiteToDetect.indexOf('#')!=-1) newSiteToDetect = newSiteToDetect.substr(0,newSiteToDetect.indexOf('#'))		//get rid of the sharp.
						if (newSiteToDetect) {
							//still keep the old value so that we can restore it later.
							ccc.pushCapturingURLs(newSiteToDetect);
							ccc.log("capturingURLs appended with: " + newSiteToDetect);
						}
					}
					catch(ex){};
				}
				if (url.startsWith("https://www.facebook.com/dialog/oauth") || url.startsWith("http://www.facebook.com/dialog/oauth") || url.startsWith("https://www.facebook.com/v1.0/dialog/oauth") || url.startsWith("http://www.facebook.com/v1.0/dialog/oauth")) {
					//eliminate situation where redirect_uri starts with "http://apps.facebook.com".
					if (url.indexOf("static.ak.facebook.com")==-1) {
						var temp = url.substr(url.indexOf('redirect_uri='),url.length);
						temp = decodeURIComponent(temp.substr(13,temp.length));
						if (temp.indexOf('http://apps.facebook.com') == 0 || temp.indexOf('https://apps.facebook.com') == 0)
						{
							notAppsFacebookComDomain = false;
						}
					}
				}
				if ((url.startsWith("https://www.facebook.com/dialog/oauth") || url.startsWith("http://www.facebook.com/dialog/oauth") || url.startsWith("https://www.facebook.com/v1.0/dialog/oauth") || url.startsWith("http://www.facebook.com/v1.0/dialog/oauth")) && notAppsFacebookComDomain)
				{
					sawDialogOAuth = true;
				}
				var newListener = new TracingListener();
				try {newListener.setCookieHeader = gchannel.getResponseHeader('Set-Cookie');} catch(ex){};		//stupid FF sliently fails if no set-cookie header is present in a response header, STUPID!  This is a workaround.
				aSubject.QueryInterface(Ci.nsITraceableChannel);
				newListener.originalListener = aSubject.setNewListener(newListener);
			}
			//try modify access_token for sites which don't use SDK
			var uri = "";
			try {uri = gchannel.getResponseHeader('Location');}catch(ex){};
			if ((!ccc.usedFBSDK()) && uri.indexOf('access_token=')!=-1 && ccc.capturingPhase() == inheritedPhase+2)
			{
				ccc.log("Phase "+(inheritedPhase+2).toString()+": App does not use SDK: trying to modify access_token.\n");
				ccc.setCapturingPhase(ccc.capturingPhase()+1);
				ccc.log("Original (before attack) 302 dest is:" + uri);
				var tail = uri.substr(uri.indexOf('access_token='), uri.length);
				var andIndex = (tail.indexOf('&') == -1) ? 9999999 : tail.indexOf('&');
				var poundIndex = (tail.indexOf('#') == -1) ? 9999999 : tail.indexOf('#');
				var cutIndex = (andIndex > poundIndex) ? poundIndex : andIndex;
				if (cutIndex != 9999999) tail = tail.substr(cutIndex,tail.length);
				else tail = "";
				var redirectURI = uri.substr(0,uri.indexOf('access_token='))+"access_token="+ccc.accountsInfo()[0].access_token+tail;
				gchannel.setResponseHeader('Location', redirectURI, false);
				ccc.log(",which is changed to:" + redirectURI);
				if (delayRefreshTestTabTimer) window.clearTimeout(delayRefreshTestTabTimer);
				delayRefreshTestTabTimer = window.setTimeout(delayRefreshTestTab,15000);
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

exports.shouldClickLoginButton = function()
{
	if (ccc.capturingPhase()==inheritedPhase+1) return true;
	return false;
}

exports.shouldReturnLoginButtonInfoToVulChecker = function(){
	if (ccc.capturingPhase()==inheritedPhase+4) return true;
	return false;
}

exports.shouldAutomateSSO = function()
{
	if (ccc.capturingPhase()==inheritedPhase+2) return true;
	return false;
}

exports.init = function(param)
{
	//This is executed first (entry point) of this file. Init should happen here.
	ccc.log("Control transferred to checkToken module.");
	observerService.addObserver(httpRequestObserver, "http-on-examine-response", false);
	if ((ccc.detectionMode() & CONST.dm.access_token_vul) == 0) {
		//Shouldn't check access_token because this mode is disabled, hand over to the next module
		nextModule(true);
		return;
	}
	inheritedPhase = param;
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
	if (inheritedPhase == 9999) return capturingPhase;			//shortcut to cut unnecessary checks.
	sawDialogOAuth = false;
	if (checkAgainstFilter(url,capturingPhase)){
		ccc.log("Phase " + inheritedPhase.toString() + ": cleared cookies, revisited the site. Now ready to send exploit request.\n");
		ccc.setClickLoginButtonTimer(2000);
		return capturingPhase + 1;
	}
	else return capturingPhase;
}

exports.cleanup = cleanup;
exports.checkLoginButtonRemoved = checkLoginButtonRemoved;