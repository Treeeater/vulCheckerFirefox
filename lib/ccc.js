var checkToken = require("./checkToken");
var checkSR = require("./checkSR");
var file = require("file");
var profilePath = require("system").pathFor("ProfD");
var tabs = require("sdk/tabs");
var automatedTesting = require("./automatedTesting");
var conf = require("./configuration");
var PT = require("./persistentThreats");
var CONST = require("./const");

//this is previously in utilities.js

var debug = (!!conf.debug) && true;
var writeFlag = (!!conf.writeFlag) && true;
var automatedTestingFlag = (!!conf.automatedTestingFlag) && true;
var cleanResultDirectoryUponInit = (!!conf.cleanResultDirectoryUponInit) || false;
var detectionMode = CONST.dm.access_token_vul;
if (typeof conf.detectionMode != "undefined") detectionMode = conf.detectionMode;
var IdPDomains = ["https://www.facebook.com/dialog/oauth", "https://www.facebook.com/dialog/permissions.request", "https://www.facebook.com/login.php", "http://www.facebook.com/dialog/oauth"];
exports.IdPDomains = IdPDomains;
var excludedPattern = ['display=none'];
exports.excludedPattern = excludedPattern;
const {Cc,Ci,Cr} = require("chrome");
var fileComponent = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);

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
var cookieService2 = Cc["@mozilla.org/cookiemanager;1"].getService(Ci.nsICookieManager2);
var pressLoginButtonWorker;
var automateSSOWorker;
var testSuiteWorker;
var registrationWorker;
var yetToInitCredentials = true;
var calledCheckAndRedoCredentials = false;
var credentialsInserted = false;
var FBSDKDetermined = false;
var sawDialogOAuth = false;
var iframeRegistrationSubmitted = false;
var testRegistrationInProgress = false;	//if we are testing whether the registration is successful or not.
var readyToRecordSessionData = false;	//if delayRefreshTab has been called.
var loginButtonClicked = false;				//used to indicate whether login button has been clicked.
var SSOAutomationStarted = false;			//used to indicate whether SSOAutomation has started.
var removedObserver = false;			//used to indicate if observer has been removed.
var usedFBSDK = true;						//used to indicate if the site used FB SDK or not. If true, the redirect_uri parameter when calling dialog/oauth is set to http(s)://(s-)static.ak.facebook.com/connect/xd_arbiter.php?xxxx; otherwise it is customized to its own domain.
//https%3A%2F%2Fs-static.ak.facebook.com%2Fconnect%2Fxd_arbiter.php
var loginClickAttempts = 0;
var indexToClick = 0;					//currently clicking at which attrInfoMap index for first click.
var indexToClick2 = 0;					//currently clicking at which attrInfoMap index for second click.
var elementsToFill = [];
var buttonToClick = [];
var iframeClickedXPATH = [];
var iframeClickedOuterHTML = [];
var registerAttempts = 0;
var accountsInfo;
var credentialsForPersistentThreats = {};

var stallCheckerTimer = 0;
var prepareLoginButtonIndexToClickTimer = 0;
var delayRefreshTestTabTimer = 0;
var checkLoginButtonRemovedTimer = 0;
var checkRedirectionAndAdjustTimer = 0;
var tryToRegisterInMainFrameTimer = 0;
var extractContentTimer = 0;
var testRegisterSuccessTimer = 0;
var testOverallSuccess = true;
var tryFindInvisibleLoginButton = conf.tryFindInvisibleLoginButton || false;
var registrationNeeded = conf.registrationNeeded || false;			//whether the site needs registration or not.
var searchForSignUpForFB = conf.searchForSignUpForFB || false;
var testedSearchForSignUp = false;				//used to indicate if we have tried to search for signup button.
var supportFBLogin = false;				//used in automatedTesting.js to determine whether to output vulnerability testing results for [2][4][5].
var searchingForLoginButton = true;		//used to determine if we allow changing indexToClick and stuff.

var log = function(str)
{
	if (debug && arguments.length != 2) console.log(str);			//do not display messages written to the general results.txt file.
	if (writeFlag){
		if (arguments.length == 2) saveToFile("results", str);
		else if (siteToTest!="") saveToFile(siteToTest, str);
	}
}

var stallChecker = function (){
	if (!automatedTestingFlag || automatedTesting.allTestDone()) return;
	//call this function with argument 'true' upon each start of test case.
	if (arguments.length == 0 && previousPhase == capturingPhase && previousSiteToTest == siteToTest) {
		//test has not made any progress.
		log("Test stalled at Phase " + capturingPhase.toString(), true);
		log("Test stalled at Phase " + capturingPhase.toString());
		automatedTesting.finishedTesting();			//calling this with no arguments means failed testing due to timeout.
		return;
	}
	if (arguments.length > 0) {
		log("Stall timer reset.");
		window.clearTimeout(stallCheckerTimer);
	}
	previousPhase = capturingPhase;
	previousSiteToTest = siteToTest;
	stallCheckerTimer = window.setTimeout(stallChecker, 240000);
}

if (typeof String.prototype.startsWith != 'function') {
	String.prototype.startsWith = function (str){
		return this.indexOf(str) == 0;
	};
}

var closeAllOtherTabs = function(){
	if (tabs.length <= 1) return;
	for each (var tabIterator in tabs){
		if (tabIterator.i != 1) tabIterator.close();
	}
}

function resetTab(){
	closeAllOtherTabs();
	//called after a test is done, reset testSuiteWorker and such so that a dead worker cannot halt all tests.
	window.setTimeout(function(){tabs.open({
		url: "http://www.cs.virginia.edu/~yz8ra/blank.html",
		onOpen: function onOpen(tab) {
			tab.shouldStay = true;
			for each (var tabIterator in tabs){
				if (!tabIterator.shouldStay) tabIterator.close();
			}
			tab.shouldStay = false;
		}
	});},500);
}

function resetIframeClickedInfo(){
	iframeClickedXPATH = [];
	iframeClickedOuterHTML = [];
};

function initTab(){
	//called after firefox start-up.
	tabs.activeTab.attach({
		contentScript: 'document.location="http://www.cs.virginia.edu/~yz8ra/blank.html"'
	});
}

var checkRedirectionAndAdjust = function()
{
	if (capturingPhase > 0) return;
	try {
		testSuiteWorker.port.emit("action",{action:"getURL"});
	}
	catch (ex) {
		log("Site probably still loading, wait 10 secs....");
		checkRedirectionAndAdjustTimer = window.setTimeout(checkRedirectionAndAdjust,10000);
	}
}

var checkAgainstFilter = function(url, capturingPhase)
{
	var i = 0;
	if ((capturingPhase == 2 || capturingPhase == 8) && (url.indexOf("http://www.facebook.com/dialog/return")==0 || url.indexOf("https://www.facebook.com/dialog/return")==0)) 
	{
		return true;
	}
	if (capturingPhase == 0 || capturingPhase == 1 || capturingPhase == 4 || capturingPhase == 6 || capturingPhase == 7 || capturingPhase == 10){
		if (url.indexOf('#')!=-1) url = url.substr(0,url.indexOf('#'))		//get rid of the sharp.
		for (; i < capturingURLs.length; i++)
		{
			if (url == capturingURLs[i] || url.substr(0,url.length-1) == capturingURLs[i] || url == capturingURLs[i].substr(0, capturingURLs[i].length-1)) {
				//to tackle www.google.com should equal to www.google.com/ problem.
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
		if (redirectDomain[redirectDomain.length-1] == ':') redirectDomain = redirectDomain.substr(0,redirectDomain.length-1);
		if (redirectDomain.substr(redirectDomain.length-3,3) == ':80') redirectDomain = redirectDomain.substr(0,redirectDomain.length-3);
		if (redirectDomain.substr(redirectDomain.length-4,4) == ':443') redirectDomain = redirectDomain.substr(0,redirectDomain.length-4);
		if (redirectDomain.indexOf(':80/')!=-1) redirectDomain = redirectDomain.substr(0,redirectDomain.indexOf(':80/')) + redirectDomain.substr(redirectDomain.indexOf(':80/')+3,redirectDomain.length);			//keep that slash, so the substr index is 3.
		if (redirectDomain.indexOf(':443/')!=-1) redirectDomain = redirectDomain.substr(0,redirectDomain.indexOf(':443/')) + redirectDomain.substr(redirectDomain.indexOf(':443/')+4,redirectDomain.length);
		if (redirectDomain[redirectDomain.length-1] == '/') redirectDomain = redirectDomain.substr(0,redirectDomain.length-1);		//get rid of the last slash.
		if (url.startsWith(redirectDomain) && credentialsInserted) {
			return true;
		}
	}
	return false;
}

var check_and_redo_credentials = function () {
	closeAllOtherTabs();
	deleteCookies();
	var i = 0;
	var URL = "";
	var type = "";
	for (i = 0; i < accountsInfo.length; i++)
	{
		if ((detectionMode & (CONST.dm.access_token_vul | CONST.dm.signed_request_vul)) != 0 && typeof accountsInfo[i].access_token == 'undefined') {FBAccount = i + 1; URL = token_url; type = "access_token"; break;}			//both signed_request_vul and access_token_vul requires access_token be changed.
		//if ((detectionMode & CONST.dm.code_vul) != 0 && typeof accountsInfo[i].code == 'undefined') {FBAccount = i + 1; URL = code_url; type = "code"; break;}
		if ((detectionMode & CONST.dm.signed_request_vul) != 0 && typeof accountsInfo[i].sr == 'undefined') {FBAccount = i + 1; URL = signed_request_url; type = "sr"; break;}
		if (i == accountsInfo.length - 1) yetToInitCredentials = false;			//everything checks, done check and redo credentials.
	}
	if (yetToInitCredentials) {
		tabs.open({
			url: URL,
			inNewWindow: true,
			onOpen: function onOpen(tab){
				tab.on('ready', function(tab){
					if (tab.url.startsWith("http://chromium.cs.virginia.edu/test.php"))
					{
						var temp = tab.url;
						var value = "";
						if (type == "access_token") value = temp.substr(temp.indexOf("=")+1, temp.indexOf("&") - temp.indexOf("=") - 1);
						//else if (type == "code") value = temp.substr(temp.indexOf("=")+1, temp.indexOf("#") - temp.indexOf("=") - 1);
						else if (type == "sr") value = temp.substr(temp.indexOf("=")+1, temp.length);
						accountsInfo[i][type] = value;
						log("Updated " + type + " for account " + accountsInfo[i].email + " : " + value, true);
						window.setTimeout(check_and_redo_credentials,500);
					}
				});
			}
		});
	}
	else {
		log("\nTest suite starting...\n",true);
		window.setTimeout(automatedTesting.startTestIfHaventStarted,500);
	}
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
	cookieService2.removeAll();
}

var deleteFBCookies = function(){
	var iterator = cookieService2.getCookiesFromHost(".facebook.com");
	while (iterator.hasMoreElements()){
		var currentCookie = iterator.getNext().QueryInterface(Ci.nsICookie);
		var name = currentCookie.name;
		var path = currentCookie.path;
		cookieService2.remove(".facebook.com",name,path,false); 
	}
}

function fileNameSanitize(str)
{
	return str.replace(/[^a-zA-Z0-9]*/g,"").substr(0,32)+".txt";
}

function saveToFile(fileName, content)
{
	fileName = fileNameSanitize(fileName);
	var filePath = file.join(profilePath, "testResults", fileName);
	/*var writer = file.open(filePath, "w+");
	writer.writeAsync(content, function(error)
	{
		if (error){
			//console.log("Error in writing to file: " + error);
		}
		else{
			//console.log("Success in writing to file!");
		}
		if (!writer.closed){
			writer.close();
		}
	});*/
	fileComponent.initWithPath(filePath);  // The path passed to initWithPath() should be in "native" form.
	//file.append("data.txt");      // Use append() so you don't have to handle folder separator(e.g. / or \).
	 
	/*
	 * Writing data to the file.
	 */
	var foStream = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
	foStream.init(fileComponent, 0x02 | 0x08 | 0x10, 0666, 0); 
	foStream.write(content+"\n", content.length+1);
	foStream.close();
}

function initOutputDir(){
	if (writeFlag){
		var dirPath = file.join(profilePath, "testResults");
		if (!file.exists(dirPath)) file.mkpath(dirPath);
		
		//Delete all existing files.
		if (cleanResultDirectoryUponInit){
			var existingFiles = file.list(dirPath);
			var i = 0;
			for (i = 0; i < existingFiles.length; i++)
			{
				file.remove(file.join(dirPath,existingFiles[i]));
			}
		}
	}
}

function writeToFileRequest(str)
{
	if (writeFlag) saveToFile(siteToTest,str);
}

function assume(bool, message){
	if (!bool) {log(message); temp=error;}		//this intends to throw out an error.
}
//-------------------------------------end utilities.js-----------


var token_url = "https://www.facebook.com/dialog/oauth/?client_id=265286580246983&redirect_uri=http://chromium.cs.virginia.edu/test.php&scope=email&response_type=token";
var code_url = "https://www.facebook.com/dialog/oauth/?client_id=265286580246983&redirect_uri=http://chromium.cs.virginia.edu/test.php&scope=email&response_type=code";		//important: code is one time use only! always acquire a new one if previous one is used, even if only ONCE!
var code_for_token_url = "https://graph.facebook.com/oauth/access_token?client_id=265286580246983&redirect_uri=http://chromium.cs.virginia.edu/test.php&client_secret=30d36a8bea17b5307cf8dd167e32c0a2&code="
var signed_request_url = "https://www.facebook.com/dialog/oauth/?client_id=265286580246983&redirect_uri=http://chromium.cs.virginia.edu/test.php&scope=email&response_type=signed_request";
var old_code = "";
var old_signed_request = "";
var siteToTest = "";
var capturingURLs = [];						//urls to look for in the sea of requests.
var capturingPhase = -1;
var bufferedRequests = {};					//used to store freshly captured requests
var bufferedResponses = {};
var responseTextContent = [];				//index: FBAccount
var storageRecord = {};						//used by processing functions to dump buffered requests to 'more persistent and managed records'.
var testTab;								//reference to the tab that's being used to test.
var FBAccount = 1;
var redirectDomain = "";					//if the website doesn't use FBSDK, this stores its redirect_uri parameter.
var oldRedirectDomain = "";					//if the website doesn't use FBSDK and redirects after first redirect_uri, this temporarily holds the previous value.
var oldCapturingURLs = [];					//This stores the original capturingURLs.
var loginButtonXPath = "";
var loginButtonOuterHTML = "";
var additionalRedirectInfo = "";			//used to store 302 in phase 3, for checkToken.js to use to identify if access_token is seen.

function startOver(){
	supportFBLogin = false;
	loginClickAttempts = 0;
	registerAttempts = 0;
	indexToClick = 0;
	indexToClick2 = 0;
	closeAllOtherTabs();
	capturingPhase = -1;
	loginButtonOuterHTML = "";
	loginButtonXPath = "";
	redirectDomain = "";
	oldRedirectDomain = "";
	additionalRedirectInfo = "";
	oldCapturingURLs = [];
	resetIframeClickedInfo();
	FBAccount = 1;
	loginButtonClicked = false;
	usedFBSDK = true;
	testOverallSuccess = true;
	FBSDKDetermined = false;
	iframeRegistrationSubmitted = false;
	testRegistrationInProgress = false;
	readyToRecordSessionData = false;
	sawDialogOAuth = false;
	searchingForLoginButton = true;
	testedSearchForSignUp = false;
	credentialsForPersistentThreats = {};
	
	tryFindInvisibleLoginButton = conf.tryFindInvisibleLoginButton || false;
	registrationNeeded = conf.registrationNeeded || false;
	searchForSignUpForFB = conf.searchForSignUpForFB || false;
	
	deleteCookies();
	window.clearTimeout(delayRefreshTestTabTimer);
	window.clearTimeout(prepareLoginButtonIndexToClickTimer);
	window.clearTimeout(checkLoginButtonRemovedTimer);
	window.clearTimeout(stallCheckerTimer);
	window.clearTimeout(checkRedirectionAndAdjustTimer);
	window.clearTimeout(tryToRegisterInMainFrameTimer);
	window.clearTimeout(extractContentTimer);
	window.clearTimeout(testRegisterSuccessTimer);
	checkToken.cleanup();
	checkSR.cleanup();
	
	if (removedObserver) {
		observerService.addObserver(httpRequestObserver, "http-on-examine-response", false);
		removedObserver = false;
	}
}

function inBetweenModule(){
	loginClickAttempts = 0;
	loginButtonClicked = false;
}

function updateCredentialsInfoForPersistentThreats(info,mode){
	if (mode == "body"){
		var body = info;
		if (typeof body == "string") {
			if (body.indexOf('access_token=') != -1) {
				var access_token = body.substr(body.indexOf('access_token=')+13,body.length);
				access_token = access_token.substr(0,access_token.indexOf('&'));
				credentialsForPersistentThreats.access_token = access_token;
			}
			if (body.indexOf('signed_request=') != -1) {
				var signed_request = body.substr(body.indexOf('signed_request=')+15,body.length);
				signed_request = signed_request.substr(0,signed_request.indexOf('&'));
				credentialsForPersistentThreats.signed_request = signed_request;
			}
		}
	}
	else {
		//mode == url
		var url = info;
		if (typeof url == "string") {
			if (url.indexOf('access_token=') != -1) {
				var access_token = url.substr(url.indexOf('access_token=')+13,url.length);
				var andIndex = (access_token.indexOf('&') == -1) ? 9999999 : access_token.indexOf('&');
				var poundIndex = (access_token.indexOf('#') == -1) ? 9999999 : access_token.indexOf('#');
				var cutIndex = (andIndex > poundIndex) ? poundIndex : andIndex;
				if (cutIndex != 9999999) access_token = access_token.substr(0,cutIndex);
				credentialsForPersistentThreats.access_token = access_token;
			}
			if (url.indexOf('code=') != -1) {
				var code = url.substr(url.indexOf('code=')+5,url.length);
				var andIndex = (code.indexOf('&') == -1) ? 9999999 : code.indexOf('&');
				var poundIndex = (code.indexOf('#') == -1) ? 9999999 : code.indexOf('#');
				var cutIndex = (andIndex > poundIndex) ? poundIndex : andIndex;
				if (cutIndex != 9999999) code = code.substr(0,cutIndex);
				credentialsForPersistentThreats.code = code;
			}
			if (url.indexOf('signed_request=') != -1) {
				var signed_request = url.substr(url.indexOf('signed_request=')+15,url.length);
				var andIndex = (signed_request.indexOf('&') == -1) ? 9999999 : signed_request.indexOf('&');
				var poundIndex = (signed_request.indexOf('#') == -1) ? 9999999 : signed_request.indexOf('#');
				var cutIndex = (andIndex > poundIndex) ? poundIndex : andIndex;
				if (cutIndex != 9999999) signed_request = signed_request.substr(0,cutIndex);
				credentialsForPersistentThreats.signed_request = signed_request;
			}
		}
	}
	if (!!credentialsForPersistentThreats.access_token) log("Recorded access_token info: " + credentialsForPersistentThreats.access_token);
	if (!!credentialsForPersistentThreats.code) log("Recorded code info: " + credentialsForPersistentThreats.code);
	if (!!credentialsForPersistentThreats.signed_request) log("Recorded signed_request info: " + credentialsForPersistentThreats.signed_request);
}

var testSuiteStart = function(worker){
	//user clicked on start test suite button, we get his/her input and navigate to that site.
	worker.port.emit("action",{"action": "testSuiteStart","site":""});
}

var startTest = function(site){
	//after user entered site to test, control is handed over here.
	startOver();
	capturingPhase++;
	siteToTest = site;
	capturingURLs = [];
	capturingURLs.push(siteToTest);
	try {
		testSuiteWorker.port.emit("action", {"site": siteToTest, "action": "navigateTo"});
		stallChecker(true);
		log("Testing site: "+siteToTest, true);
		checkRedirectionAndAdjustTimer = window.setTimeout(checkRedirectionAndAdjust,10000);	//check if phase is > 0, if not, indicates the website redirected itself. We make adjustments according to it.
	} catch(ex){
		//errors in between tests, just try again.
		log("testSuiteWorker hidden frame error 9 (while trying to start a new test), retrying in 10 secs...");
		window.setTimeout(startTest.bind(window,site),10000);				//call this function again.
	}
}

function testSuitePhase1(url){
	//Getting initial anonymous session headers data.
	assume(capturingPhase == 1, "Phase 1 violation");
	log('Phase 1 - recorded anonymous header data.\n');
	var tempRecord = new trafficRecord();
	tempRecord.url = siteToTest;
	tempRecord.anonymousSessionRequest = bufferedRequests[url];
	tempRecord.anonymousSessionResponse = bufferedResponses[url];
	storageRecord[siteToTest] = tempRecord;
	capturingPhase++;
}

function prepareLoginButtonIndexToClick(response){
	var shouldClick = (capturingPhase == 2 || capturingPhase == 8);
	shouldClick = shouldClick || checkToken.shouldClickLoginButton() || checkSR.shouldClickLoginButton();
	if (shouldClick) {
		loginButtonClicked = true;
		try {	
			pressLoginButtonWorker.port.emit("doNotRespond","");
			testSuiteWorker.port.emit("doNotRespond","");
		} catch (ex) {
			log("waiting for page to load, 10sec .... ");
			prepareLoginButtonIndexToClickTimer = window.setTimeout(prepareLoginButtonIndexToClick,10000);			//wait longer for the page load.
			return;
		}
		if (loginClickAttempts >= 2) {
			//This above '2' is fixed - we only consider two clicks max to find FB SSO traffic.
			if (indexToClick >= 2 && indexToClick2 >= 2){			
				//searched through the first three candidates in first click and second click, need to give up or change to detect invisible button strategy.
				if (tryFindInvisibleLoginButton){
					//really give up.
					if (!searchForSignUpForFB){
						log("Too many attempts to click login button and still haven't seen FB traffic, probably failed to locate login button.");
						log("Site doesn't support FB login?\n", true);
						automatedTesting.finishedTesting(true);			//we consider this as non-failure tests.
					}
					else {
						log("Too many attempts to click signup button and still haven't seen FB traffic, probably failed to locate signup button.");
						log("Signup button search doesn't help, test still fails.", true);			//This means cannot find signup button.
						automatedTesting.finishedTesting(false);
					}
				}
				else {
					if (capturingPhase <= 5 && searchingForLoginButton){
						//switch to detect invisible button mode.
						loginClickAttempts = 0;
						loginButtonClicked = false;
						loginButtonOuterHTML = "";
						loginButtonXPath = "";
						redirectDomain = "";
						deleteCookies();
						FBSDKDetermined = false;
						sawDialogOAuth = false;
						capturingPhase = 1;
						indexToClick = 0;
						indexToClick2 = 0;
						tryFindInvisibleLoginButton = true;
						log("trying to switch to detecting invisible button mode...");
						//reset stall timer - going into this step means we have made some progress, but phase 2 might be too long.
						stallChecker(true);			//calling this w/ 'true' mean to reset timer.					
						try {testSuiteWorker.port.emit("action",{"action": "navigateTo", "site":siteToTest});} catch(ex){log("testSuiteWorker hidden frame error 1");}
					}
					else {
						log("Login button used to work for previous login attempts, but failed for this attempt.");
						log("Login button used to work for previous login attempts, but failed for this attempt.",true);
						automatedTesting.finishedTesting(false);
					}
				}
			}
			else {
				//haven't searched through all combinations, we need to try other possibilities.
				if (capturingPhase <= 5 && searchingForLoginButton){
					if (indexToClick2<2) {indexToClick2++;}								//mix it up
					else if (indexToClick<2) {indexToClick++; indexToClick2 = 0;}		//mix it up
					loginClickAttempts = 0;
					loginButtonClicked = false;
					loginButtonOuterHTML = "";
					loginButtonXPath = "";
					redirectDomain = "";
					deleteCookies();
					FBSDKDetermined = false;
					sawDialogOAuth = false;
					capturingPhase = 1;
					log("trying to click the combination of " + (indexToClick+1).toString() + "th highest scoring node for the first click and " + (indexToClick2+1).toString() + "th highest scoring node for the second click.");
					try {testSuiteWorker.port.emit("action",{"action": "navigateTo", "site":siteToTest});} catch(ex){log("testSuiteWorker hidden frame error 2");}
				}
				else {
					log("Login button used to work for previous login attempts, but failed for this attempt.");
					log("Login button used to work for previous login attempts, but failed for this attempt.",true);
					automatedTesting.finishedTesting(false);
				}
			}
			closeAllOtherTabs();
			return;
		}
		loginClickAttempts++;
		try {pressLoginButtonWorker.port.emit("indexOfLoginButtonToPress",{"shouldClick":shouldClick, "tryFindInvisibleLoginButton":tryFindInvisibleLoginButton, "indexToClick": (loginClickAttempts == 1 ? indexToClick : indexToClick2), "loginClickAttempts":loginClickAttempts});} catch(ex){log("pressLoginButtonWorker hidden frame error 1");}
		prepareLoginButtonIndexToClickTimer = window.setTimeout(prepareLoginButtonIndexToClick,10000);
	}
}

function testSuitePhase2(url){
	//Clicked on the facebook login button and https://www.facebook.com/dialog/oauth/ is visited.
	assume(capturingPhase == 2, "Phase 2 violation");
	log('Phase 2 - https://www.facebook.com/dialog/oauth/ request header and url captured for session A.\n');
	storageRecord[siteToTest].facebookDialogOAuthRequest = bufferedRequests[url];
	capturingPhase++;
	loginClickAttempts = 0;					//do not reset indexToClick or related variable to save for next time.
}

function testSuitePhase3(url){
	//After visit to https://www.facebook.com/dialog/oauth/, this function is called when subsequent visit to https://www.facebook.com/dialog/oauth/read or write or permissions.request happens.
	assume(capturingPhase == 3, "Phase 3 violation");
	resetIframeClickedInfo();
	if (usedFBSDK && (bufferedResponses[url].body.substr(0,42)=='<script type="text/javascript">var message' || bufferedResponses[url].body.substr(0,42)=='<script type="text/javascript">\nvar messag'))
	{
		log('Phase 3 - captured FB OAuth response.\n');
		storageRecord[siteToTest].facebookDialogOAuthResponse = bufferedResponses[url];
		updateCredentialsInfoForPersistentThreats(storageRecord[siteToTest].facebookDialogOAuthResponse.body,"url");
		capturingPhase++;
		if (!registrationNeeded){
			delayRefreshTestTabTimer = window.setTimeout(delayRefreshTestTab,15000);			//after 15 seconds, refresh the homepage.
		}
		else{
			tryToRegisterInMainFrameTimer = window.setTimeout(tryToRegisterInMainFrame, 15000);				//if the site needs register, after 15 seconds, try register the user.
		}
	}
	else if (!usedFBSDK)
	{
		log('Phase 3 - captured FB OAuth response.\n');
		storageRecord[siteToTest].facebookDialogOAuthResponse = bufferedRequests[url];			//If it doesn't use FBSDK, all we care about is the URL.
		if (additionalRedirectInfo!="") storageRecord[siteToTest].facebookDialogOAuthResponse.url = additionalRedirectInfo;		//if phase 3 had 302, add all the additional info.
		updateCredentialsInfoForPersistentThreats(storageRecord[siteToTest].facebookDialogOAuthResponse.url,"url");
		capturingPhase++;
		if (oldRedirectDomain != "") {
			log("restored redirect domain to previous value.");
			redirectDomain = oldRedirectDomain;
		}
		if (!registrationNeeded){
			delayRefreshTestTabTimer = window.setTimeout(delayRefreshTestTab,15000);			//after 15 seconds, refresh the homepage.
		}
		else{
			tryToRegisterInMainFrameTimer = window.setTimeout(tryToRegisterInMainFrame, 15000);				//if the site needs register, after 15 seconds, try register the user.
		}
	}
}

function testSuitePhase4(url){
	//Getting authenticated session headers data.
	assume(capturingPhase == 4, "Phase 4 violation");
	credentialsInserted = false;			//consume it.
	log('Phase 4 - Saw traffic to test site again.\n');
	supportFBLogin = true;				//this is set to true and is only changed back to false when a new test starts.
	storageRecord[siteToTest].authenticatedSessionRequest = bufferedRequests[url];					//Here the request/respond might not be correct, as the site might need registration;  However, testSuitePhase4 will be called multiple times and in the end we should eventually get the correct response and request.
	storageRecord[siteToTest].authenticatedSessionResponse = bufferedResponses[url];
	if (oldCapturingURLs.length != 0) capturingURLs = oldCapturingURLs;
	capturingPhase++;
	if (!registrationNeeded) checkLoginButtonRemovedTimer = window.setTimeout(checkLoginButtonRemoved, 12000);
	else extractContentTimer = window.setTimeout(extractContent,12000);
}

function tryToRegisterInMainFrame(){
	if (capturingPhase != 4 && capturingPhase != 10) return;			//HTTPS-iframe worker may have already registered, don't do anything here.
	if (iframeRegistrationSubmitted) {
		//HTTPS-iframe already submitted the registration, just call testRegisterSuccess
		testRegisterSuccessTimer = window.setTimeout(testRegisterSuccess, 1000);
		return;							
	}
	try {
		registrationWorker.port.emit("startRegister",{"elementsToFill":elementsToFill, "buttonToClick":buttonToClick});
	} catch (ex) {
		registrationWorker = originalRegistrationWorker;		//fall back to original worker, new worker might be already dead.
		tryToRegisterInMainFrameTimer = window.setTimeout(tryToRegisterInMainFrame,10000);
	}
}

function testRegisterSuccess(){
	testRegistrationInProgress = true;
	tabs.open({url: siteToTest, inBackground: true});
	checkLoginButtonRemovedTimer = window.setTimeout(checkLoginButtonRemoved, 10000);
}

function delayRefreshTestTab()
{
	if (capturingPhase == 4 || capturingPhase == 10) {
		readyToRecordSessionData = true;				//make sure delay refresh tab is executed before testSuitePhase4 and testSuitePhase10.
		try {
			testSuiteWorker.port.emit("action",{"action": "navigateTo", "site":siteToTest});
		} 
		catch(ex){
			log("testSuiteWorker phase 4 hidden frame error - probably page still loading... retry in 10 secs");
			delayRefreshTestTabTimer = window.setTimeout(delayRefreshTestTab, 10000);
		}
	}
}

function checkLoginButtonRemoved(){
	if (registrationNeeded) testRegistrationInProgress = false;
	try{
		pressLoginButtonWorker.port.emit("sendLoginButtonInformation", {"indexToClick":indexToClick, "tryFindInvisibleLoginButton": tryFindInvisibleLoginButton, "account":accountsInfo, "searchForSignUpForFB":searchForSignUpForFB});
	} catch(ex){
		log("pressloginworker hidden frame error - likely caused by host page still loading, will try again in 10 seconds.");
		checkLoginButtonRemovedTimer = window.setTimeout(checkLoginButtonRemoved, 10000);
	}
}

function revisitSiteAnonymously(){	
	assume(capturingPhase == 5, "revisitSiteAnonymously violation");
	log('Phase 5 - deleting cookies and revisit the test site for a second time.\n');
	iframeRegistrationSubmitted = false;			//reset this flag after account A registration is completed.
	registerAttempts = 0;							//reset this value too.
	deleteCookies();
	capturingPhase++;
	try{testSuiteWorker.port.emit("action",{"action": "navigateTo", "site":siteToTest});} catch(ex){log("testsuiteworker hidden frame error 3");}
}

function testSuitePhase7(url){
	assume(capturingPhase == 7, "Phase 7 violation");
	log('Phase 7 - recorded anonymous header data for a second time.\n');
	storageRecord[siteToTest].anonymousSessionRequest2 = bufferedRequests[url];
	storageRecord[siteToTest].anonymousSessionResponse2 = bufferedResponses[url];
	capturingPhase++;
}

function testSuitePhase8(url){
	//Clicked on the facebook login button and https://www.facebook.com/dialog/oauth/ is visited.
	assume(capturingPhase == 8, "Phase 8 violation");
	resetIframeClickedInfo();
	credentialsInserted = false;			//consume it.
	log('Phase 8 - For session B we saw visit to https://www.facebook.com/dialog/oauth/, but we do not need to capture this time.\n');
	capturingPhase++;
	loginClickAttempts = 0;				//reset login click attempts
}

function testSuitePhase9(url){
	//After visit to https://www.facebook.com/dialog/oauth/, this function is called when subsequent visit to https://www.facebook.com/dialog/oauth/read or write or permissions.request happens.
	assume(capturingPhase == 9, "Phase 9 violation");
	if ((bufferedResponses[url].body.substr(0,42)=='<script type="text/javascript">var message' || bufferedResponses[url].body.substr(0,42)=='<script type="text/javascript">\nvar messag')&& usedFBSDK)
	{
		log('Phase 9 - seen FB OAuth response for session B.\n');
		capturingPhase++;
		if (!registrationNeeded){
			delayRefreshTestTabTimer = window.setTimeout(delayRefreshTestTab,15000);			//after 15 seconds, refresh the homepage.
		}
		else{
			tryToRegisterInMainFrameTimer = window.setTimeout(tryToRegisterInMainFrame, 15000);				//if the site needs register, after 10 seconds, try register the user.
		}
	}
	else if (!usedFBSDK)
	{
		log('Phase 9 - seen FB OAuth response for session B.\n');
		capturingPhase++;
		if (oldRedirectDomain != "") {
			log("restored redirect domain to previous value.");
			redirectDomain = oldRedirectDomain;
		}
		if (!registrationNeeded){
			delayRefreshTestTabTimer = window.setTimeout(delayRefreshTestTab,15000);			//after 15 seconds, refresh the homepage.
		}
		else{
			tryToRegisterInMainFrameTimer = window.setTimeout(tryToRegisterInMainFrame, 15000);				//if the site needs register, after 10 seconds, try register the user.
		}
	}
}

function extractContent(){
	try{testSuiteWorker.port.emit("action",{"action":"extractContent"});} catch(ex){
		log("testSuiteworker hidden frame error 4, retrying in 10 secs...");
		extractContentTimer = window.setTimeout(extractContent,10000);
	}
}

function testSuitePhase10(url){
	if (capturingPhase == 1) {
		try {testSuiteWorker.port.emit("action",{"action": "navigateTo", "site":siteToTest});} catch(ex){
			window.setTimeout(testSuitePhase10.bind(window,url),10000);
			log("testSuiteWorker hidden frame error 1, waiting for 10 secs.");
		}
		return;
	}
	assume(capturingPhase == 10, "Phase 10 violation");
	log('Phase 10 - recorded account B header data.\n');
	if (!searchForSignUpForFB){
		storageRecord[siteToTest].authenticatedSessionRequest2 = bufferedRequests[url];
		storageRecord[siteToTest].authenticatedSessionResponse2 = bufferedResponses[url];
		if (oldCapturingURLs.length != 0) capturingURLs = oldCapturingURLs;
		capturingPhase++;
		if (!registrationNeeded) checkLoginButtonRemovedTimer = window.setTimeout(checkLoginButtonRemoved, 12000);
		else extractContentTimer = window.setTimeout(extractContent,12000);
	}
	else {
		startOver();
		capturingPhase = 1;
		testedSearchForSignUp = true;
		log("Register completed, now wait 10 secs (for page to load) and go back to phase 1 and restart the login SSO process");
		window.setTimeout(testSuitePhase10.bind(window,url),10000);
	}
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
		searchingForLoginButton = false;
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
		if (!readyToRecordSessionData) return;
		readyToRecordSessionData = false;
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
		if (!readyToRecordSessionData) return;
		readyToRecordSessionData = false;
		loginButtonClicked = false;				//set it up for the next authenticated session visit.
		testSuitePhase10(url);
		return;
	}
}

function processLoaded(url){
	if (capturingPhase == 0 && checkAgainstFilter(url, capturingPhase))
	{
		//first visit done
		log('Phase 0 - done loading anonymously the first time.\n');
		capturingPhase++;
		window.setTimeout( function(){try{testSuiteWorker.port.emit("action",{"action": "navigateTo", "site":siteToTest});} catch(ex){log("testSuiteWorker hidden frame error 5");}}, 2000);
		return;
	}
	if (capturingPhase == 6 && checkAgainstFilter(url, capturingPhase))
	{
		//second visit done
		log('Phase 6 - done loading anonymously the second time.\n');
		window.setTimeout( function(){capturingPhase++;try{testSuiteWorker.port.emit("action",{"action": "navigateTo", "site":siteToTest});} catch(ex){log("testSuiteworker hidden frame error 6");}}, 2000);
		return;
	}
	capturingPhase = checkToken.processLoaded(url);			//access_token vulnerability
	capturingPhase = checkSR.processLoaded(url);			//sr vulnerability
}


//Traffic interceptors.

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
			
				var notAppsFacebookComDomain = true;
				if ((capturingPhase == 3 || capturingPhase == 9) && !usedFBSDK)
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
						if (newRedirectURI && newRedirectURI.indexOf('http')==0) {
							//still keep the old value so that we can restore it later.
							var protocol = newRedirectURI.substr(0,newRedirectURI.indexOf('/')) + "//";
							newRedirectURI = newRedirectURI.substr(newRedirectURI.indexOf('/')+2,newRedirectURI.length);
							newRedirectURI = newRedirectURI.substr(0,newRedirectURI.indexOf('/'));
							newRedirectURI = protocol + newRedirectURI;
							if (newRedirectURI != redirectDomain){
								log("Redirect domain changed to: " + newRedirectURI);
								if (oldRedirectDomain == "") oldRedirectDomain = redirectDomain;
								redirectDomain = newRedirectURI;
							}
						}
					}
					catch(ex){};
				}
				if (capturingPhase == 4 || capturingPhase == 10){
					try {
						var newSiteToDetect = gchannel.getResponseHeader('Location');
						if (newSiteToDetect.indexOf('#')!=-1) newSiteToDetect = newSiteToDetect.substr(0,newSiteToDetect.indexOf('#'))		//get rid of the sharp.
						if (newSiteToDetect) {
							//if it's a relative path, we need to pad it to full path.
							if (newSiteToDetect.indexOf('http')!=0){
								//get rid of the first slash if there is one.
								if (newSiteToDetect.indexOf('/')==0) newSiteToDetect = newSiteToDetect.substr(1,newSiteToDetect.length);
								newSiteToDetect = url + newSiteToDetect;
							}
							//still keep the old value so that we can restore it later.
							if (capturingURLs.indexOf(newSiteToDetect)==-1){
								if (oldCapturingURLs.length == 0) oldCapturingURLs = capturingURLs;
								capturingURLs.push(newSiteToDetect);
								log("capturingURLs appended with: " + newSiteToDetect);
							}
						}
					}
					catch(ex){};
				}
				
				if (url.startsWith("https://www.facebook.com/dialog/oauth") || url.startsWith("http://www.facebook.com/dialog/oauth")) {
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
				if ((url.startsWith("https://www.facebook.com/dialog/oauth") || url.startsWith("http://www.facebook.com/dialog/oauth")) && !FBSDKDetermined && notAppsFacebookComDomain){
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
							if (redirectDomain.indexOf("http://www.facebook.com/dialog/return")==0) {
								loginButtonClicked = true;			//this must be clicked from an iframe, let's make sure this var is set to true.
								log("Site uses social plugin button.php, redirect domain changed to http://static.ak.facebook.com/connect/xd_arbiter.php");
								redirectDomain = "http://static.ak.facebook.com/connect/xd_arbiter.php";
							}
							else if (redirectDomain.indexOf("https://www.facebook.com/dialog/return")==0) {
								loginButtonClicked = true;			//this must be clicked from an iframe, let's make sure this var is set to true.
								log("Site uses social plugin button.php, redirect domain changed to https://s-static.ak.facebook.com/connect/xd_arbiter.php");
								redirectDomain = "https://s-static.ak.facebook.com/connect/xd_arbiter.php";
							}
							else {
								var protocol = redirectDomain.substr(0,redirectDomain.indexOf('/')) + "//";
								redirectDomain = redirectDomain.substr(redirectDomain.indexOf('/')+2,redirectDomain.length);
								redirectDomain = redirectDomain.substr(0,redirectDomain.indexOf('/'));
								redirectDomain = protocol + redirectDomain;
								//this is a workaround on FB's decode URI function differs from JS's decodeURIComponent function. It abandons the tail of the URL.
							}
						}
						log('the redirect domain is: '+redirectDomain);
					}
					else {
						usedFBSDK = true;
						log('This site uses FB SDK');
					}
				}
				
				//need to check dialog oauth existence to allow capturingPhase to grow to 3/9
				if ((url.startsWith("https://www.facebook.com/dialog/oauth") || url.startsWith("http://www.facebook.com/dialog/oauth")) && notAppsFacebookComDomain)
				{
					sawDialogOAuth = true;
				}
				
				//for registration plugins
				if (url.indexOf("social_plugin%3Dregistration")!=-1 && searchForSignUpForFB && (capturingPhase == 2 || capturingPhase == 8)){
					sawDialogOAuth = true;
					usedFBSDK = false;
					redirectDomain = "https://www.facebook.com/plugins/registration.php";
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

//For detecting error configurations in app

function FBSSOErrorTracingListener() {
    this.originalListener = null;
}

FBSSOErrorTracingListener.prototype =
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
		//we leave this here because we want to interrupt normal data
		if (data.indexOf('This app is in sandbox mode.  Edit the app configuration at')!=-1 || data.indexOf('This+app+is+in+sandbox+mode.++Edit+the+app+configuration+at')!=-1)
		{
			log('Site support FB but its configuration is in an error state.\n',true);
			automatedTesting.finishedTesting(true);
			return;
		}				
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

var FBSSOErrorObserver =
{
    observe: function(aSubject, aTopic, aData)
    {
        if (aTopic == "http-on-examine-response")
        {
			var newListener = new FBSSOErrorTracingListener();
			aSubject.QueryInterface(Ci.nsITraceableChannel);
			newListener.originalListener = aSubject.setNewListener(newListener);
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

observerService.addObserver(FBSSOErrorObserver, "http-on-examine-response", false);
///////

//exports
exports.initPressLoginButton = function(worker){
	pressLoginButtonWorker = worker;
	//listen to events
	pressLoginButtonWorker.port.on("loginInfo",function(info){
			resetIframeClickedInfo();
			if (capturingPhase == 2 && loginClickAttempts == 1) {
				loginButtonOuterHTML = info.loginButtonOuterHTML;			//only record when pressing login button in phase 2.
				loginButtonXPath = info.loginButtonXPath;
				log("Recorded First 100 chars of the outerHTML of the clicked login button is: "+loginButtonOuterHTML.substr(0,100));
				log("Recorded XPath of the clicked login button is: "+loginButtonXPath);
			}
			log("pressing Login button @ XPath from top: " + info.loginButtonXPath);
			try { pressLoginButtonWorker.port.emit("readyToClick","readyToClick");} catch(ex){log("pressLoginButtonWorker hidden frame error 2");}
		}
	);
	pressLoginButtonWorker.port.on("noLoginButtonFound",function(){
		resetIframeClickedInfo();
		//performance optimization, this function body can be empty if we don't care about performance.
		log("No login button found under this configuration, fast-forwarding...");
		if (loginClickAttempts == 2) indexToClick2 = 2;
		if (loginClickAttempts == 1) {indexToClick = 2;indexToClick2 = 2;loginClickAttempts=2;}
		if (prepareLoginButtonIndexToClickTimer) window.clearTimeout(prepareLoginButtonIndexToClickTimer);
		prepareLoginButtonIndexToClick();
	});
	pressLoginButtonWorker.port.on("getIndexOfLoginButtonToPress", prepareLoginButtonIndexToClick);
	pressLoginButtonWorker.port.on("clearPressLoginButtonTimer", function(response){
		if (prepareLoginButtonIndexToClickTimer) window.clearTimeout(prepareLoginButtonIndexToClickTimer);			//this happens when a new page loads. When this happens, we want to clear the old timer, and try to click the login button in this new page.
	});
	pressLoginButtonWorker.port.on("checkTestingStatus", function(response){
		var shouldClick = (capturingPhase == 2 || capturingPhase == 8);
		shouldClick = shouldClick || checkToken.shouldClickLoginButton() || checkSR.shouldClickLoginButton();
		try {if (shouldClick) pressLoginButtonWorker.port.emit("checkTestingStatus",{"shouldClick":shouldClick, "account":accountsInfo, "searchForSignUpForFB":searchForSignUpForFB});} catch(ex){log("pressLoginButtonWorker hidden frame error 3");}
	});
	pressLoginButtonWorker.port.on("sendLoginButtonInformation", function(response){
		log("Current login button xpath: "+response.loginButtonXPath);
		log("First 100 chars of the current login button outerHTML: "+response.loginButtonOuterHTML.substr(0,100));
		var loginFailure;
		if (response.loginButtonXPath == "USER_INFO_EXISTS!" && response.loginButtonOuterHTML == "USER_INFO_EXISTS!") {
			log("login successful! After logging in the user information is present!");
			loginFailure = false;
		}
		else if ((response.loginButtonXPath == loginButtonXPath || response.loginButtonOuterHTML == loginButtonOuterHTML) && (redirectDomain != 'http://static.ak.facebook.com/connect/xd_arbiter.php' && redirectDomain != 'https://s-static.ak.facebook.com/connect/xd_arbiter.php')) {
			//if it's the social widget scenario, we always assume the login button is gone after logging in.
			log("login failed! After logging in the login button is still present!");
			loginFailure = true;
		}
		else {
			log("login successful, but oracle failed.");
			if (storageRecord[siteToTest].facebookDialogOAuthResponse) {
				var res = storageRecord[siteToTest].facebookDialogOAuthResponse.body;
				if (!usedFBSDK) res = storageRecord[siteToTest].facebookDialogOAuthResponse.url;		//means the app didn't use the SDK, which means the actual redirect url is in the 302 url, as opposed to javascript content.
				var score = 0;
				if (typeof res == "string" && res.indexOf('access_token')==-1) {
					log("This doesn't matter because access_token is not seen in this traffic.");
					log(siteToTest + " is not vulnerable to [1], access_token not spotted (oracle not working).", true);
					score++;
				}
				if (typeof res == "string" && res.indexOf('signed_request')==-1) {
					log("This doesn't matter because signed_request is not seen in this traffic.");
					log(siteToTest + " is not vulnerable to [3], signed_request not spotted (oracle not working).", true);
					score++;
				}
				if (score<2) {
					log(siteToTest + " failed because oracle failed though we are able to login.", true);
					automatedTesting.finishedTesting(false);
				}
				else {
					automatedTesting.finishedTesting(true);
				}
			}
			return;
		}
		if (loginFailure){
			if (testedSearchForSignUp){
				log("Cannot login to this site after registered successfully, this is a corner case.",true);
				log("Cannot login to this site after registered successfully, this is a corner case.");
				automatedTesting.finishedTesting(false);
				return;
			}
			if (!registrationNeeded) {
				//Need to return to phase - 4 and set registration flag.
				loginClickAttempts = 0;
				loginButtonClicked = false;
				deleteCookies();
				sawDialogOAuth = false;
				capturingPhase = capturingPhase - 4;
				registrationNeeded = true;
				closeAllOtherTabs();
				log("Site needs registration, returning to phase " + capturingPhase.toString() + " and set the flag");
				try {testSuiteWorker.port.emit("action",{"action": "navigateTo", "site":siteToTest});} catch(ex){log("testSuiteWorker hidden frame error 7");}
				return;
			}
			else {
				//registration failed.
				//HTTPS-Iframe submission already clicked twice, don't need to do it again; Host page submission only clicked once, need to do it again.
				if (registerAttempts < 2 && !iframeRegistrationSubmitted)
				{
					registerAttempts++;
					closeAllOtherTabs();
					log("Trying to register for the " + registerAttempts.toString() + "th time...");
					tryToRegisterInMainFrame();
					return;
				}
				else {
					log("Cannot figure out how to register this site, give up...");
					if (searchForSignUpForFB) {
						log("Cannot register this site when searching for signup button... Give up.",true);
						automatedTesting.finishedTesting(false);
						return;
					}
					else {
						if (capturingPhase <= 5) {
							testedSearchForSignUp = true;
							searchForSignUpForFB = true;
							loginClickAttempts = 0;
							loginButtonClicked = false;
							loginButtonOuterHTML = "";
							loginButtonXPath = "";
							redirectDomain = "";
							deleteCookies();
							FBSDKDetermined = false;
							sawDialogOAuth = false;
							capturingPhase = 1;
							indexToClick = 0;
							indexToClick2 = 0;
							tryFindInvisibleLoginButton = conf.tryFindInvisibleLoginButton || false;
							searchingForLoginButton = true;
							registrationNeeded = conf.registrationNeeded || false;
							closeAllOtherTabs();
							stallChecker(true);
							log("trying to switch to detecting signup button mode...");
							log("Cannot register this site when searching for login button, switching to detect sign up button.",true);
							try {testSuiteWorker.port.emit("action",{"action": "navigateTo", "site":siteToTest});} catch(ex){log("testSuiteWorker hidden frame error 1");}
						}
						else {
							log("Registration used to work for previous login attempts, but failed for this attempt.");
							log("Registration used to work for previous login attempts, but failed for this attempt.",true);
							automatedTesting.finishedTesting(false);
						}
					}
				}
			}
		}
		else {
			//login successful.
			if (!registrationNeeded) {
				assume(capturingPhase == 5 || 11, "sendLoginButtonInformation violation");
				try{ testSuiteWorker.port.emit("action",{"action":"extractContent"});} catch(ex){log("testSuiteWorker hidden frame error 8");}
			}
			else {
				assume(capturingPhase == 4 || 10, "sendLoginButtonInformation violation");
				closeAllOtherTabs();
				delayRefreshTestTabTimer = window.setTimeout(delayRefreshTestTab,2000)					//Now we can refresh main tab.
			}
		}
	});
};

exports.initIFramePressLoginButtonWorker = function(worker) {
	worker.port.on("checkTestingStatus", function(response){
		var shouldClick = (capturingPhase == 2 || capturingPhase == 8);
		shouldClick = shouldClick || checkToken.shouldClickLoginButton() || checkSR.shouldClickLoginButton();
		try {if (shouldClick) worker.port.emit("checkTestingStatus",{shouldClick:shouldClick, indexToClick:indexToClick2, "account":accountsInfo, "loginClickAttempts":loginClickAttempts+1, "debug":debug, "searchForSignUpForFB":searchForSignUpForFB, "iframeClickedXPATH":iframeClickedXPATH, "iframeClickedOuterHTML":iframeClickedOuterHTML, "tryFindInvisibleLoginButton":tryFindInvisibleLoginButton});} catch(ex){log("IFrame press login button worker hidden frame error");}			//Only gives indexToClick2 because we assume the first click is not from iframe, the second is.
	});
	worker.port.on('loginButtonClicked', function(response){
		if (redirectDomain == 'http://static.ak.facebook.com/connect/xd_arbiter.php' || redirectDomain == 'https://s-static.ak.facebook.com/connect/xd_arbiter.php'){
			loginButtonClicked = true;			//if it's the social login widget scenario.
		}
		if (response.shouldCountClick){
			loginButtonClicked = true;			//if it's the social registration widget scenario.
		}
		//record what's been clicked and inform iframes next time they ask.
		iframeClickedXPATH.push(response.loginButtonXPath);
		iframeClickedOuterHTML.push(response.loginButtonOuterHTML);
	});
	worker.port.on("writeToFileRequest",writeToFileRequest);
}

exports.initAutomateSSOWorker = function(worker){
	if (worker.tab.i == undefined)
	{
		worker.tab.i = tabs.length;
		if (worker.tab.i != 1) log("Tab " + worker.tab.i.toString()+" created.");
		else if (!calledCheckAndRedoCredentials) {calledCheckAndRedoCredentials = true; window.setTimeout(check_and_redo_credentials,1000);}
	}
	automateSSOWorker = worker;
	automateSSOWorker.port.on("requestFBAccount",function(){
		try {automateSSOWorker.port.emit("requestFBAccount",{FBAccount:FBAccount, shouldAutomateSSO:(yetToInitCredentials || capturingPhase == 3 || capturingPhase == 9 || checkToken.shouldAutomateSSO() || checkSR.shouldAutomateSSO())});}
		catch (ex) {log("Tab closed itself too quick, must not be automateSSO situation, ignore hidden frame error.");}
	});
	automateSSOWorker.port.on("credentialsInserted",function(){
		credentialsInserted = true;
		automateSSOWorker.port.emit("goAheadAndClick","");
	});
	automateSSOWorker.port.on("appError",function(){
		log('Site support FB but its configuration is in an error state.\n',true);
		automatedTesting.finishedTesting(true);
	});
	if (typeof accountsInfo == "undefined"){
		automateSSOWorker.port.emit("requestAccountInfo","");
		automateSSOWorker.port.on("requestAccountInfo",function(response){
			accountsInfo = response;
		});
	}
}

exports.initRegistrationWorker = function(worker){
	var prepareUserInfo = function (response){
		if (typeof accountsInfo != "undefined"){
			try {registrationWorker.port.emit("issueUserInfo",{"accountsInfo":accountsInfo[FBAccount-1], "debug":debug});} catch (ex) {
				//dont do anything, since the previous window is closed.
			}
		}
		else {
			window.setTimeout(prepareUserInfo,500);
		}
	}
	if (worker.tab.i == 1)
	{
		originalRegistrationWorker = worker;
	}
	registrationWorker = worker;
	registrationWorker.port.on("registrationSubmitted",function(response){
		buttonToClick = response.buttonToClick;
		elementsToFill = response.elementsToFill;
		testRegisterSuccessTimer = window.setTimeout(testRegisterSuccess,10000);			//after 10 seconds, test if registration is successful.
	});
	registrationWorker.port.on("registrationFailed", function(response){
		//this message is received because worker cannot find submit button.
		log(response.errorMsg);
		if (searchForSignUpForFB){
			log("Cannot register this site when searching for signup button... Give up.",true);
			automatedTesting.finishedTesting(false);
		}
		else {
			if (capturingPhase <= 5) {
				testedSearchForSignUp = true;
				searchForSignUpForFB = true;
				loginClickAttempts = 0;
				loginButtonClicked = false;
				loginButtonOuterHTML = "";
				loginButtonXPath = "";
				redirectDomain = "";
				deleteCookies();
				FBSDKDetermined = false;
				sawDialogOAuth = false;
				capturingPhase = 1;
				indexToClick = 0;
				indexToClick2 = 0;
				tryFindInvisibleLoginButton = conf.tryFindInvisibleLoginButton || false;
				searchingForLoginButton = true;
				registrationNeeded = conf.registrationNeeded || false;
				stallChecker(true);
				closeAllOtherTabs();
				log("trying to switch to detecting signup button mode...");
				log("Cannot register this site when searching for login button, switching to detect sign up button.",true);
				try {testSuiteWorker.port.emit("action",{"action": "navigateTo", "site":siteToTest});} catch(ex){log("testSuiteWorker hidden frame error 1");}
			}
			else {
				log("Registration used to work for previous login attempts, but failed for this attempt.");
				log("Registration used to work for previous login attempts, but failed for this attempt.",true);
				automatedTesting.finishedTesting(false);
			}
		}
	});
	registrationWorker.port.on("getUserInfo",prepareUserInfo);
	registrationWorker.port.on("writeToFileRequest",writeToFileRequest);
}

exports.initIFrameRegistrationWorker = function(worker) {
	var prepareUserInfo = function (response){
		if (typeof accountsInfo != "undefined"){
			worker.port.emit("issueUserInfo",accountsInfo[FBAccount-1]);
		}
		else {
			window.setTimeout(prepareUserInfo,500);
		}
	}
	worker.port.on("shouldRegisterIframe", function (response){
		try {
			worker.port.emit("shouldRegisterIframe", {"shouldRegisterIframe":((capturingPhase == 4 || capturingPhase == 10) && registrationNeeded), "debug":debug});
		} catch(ex){
			log("initFrameRegistrationWorker hidden frame error.");
		}
	});
	worker.port.on("getUserInfo",prepareUserInfo);
	worker.port.on("registrationSubmitted",function(response){
		//iframe https submitted
		buttonToClick = response.buttonToClick;
		elementsToFill = response.elementsToFill;
		iframeRegistrationSubmitted = true;
		//10 seconds after initial submit button click, call checkloginstatus. Note that during this 10 secs submit button may be clicked for a second time.
	});
	worker.port.on("writeToFileRequest",writeToFileRequest);
}
	
exports.initTestSuiteWorker = function(worker){
	if (worker.tab.i == 1)
	{
		testSuiteWorker = worker;
	}
	else return;
	testSuiteWorker.port.on("loadedURL",function(url){
		if (url != undefined) processLoaded(url);
	});
	
	var extraCapturingURLs = function (site){
		if (capturingPhase != 0) return;
		if (site.indexOf('#')!=-1) site = site.substr(0,site.indexOf('#'))		//get rid of the sharp.
		log("Redirection detected - capturingURLs appended with " + site);
		capturingURLs.push(site);
		try {
			testSuiteWorker.port.emit("action", {"site": siteToTest, "action": "navigateTo"});
		} catch(ex){log("testSuiteWorker hidden frame error 10");}
		checkRedirectionAndAdjustTimer = window.setTimeout(checkRedirectionAndAdjust,10000);	//check if phase is > 0, if not, indicates the website redirected itself. We make adjustments according to it.
	}
	testSuiteWorker.port.on("getURL", extraCapturingURLs);
	testSuiteWorker.port.on("siteToTest", startTest);
	testSuiteWorker.port.on("extractedContent", function(response){
		responseTextContent[FBAccount] = response;
		if (FBAccount == 1){
			log("Recorded extracted content from session 1.");
			revisitSiteAnonymously();
		}
		else if (FBAccount == 2){
			log("Phase 11: recorded extracted content from session 2, ready to evaluate for access_token vulnerability.");
			capturingPhase++;
			observerService.removeObserver(httpRequestObserver, "http-on-examine-response");			//control passed onto next module, current observer not needed.
			removedObserver = true;
			inBetweenModule();
			checkToken.init(capturingPhase);
		}
	});
}

exports.deleteCookies = deleteCookies;
exports.closeAllOtherTabs = closeAllOtherTabs;

exports.check_and_redo_credentials = check_and_redo_credentials;


exports.supportFBLogin = function(){return supportFBLogin;};
exports.testSuiteStart = testSuiteStart;
exports.saveToFile = saveToFile;
exports.fileNameSanitize = fileNameSanitize;
exports.resetIframeClickedInfo = resetIframeClickedInfo;
exports.log = log;
exports.debug = function(){return debug;};
exports.siteToTest = function(){return siteToTest;};
exports.storageRecord = function(){return storageRecord;};
exports.accountsInfo = function(){return accountsInfo;};
exports.responseTextContent = function(){return responseTextContent;};
exports.testSuiteWorker = function(){return testSuiteWorker;};
exports.automateSSOWorker = function(){return automateSSOWorker;};
exports.pressLoginButtonWorker = function(){return pressLoginButtonWorker;};
exports.registrationWorker = function(){return registrationWorker;};
exports.capturingPhase = function(){return capturingPhase;};
exports.capturingURLs = function(){return capturingURLs;};
exports.loginButtonXPath = function(){return loginButtonXPath;};
exports.loginButtonOuterHTML = function(){return loginButtonOuterHTML;};
exports.indexToClick = function(){return indexToClick;};
exports.indexToClick2 = function(){return indexToClick2;};
exports.credentialsInserted = function(){return credentialsInserted;};
exports.testOverallSuccess = function(){return testOverallSuccess;};
exports.credentialsForPersistentThreats = function(){return credentialsForPersistentThreats;};
exports.detectionMode = function(){return detectionMode};
exports.tryFindInvisibleLoginButton = function(){return tryFindInvisibleLoginButton;};
exports.usedFBSDK = function(){return usedFBSDK;};
exports.testRegistrationInProgress = function(){return testRegistrationInProgress;};
exports.redirectDomain = function(){return redirectDomain;};
exports.loginButtonClicked = function(){return loginButtonClicked;};
exports.setCapturingPhase = function(p){capturingPhase = p; return;};
exports.setFBAccount = function(p){FBAccount = p; return;};
exports.setRedirectDomain = function(p){redirectDomain = p; return;};
exports.setTestOverallSuccess = function(p){testOverallSuccess = p; return;};
exports.setCredentialsInserted = function(p){credentialsInserted = p; return;};
exports.pushCapturingURLs = function(p){capturingURLs.push(p); return;};
exports.restoreCapturingURLs = function(){if (oldCapturingURLs.length!=0) capturingURLs = oldCapturingURLs; return;};
exports.startTest = startTest;
exports.automatedTestingFlag = automatedTestingFlag;
exports.startOver = startOver;
exports.inBetweenModule = inBetweenModule;
exports.resetTab = resetTab;

startOver();
initOutputDir();
PT.init();
//tabs.on('close', function(tab){if (tab.i) tabPool.splice(tab.i,1);});
if (!file.exists(file.join(profilePath, "testResults"))) file.mkpath(file.join(profilePath, "testResults"));
initTab();
console.log("AVC v0.2 ccc.js loaded.");