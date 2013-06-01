var ccc = require("./ccc");
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

var log = function(str)
{
	if (ccc.debug()) console.log(str);
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

var bufferedRequests = {};					//used to store freshly captured requests
var bufferedResponses = {};
var modificationSuccess = true;

if (typeof String.prototype.startsWith != 'function') {
	String.prototype.startsWith = function (str){
		return this.indexOf(str) == 0;
	};
}

var checkToken = function(storageRecord)
{
	if (!storageRecord.facebookDialogOAuthResponse) {console.log("Error: facebookOAuthResponse is undefined!"); return false;}
	var res = storageRecord.facebookDialogOAuthResponse.body;
	if (typeof res == "undefined") res = storageRecord.facebookDialogOAuthResponse.url;		//means the app didn't use the SDK, which means the acutal redirect url is in the 302 url, as opposed to javascript content.
	if (typeof res == "undefined") {console.log("Error: facebookOAuthResponse URL/content empty!"); return false;}
	if (res.indexOf('access_token')!=-1) {
		console.log("Access_token exists in this traffic.");
		console.log("Now try to verify this exploit");
		return true;
	}
	else {
		console.log("Access_token NOT spotted in this traffic.");
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
	if (capturingPhase == 13){
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
	else if (capturingPhase == 14 && ccc.usedFBSDK()){
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
	else if (!ccc.usedFBSDK() && ccc.redirectDomain() != "" && capturingPhase == 14)
	{
		//we also need to account for visits to redirectDomain
		if (url.startsWith(ccc.redirectDomain())) {
			return true;
		}
	}
	else if (capturingPhase == 15)
	{
		for (; i < ccc.capturingURLs().length; i++)
		{
			if (url == ccc.capturingURLs()[i]) {
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
		console.log("Phase 16: checking login button existence after modification...");
		ccc.setCapturingPhase(ccc.capturingPhase() + 1);
		console.log(response.loginButtonXPath);
		console.log(ccc.loginButtonXPath());
		if (response.loginButtonXPath == ccc.loginButtonXPath() && response.loginButtonOuterHTML == ccc.loginButtonOuterHTML()) {
			log("Modification failed! After Modification the login button is still present!");
			modificationSuccess = false;
			return;
		}
		log("Modification successful!, log in button different from anonymous session.");
		checkStructuralDiff();
		return;
	});
	ccc.pressLoginButtonWorker().port.emit("action", "after_modification_sendLoginButtonInformation");
}

function checkStructuralDiff(){
	ccc.testSuiteWorker().port.on("after_modification_extractedContent",function(response){
		console.log("Phase 17: Checking extracted content and identifying session owner...");
		console.log("Session A length: "+ccc.responseTextContent()[1].length);
		console.log("Session B length: "+ccc.responseTextContent()[2].length);
		console.log("Session modified length: "+response.length);
		//console.log("Threat distance: "+levenshteinDistance(ccc.responseTextContent()[1],response).toString());
		//console.log("Safe distance: "+levenshteinDistance(ccc.responseTextContent()[2],response).toString());	
		ccc.saveToFile(ccc.siteToTest(), ccc.responseTextContent()[1] + "\n---------------\n" + ccc.responseTextContent()[2] + "\n---------------\n" + response);
		console.log("Phase 18: Saved response content to file.");
	});
	ccc.testSuiteWorker().port.emit("action",{"action":"after_modification_extractContent"});
}

function processBuffer(url)
{
	var capturingPhase = ccc.capturingPhase();
	if (capturingPhase == 13 && checkAgainstFilter(url, capturingPhase) && ccc.loginButtonClicked())
	{
		console.log("Phase 13: Saw FB visit, waiting for access_token pattern to appear");
		ccc.setCapturingPhase(capturingPhase + 1);
	}
	if (capturingPhase == 15 && checkAgainstFilter(url, capturingPhase)) {
		console.log("Phase 15: revisited the site after access_token is modified, ready to compare credentials/differences.");
		ccc.addModifiedTokenStorageRecord(bufferedRequests[url]);
		//ccc.saveToFile(ccc.siteToTest(), JSON.stringify(ccc.storageRecord()[ccc.siteToTest()]));
		ccc.setCapturingPhase(capturingPhase + 1);
		setTimeout(checkLoginButtonRemoved,10000);				//timing consistent with phase 4.
	}
}

function delayRefreshTestTab()
{
	//This function is only invoked when the site uses javascript (as opposed to reloading) to manipulate after user logs in.
	//capturingPhase == 15 will trigger this.
	if (ccc.capturingPhase() == 15) {
		console.log("Sub-Phase 14.5: Site probably used JS to manipulate cookies, now refresh the site and try to capture cookies");
		ccc.testSuiteWorker().port.emit("action",{"action": "navigateTo", "site":ccc.siteToTest()});
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
		if (ccc.usedFBSDK())
		{
			if (data.substr(0,42) == '<script type="text/javascript">var message' && data.indexOf('access_token')!=-1){
				console.log("Phase 14: App using SDK: trying to modify access_token.");
				var head = data.substr(0, data.indexOf('access_token'));
				var tail = data.substr(data.indexOf('access_token'), data.length);
				count = count - tail.indexOf('&');
				count = count + ("access_token="+ccc.old_token()).length;
				tail = tail.substr(tail.indexOf('&'),tail.length);
				data = head + "access_token=" + ccc.old_token() + tail;
				setTimeout(delayRefreshTestTab,10000);
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
			console.log("Phase 14: App does not use SDK: trying to modify access_token.");
			console.log(request.URI.spec);
			var tail = uri.substr(uri.indexOf('access_token'), uri.length);
			tail = tail.substr(tail.indexOf('&'),tail.length);
			request.URI.spec = uri.substr(0,uri.indexOf('access_token'))+"access_token="+ccc.old_token()+tail;							//redirect URI to the threat generated.
			setTimeout(delayRefreshTestTab,10000);
			ccc.setCapturingPhase(ccc.capturingPhase()+1);
		}
        this.originalListener.onStartRequest(request, context);
    },

    onStopRequest: function(request, context, statusCode)
    {
        // Get entire response
        var responseBody = this.receivedData.join();
		var url = request.URI.spec;										//request.URI means the current URI (after 302 redirect)
		if (ccc.capturingPhase() == 13) url = request.originalURI.spec;		//request.originalURI means the first URI (before 302 redirect)
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
	if (ccc.capturingPhase()==13) return true;
}

exports.init = function()
{
	//This is executed first (entry point) of this file. Init should happen here.
	log("Control transferred to checkToken module.");
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
	if (capturingPhase == 12 && url == ccc.siteToTest()){
		console.log("Phase 12: cleared cookies, revisited the site. Now ready to send exploit request.");
		return capturingPhase + 1;
	}
	else return capturingPhase;
}