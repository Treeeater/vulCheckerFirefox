var checkToken = require("./checkToken");
var checkSR = require("./checkSR");
var file = require("sdk/io/file");
var profilePath = require("sdk/system").pathFor("ProfD");
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
var yetToInitCredentials = true;
var calledCheckAndRedoCredentials = false;
var credentialsInserted = false;
var FBSDKDetermined = false;
var sawDialogOAuth = false;
var readyToRecordSessionData = false;	//if delayRefreshTab has been called.
var loginButtonClicked = false;				//used to indicate whether login button has been clicked.
var SSOAutomationStarted = false;			//used to indicate whether SSOAutomation has started.
var removedObserver = false;			//used to indicate if observer has been removed.
var usedFBSDK = true;						//used to indicate if the site used FB SDK or not. If true, the redirect_uri parameter when calling dialog/oauth is set to http(s)://(s-)static.ak.facebook.com/connect/xd_arbiter.php?xxxx; otherwise it is customized to its own domain.
//https%3A%2F%2Fs-static.ak.facebook.com%2Fconnect%2Fxd_arbiter.php
var loginClickAttempts = 0;
var indexToClickLoginButton = 0;			//currently clicking at which attrInfoMap index for clicks (first, % candidateSize, second, /CandidateSize, third, /CandidateSize^2).
var indexToClickSubmitButton = 0;			//currently clicking at which attrInfoMap index for clicks (first, % candidateSize, second, /CandidateSize, third, /CandidateSize^2).
var LoginButtonClickDepth = (!!conf.LoginButtonClickDepth) ? conf.LoginButtonClickDepth : 3;
var SubmitButtonClickDepth = (!!conf.SubmitButtonClickDepth) ? conf.SubmitButtonClickDepth : 3;
var LoginButtonCandidateSize = (!!conf.LoginButtonCandidateSize) ? conf.LoginButtonCandidateSize : 3;
var SubmitButtonCandidateSize = (!!conf.SubmitButtonCandidateSize) ? conf.SubmitButtonCandidateSize : 3;
var registerAttempts = 0;
var accountsInfo;
var shouldRemoveOldLoginWorkers = false;				//after a click happens, if there's a page nav or iframe nav, removes all other workers and focus on that new worker.
var shouldRemoveOldRegisterWorkers = false;				//after a click happens, if there's a page nav or iframe nav, removes all other workers and focus on that new worker.
var credentialsForPersistentThreats = {};

var stallCheckerTimer = 0;
var clickLoginButtonTimer = 0;
var collectCandidatesAndClickNextTimer = 0;
var delayRefreshTestTabTimer = 0;
var checkLoginButtonRemovedTimer = 0;
var checkRedirectionAndAdjustTimer = 0;
var tryToRegisterTimer = 0;
var extractContentTimer = 0;
var testRegisterSuccessTimer = 0;
var testOverallSuccess = true;
var registrationNeeded = conf.registrationNeeded || false;			//whether the site needs registration or not.
var searchForSignUpForFB = conf.searchForSignUpForFB || false;
var testedSearchForSignUp = false;				//used to indicate if we have tried to search for signup button.
var supportFBLogin = false;				//used in automatedTesting.js to determine whether to output vulnerability testing results for [2][4][5].
var searchingForLoginButton = true;		//used to determine if we allow changing indexToClick and stuff.

var loginButtonPool = [];
var submitButtonPool = [];
var curAttemptClicksXPathInfo = [];		//store all candidate information about previous clicks, used for visited page detection.
var XPathHistory = [];					//store all visited (and fully explored) scenarios, so that if a future click lands on the same scenario, skip it.

var loginButtonClickHistory = [];		//record xpath and outerHTML for every element clicked.
var submitButtonClickHistory = [];

var pressLoginButtonWorkers = [];
var registrationWorkers = [];


var log = function(str)
{
	if (debug && arguments.length != 2 && !conf.webService) console.log(str);			//do not display messages written to the general results.txt file.
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
		console.log("Stall timer reset.");
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

function hashCode(s){
	return s.split("").reduce(function(a,b){a=((a<<5)-a)+b.charCodeAt(0);return a&a},0);              
};

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

function initTab(){
	//called after firefox start-up.
	tabs.activeTab.attach({
		contentScript: 'document.location="http://www.cs.virginia.edu/~yz8ra/blank.html"'
	});
}

function getRootDomain(url){
	var domain = "";
	if (url.indexOf('http')!=-1) domain = url.substr(url.indexOf('/')+2,url.length);			//get rid of protocol if there's one.
	if (domain.indexOf('/')!=-1) domain = domain.substr(0,domain.indexOf('/'));					//get rid of paths if there's one.
	if (domain.indexOf(':')!=-1) domain = domain.substr(0,domain.indexOf(':'));					//get rid of port if there's one.
	var domainArray = domain.split('.');
	if (domainArray.length < 2) return "";			//error. Never return TLD.
	domain = domainArray[domainArray.length-2] + '.' + domainArray[domainArray.length-1];
	return domain;
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
		if (url.startsWith(redirectDomain) && credentialsInserted && ((url+additionalRedirectInfo).indexOf('access_token=')!=-1 || (url+additionalRedirectInfo).indexOf('code=')!=-1 || (url+additionalRedirectInfo).indexOf('signed_request=')!=-1)) {
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
	Cc["@mozilla.org/network/cache-service;1"].getService(Ci.nsICacheService).evictEntries(Ci.nsICache.STORE_ON_DISK);;
	Cc["@mozilla.org/network/cache-service;1"].getService(Ci.nsICacheService).evictEntries(Ci.nsICache.STORE_IN_MEMORY);;
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
var long_term_token_url ="https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=265286580246983&client_secret=30d36a8bea17b5307cf8dd167e32c0a2&fb_exchange_token="
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
var additionalRedirectInfo = "";			//two usages: 1) used to store 302 in phase 3, for checkToken.js and similar to use to identify if access_token is seen.
//2): to help checkAgainstFilter to determine if 302 requests contain OAuth credential pattern for it to issue permission to advance to Phase 4/10/whatever.

function startOver(){
	supportFBLogin = false;
	loginClickAttempts = 0;
	registerAttempts = 0;
	indexToClickLoginButton = 0;
	closeAllOtherTabs();
	capturingPhase = -1;
	
	loginButtonPool = [];
	submitButtonPool = [];
	curAttemptClicksXPathInfo = [];	
	XPathHistory = [];
	
	loginButtonClickHistory = [];
	submitButtonClickHistory = [];
	
	redirectDomain = "";
	oldRedirectDomain = "";
	additionalRedirectInfo = "";
	oldCapturingURLs = [];
	pressLoginButtonWorkers = [];
	registrationWorkers = [];
	FBAccount = 1;
	loginButtonClicked = false;
	usedFBSDK = true;
	testOverallSuccess = true;
	FBSDKDetermined = false;
	readyToRecordSessionData = false;
	sawDialogOAuth = false;
	searchingForLoginButton = true;
	testedSearchForSignUp = false;
	shouldRemoveOldLoginWorkers = false;
	shouldRemoveOldRegisterWorkers = false;	
	credentialsForPersistentThreats = {};
	
	registrationNeeded = conf.registrationNeeded || false;
	searchForSignUpForFB = conf.searchForSignUpForFB || false;
	
	deleteCookies();
	window.clearTimeout(delayRefreshTestTabTimer);
	window.clearTimeout(collectCandidatesAndClickNextTimer);
	window.clearTimeout(clickLoginButtonTimer);
	window.clearTimeout(checkLoginButtonRemovedTimer);
	window.clearTimeout(stallCheckerTimer);
	window.clearTimeout(checkRedirectionAndAdjustTimer);
	window.clearTimeout(tryToRegisterTimer);
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
	credentialsInserted = false;
	loginButtonPool = [];
	submitButtonPool = [];
	deleteCookies();
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
	closeAllOtherTabs();
	var tempRecord = new trafficRecord();
	tempRecord.url = siteToTest;
	tempRecord.anonymousSessionRequest = bufferedRequests[url];
	tempRecord.anonymousSessionResponse = bufferedResponses[url];
	storageRecord[siteToTest] = tempRecord;
	capturingPhase++;
}

function collectCandidatesAndClickNext(){
	loginButtonPool = [];
	//last click didn't nav any pages (may have caused JS to manipulate the page), need to recompute candidates.
	for (i = 0; i < pressLoginButtonWorkers.length; i++){
		try {
			pressLoginButtonWorkers[i].port.emit("reportCandidates",{"account":accountsInfo, "searchForSignUpForFB":searchForSignUpForFB, "loginClickAttempts":loginClickAttempts});
		}
		catch (ex){
			pressLoginButtonWorkers.splice(i,1);			//this worker is not active, just remove it.
			i--;
		}
	}
	return;
}

function recordLoginStatus(recordString, futileClick, dupClick){
	//for USENIX experiments
	var i = 0;
	var returnString = recordString;
	for (i = 0; i < loginButtonClickHistory.length; i++){
		returnString += (Math.floor(indexToClickLoginButton/(Math.pow(LoginButtonCandidateSize,LoginButtonClickDepth - 1 - i))) % LoginButtonCandidateSize + 1).toString();
		returnString += "," + loginButtonClickHistory[i].iframe;
		returnString += "," + loginButtonClickHistory[i].visible;
		returnString += "," + loginButtonClickHistory[i].stringSig;
		returnString += "," + loginButtonClickHistory[i].score;			//indicate this is not the correct element to click.
		returnString += "," + loginButtonClickHistory[i].stats;			//indicate this is not the correct element to click.
		returnString += "," + hashCode(loginButtonClickHistory[i].XPath);
		returnString += "," + hashCode(loginButtonClickHistory[i].outerHTML);
		returnString += "," + hashCode(loginButtonClickHistory[i].url) + ";";
	}
	if (futileClick) returnString += "futile,";
	if (dupClick) returnString += "dup,";
	return returnString;
}

function fastForwardNextLoginButton(XPathInfo){
	if (loginClickAttempts == 0) {
		//fast forwarded failure. (indexToClickLoginButton exceeds maximum threshold)
		log("Too many attempts to click login button and still haven't seen FB traffic, probably failed to locate login button.");
		log("Site doesn't support FB login?\n", true);
		automatedTesting.finishedTesting(true);			//we consider this as non-failure tests.
		return;
	}
	indexToClickLoginButton += Math.pow(LoginButtonCandidateSize,LoginButtonClickDepth - loginClickAttempts);		//advance upper level selection by one
	indexToClickLoginButton -= (indexToClickLoginButton % Math.pow(LoginButtonCandidateSize, LoginButtonClickDepth - loginClickAttempts));		//the rest of selection should be cleared.
	if (!!XPathInfo){
		log("The following scenario has been fully explored:\n"+XPathInfo);
		XPathHistory.push(XPathInfo);
	}
	if (indexToClickLoginButton >= Math.pow(LoginButtonCandidateSize,LoginButtonClickDepth)){
		if (!searchForSignUpForFB){
			log("Too many attempts to click login button and still haven't seen FB traffic, probably failed to locate login button.");
			log("Site doesn't support FB login?\n", true);
			automatedTesting.finishedTesting(true);			//we consider this as non-failure tests.
		}
		else {
		//really give up.
			log("Too many attempts to click signup button and still haven't seen FB traffic, probably failed to locate signup button.");
			log("Signup button search doesn't help, test still fails.", true);			//This means cannot find signup button.
			automatedTesting.finishedTesting(false);
		}
		return;
	}
	loginClickAttempts = 0;
	loginButtonClicked = false;
	loginButtonClickHistory = [];
	loginButtonPool = [];
	redirectDomain = "";
	deleteCookies();
	FBSDKDetermined = false;
	sawDialogOAuth = false;
	capturingPhase = 1;
	var tempStr = "\nAttempting to click ";
	for (i = 0; i < LoginButtonClickDepth; i++)
	{
		var temp = Math.floor(indexToClickLoginButton/(Math.pow(LoginButtonCandidateSize,LoginButtonClickDepth - 1 - i))) % LoginButtonCandidateSize + 1;
		//if (i == LoginButtonClickDepth - 1) temp = (indexToClickLoginButton % LoginButtonCandidateSize) + 1;			//last one is modular
		tempStr += (temp.toString() + "th ranked node for " + (i + 1).toString() + "th click, ");
	}
	log(tempStr);
	try {
		closeAllOtherTabs();
		window.clearTimeout(collectCandidatesAndClickNextTimer);
		testSuiteWorker.port.emit("action",{"action": "navigateTo", "site":siteToTest});
	} catch(ex){
		window.setTimeout(function(){testSuiteWorker.port.emit("action",{"action": "navigateTo", "site":siteToTest});},2000);
	}
}

function clickLoginButton(){
	var i;
	var j;
	var shouldClick = (capturingPhase == 2 || capturingPhase == 8);
	shouldClick = shouldClick || checkToken.shouldClickLoginButton() || checkSR.shouldClickLoginButton();
	if (!shouldClick) return;
	if (loginButtonPool.length == 0){
		//no workers have got back any responses from content scripts, just wait another couple seconds
		if (!!clickLoginButtonTimer) window.clearTimeout(clickLoginButtonTimer);
		clickLoginButtonTimer = window.setTimeout(clickLoginButton,2000);
		return;
	}
	if (loginButtonClickHistory.length > loginClickAttempts){
		//we have already learned how to perform clicks earlier, just follow the previous history.
		var clicked = false;
		//this is not the first click, we follow what's learned the first click, or if we can't find it, give up.
		for (i = 0; i < loginButtonPool.length; i++){
			for (j = 0; j < loginButtonPool[i].result.length; j++){
				if (loginButtonPool[i].result[j].XPath == loginButtonClickHistory[loginClickAttempts].XPath || loginButtonPool[i].result[j].outerHTML == loginButtonClickHistory[loginClickAttempts].outerHTML){
					//click this previously confirmed button to trigger FB login
					try {
						loginButtonPool[i].worker.port.emit("clickCandidate",{original_index: loginButtonPool[i].result[j].original_index});
						shouldRemoveOldLoginWorkers = true;
						clicked = true;				//this is just to tell outerloop to break.
						loginButtonClicked = true;	//this really informs ccc that login button has been clicked (at least once) in this login attempt.
						loginClickAttempts++;
						loginButtonPool = [];		//reset loginButtonPool after click.
						collectCandidatesAndClickNextTimer = window.setTimeout(collectCandidatesAndClickNext,10000);			//click again after 10 secs.	
						break;
					}
					catch (ex){console.log("hidden frame error clicking candidates after first click.");};
				}
			}
			if (clicked) break;
		}
		if (!clicked) {
			log("Login button used to work for previous login attempts, but failed for this attempt.");
			log("Login button used to work for previous login attempts, but failed for this attempt.",true);
			automatedTesting.finishedTesting(false);
		}
		return;
	}
	assume(capturingPhase <= 5, "assumption click login button failure");   		//below is executed only when searching for login button
	if (loginClickAttempts >= LoginButtonClickDepth) {
		//for USENIX experiments : even if we failed, record what's clicked.
		if (conf.USENIX.experiments.testLoginButton){
			var recordString = "Failed:";
			recordString = recordLoginStatus(recordString, false, false);
			log(recordString, true);			
		}
		if ((indexToClickLoginButton+1) % LoginButtonCandidateSize == 0) {
			fastForwardNextLoginButton(curAttemptClicksXPathInfo[loginClickAttempts - 1]);
		}
		else {
			fastForwardNextLoginButton();
		}
		return;
	}
	var indexToClickThisAttempt = Math.floor(indexToClickLoginButton/(Math.pow(LoginButtonCandidateSize,LoginButtonClickDepth - 1 - loginClickAttempts))) % LoginButtonCandidateSize;
	//sort LoginButtonPool and choose the indexToClickThisAttempt-th best candidate from all pool and issue this click command to that worker.
	var pointers = Array.apply(null, new Array(loginButtonPool.length)).map(Number.prototype.valueOf,0);
	var maxScore;
	var maxOriginal_Index;
	var maxStrategy;	
	var maxXPath;
	var maxOuterHTML;
	var maxWorker;
	var maxStats;
	var maxStringSig;
	var maxIframe;
	var maxVisible;
	var maxURL;
	var breakFlag;
	var pressedEarlier;
	var sortedCandidates = [];
	var sortedCandidates_All = [];
	while (true){
		//combine and sort the candidates.
		maxScore = -999;
		maxIndex = -1;
		breakFlag = 0;
		for (j = 0; j < loginButtonPool.length; j++)
		{
			if (pointers[j] >= loginButtonPool[j].result.length) {
				//this strategy already depleted and merged, go to the next strategy
				breakFlag++;
				continue;
			}
			//loginButtonPool results are already sorted, just do a merge here.
			//no duplicate guaranteed from pressLoginButton.  Different iframes ensures no duplicate across workers.
			if (maxScore < loginButtonPool[j].result[pointers[j]].score){
				maxIndex = j;
				maxScore = loginButtonPool[j].result[pointers[j]].score;
				maxOriginal_Index = loginButtonPool[j].result[pointers[j]].original_index;
				maxStrategy = loginButtonPool[j].result[pointers[j]].strategy;
				maxXPath = loginButtonPool[j].result[pointers[j]].XPath;
				maxOuterHTML = loginButtonPool[j].result[pointers[j]].outerHTML;
				maxStats = loginButtonPool[j].result[pointers[j]].stats;
				maxStringSig = loginButtonPool[j].result[pointers[j]].stringSig;
				maxIframe = loginButtonPool[j].result[pointers[j]].iframe;
				maxVisible = loginButtonPool[j].result[pointers[j]].visible;
				maxWorker = loginButtonPool[j].worker;
				maxURL = loginButtonPool[j].worker.urlReported;
			}
		}
		if (maxIndex != -1){
			//if this button was pressed earlier in this attempt, ignore this.
			pressedEarlier = false;
			for (i = 0; i < loginButtonClickHistory.length; i++)
			{
				if (loginButtonClickHistory[i].XPath == maxXPath && loginButtonClickHistory[i].outerHTML == maxOuterHTML) {
					pressedEarlier = true;
					break;
				}
			}
			assume(maxXPath != "USER_INFO_EXISTS!","user information exists even before we locate the login button, wth?");
			var temp = {
					score: maxScore,
					original_index: maxOriginal_Index,
					strategy: maxStrategy,
					XPath: maxXPath,
					outerHTML: maxOuterHTML,
					worker: maxWorker,
					url: maxURL,
					stringSig: maxStringSig,
					stats: maxStats,
					iframe: maxIframe,
					visible: maxVisible
				}
			if (!pressedEarlier) {
				sortedCandidates.push(temp);
			}
			sortedCandidates_All.push(temp);
			pointers[maxIndex]++;
		}
		if (breakFlag == loginButtonPool.length) break;
	}
	var sortedCandidatesWithPreviousClicksXPath = sortedCandidates_All.map(function(ele,index,arr){return ele.XPath;}).sort().join("\n");		//sort alphabetically, include previously clicked buttons.
	if (indexToClickThisAttempt >= sortedCandidates.length) {
		//requested rank exceeds the total number of candidate, we can fast forward.
		if (searchingForLoginButton){
			log("no (more) login button found on this subpage, fast forwarding.");
			if (loginClickAttempts >= 1) {
				if (conf.USENIX.experiments.testLoginButton){
					var recordString = "Failed:";
					recordString = recordLoginStatus(recordString, false, false);
					log(recordString, true);
				}
			}			//record previously clicked xpath info
			fastForwardNextLoginButton(sortedCandidatesWithPreviousClicksXPath);
		}
		return;
	}
	if (XPathHistory.indexOf(sortedCandidatesWithPreviousClicksXPath)!=-1){
		//We have previously seen this scenario, we can fast forward.
		log("We have seen this scenario, skipping this and fast forwarding.");
		if (searchingForLoginButton){
			log("We have seen this scenario after the last click, fast forwarding...");
			if (conf.USENIX.experiments.testLoginButton){
				var recordString = "Failed:";
				recordString = recordLoginStatus(recordString, false, true);
				log(recordString, true);			
			}
			fastForwardNextLoginButton();		//no need to record XPath scenario, as we've already seen this.
		}
		return;
	}
	if (loginClickAttempts >= 1){
		var same = true;
		//not first click, confirm previous click is not futile.
		for (i = 0; i < pressLoginButtonWorkers.length; i++){
			if (pressLoginButtonWorkers[i].candidatesWithPreviousCriteria != pressLoginButtonWorkers[i].previousCandidates){
				same = false;
				break;
			}
		}
		if (same){
			log("Previous click is futile, fast forwarding...");
			if (conf.USENIX.experiments.testLoginButton){
				var recordString = "Failed:";
				recordString = recordLoginStatus(recordString, true, false);
				log(recordString, true);			
			}
			if ((indexToClickLoginButton/Math.pow(LoginButtonCandidateSize,LoginButtonClickDepth - loginClickAttempts) + 1) % LoginButtonCandidateSize == 0 && loginClickAttempts > 1)
			{
				fastForwardNextLoginButton(sortedCandidatesWithPreviousClicksXPath);
			}
			else {
				fastForwardNextLoginButton();
			}
			return;
		}
	}
	try {
		log("clicking on "+(indexToClickThisAttempt+1).toString()+"th ranked login element in the pool (for the " + (loginClickAttempts+1).toString() + "th click:");
		log("XPATH: "+sortedCandidates[indexToClickThisAttempt].XPath);
		log("outerHTML: "+sortedCandidates[indexToClickThisAttempt].outerHTML.substr(0,50));
		sortedCandidates[indexToClickThisAttempt].worker.port.emit("test","");			//NOP. If worker doesn't exist, go to catch.
		for (i = 0; i < pressLoginButtonWorkers.length; i++){
			pressLoginButtonWorkers[i].previousCandidates = pressLoginButtonWorkers[i].candidatesWithCurrentCriteria;
		}
		if (loginClickAttempts >= 1) curAttemptClicksXPathInfo[loginClickAttempts] = sortedCandidatesWithPreviousClicksXPath;
		shouldRemoveOldLoginWorkers = true;
		sortedCandidates[indexToClickThisAttempt].worker.port.emit("clickCandidate",{
			original_index:sortedCandidates[indexToClickThisAttempt].original_index
		});
		loginButtonClickHistory[loginClickAttempts] = {
			XPath: sortedCandidates[indexToClickThisAttempt].XPath,
			outerHTML: sortedCandidates[indexToClickThisAttempt].outerHTML,
			stats: sortedCandidates[indexToClickThisAttempt].stats,
			stringSig: sortedCandidates[indexToClickThisAttempt].stringSig,
			iframe: sortedCandidates[indexToClickThisAttempt].iframe,
			visible: sortedCandidates[indexToClickThisAttempt].visible,
			score: sortedCandidates[indexToClickThisAttempt].score,
			url: sortedCandidates[indexToClickThisAttempt].url
		}
		loginClickAttempts++;
		loginButtonClicked = true;
		loginButtonPool = [];		//reset loginButtonPool after click.
		stallChecker(true);			//we made progress by clicking one element, tell stall Checker that.
	}
	catch(ex){
		log("pressLoginButtonWorker hidden frame error 1");
	}
	if (!!collectCandidatesAndClickNextTimer) window.clearTimeout(collectCandidatesAndClickNextTimer);
	collectCandidatesAndClickNextTimer = window.setTimeout(collectCandidatesAndClickNext,10000);			//check after 10 secs if a page nav has occured.
}

function testSuitePhase2(url){
	//Clicked on the facebook login button and https://www.facebook.com/dialog/oauth/ is visited.
	assume(capturingPhase == 2, "Phase 2 violation");
	log('Phase 2 - https://www.facebook.com/dialog/oauth/ request header and url captured for session A.\n');
	if (conf.USENIX.experiments.testLoginButton){
		var recordString = "Succeeded:";
		recordString = recordLoginStatus(recordString, false, false);
		log(recordString, true);
		log("This attempt succeeded, testing next...");
		if ((indexToClickLoginButton/Math.pow(LoginButtonCandidateSize,LoginButtonClickDepth - loginClickAttempts) + 1) % LoginButtonCandidateSize == 0 && loginClickAttempts > 1)
		{
			fastForwardNextLoginButton(curAttemptClicksXPathInfo[loginClickAttempts - 1]);
		}
		else {
			fastForwardNextLoginButton();
		}
		return;
	}
	storageRecord[siteToTest].facebookDialogOAuthRequest = bufferedRequests[url];
	capturingPhase++;
	loginClickAttempts = 0;					//do not reset indexToClick or related variable to save for next time.
}

function testSuitePhase3(url){
	//After visit to https://www.facebook.com/dialog/oauth/, this function is called when subsequent visit to https://www.facebook.com/dialog/oauth/read or write or permissions.request happens.
	assume(capturingPhase == 3, "Phase 3 violation");
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
			tryToRegisterTimer = window.setTimeout(collectCandidatesAndRegisterNext, 15000);				//if the site needs register, after 15 seconds, try register the user.
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
			tryToRegisterTimer = window.setTimeout(collectCandidatesAndRegisterNext, 15000);				//if the site needs register, after 15 seconds, try register the user.
		}
	}
}

function testSuitePhase4(url){
	//Getting authenticated session headers data.
	assume(capturingPhase == 4, "Phase 4 violation");
	credentialsInserted = false;			//consume it.
	log('Phase 4 - Saw traffic to test site again.\n');
	supportFBLogin = true;				//this is set to true and is only changed back to false when a new test starts.
	additionalRedirectInfo = "";		//reset this for phase 9->10 302 detection
	storageRecord[siteToTest].authenticatedSessionRequest = bufferedRequests[url];					//Here the request/respond might not be correct, as the site might need registration;  However, testSuitePhase4 will be called multiple times and in the end we should eventually get the correct response and request.
	storageRecord[siteToTest].authenticatedSessionResponse = bufferedResponses[url];
	if (oldCapturingURLs.length != 0) capturingURLs = oldCapturingURLs;
	capturingPhase++;
}

function collectCandidatesAndRegisterNext(){
	submitButtonPool = [];
	//last click didn't nav any pages (may have caused JS to manipulate the page), need to recompute candidates.
	for (i = 0; i < registrationWorkers.length; i++){
		try {
			registrationWorkers[i].port.emit("reportSubmitButtonCandidates",{"account":accountsInfo, "debug":debug});
		}
		catch (ex){
			registrationWorkers.splice(i,1);			//this worker is not active, just remove it.
			i--;
		}
	}
	window.setTimeout(tryToRegister, 2000);
	return;
}

function failedToRegister(){
	if (searchForSignUpForFB){
		log("No (more) submit button found, give up.");
		log("No (more) submit button found, give up.\n", true);			//This means cannot find signup button.
		automatedTesting.finishedTesting(false);
	}
	else {
		assume(capturingPhase <= 4, "error: failedToRegister assumption violation.");
		testedSearchForSignUp = true;
		searchForSignUpForFB = true;
		loginClickAttempts = 0;
		registerAttempts = 0;
		loginButtonClicked = false;
		loginButtonClickHistory = [];
		loginButtonPool = [];
		submitButtonPool = [];
		submitButtonClickHistory = [];
		redirectDomain = "";
		deleteCookies();
		FBSDKDetermined = false;
		sawDialogOAuth = false;
		capturingPhase = 1;
		indexToClickLoginButton = 0;
		searchingForLoginButton = true;
		registrationNeeded = conf.registrationNeeded || false;
		stallChecker(true);
		closeAllOtherTabs();
		log("trying to switch to detecting signup button mode...");
		log("Cannot register this site when searching for login button, switching to detect sign up button.",true);
		try {testSuiteWorker.port.emit("action",{"action": "navigateTo", "site":siteToTest});} catch(ex){log("testSuiteWorker hidden frame error 1");}
	}
}

function tryToRegister(){
	if (capturingPhase != 4 && capturingPhase != 10) return;			//HTTPS-iframe worker may have already registered, don't do anything here.
	if (submitButtonClickHistory.length > registerAttempts){
		var clicked = false;
		//this is not the first click, we follow what's learned the first click, or if we can't find it, give up.
		for (i = 0; i < submitButtonPool.length; i++){
			for (j = 0; j < submitButtonPool[i].result.length; j++){
				if (submitButtonPool[i].result[j].XPath == submitButtonClickHistory[registerAttempts].XPath || submitButtonPool[i].result[j].outerHTML == submitButtonClickHistory[registerAttempts].outerHTML){
					//click this previously confirmed button to trigger FB login
					try {
						submitButtonPool[i].worker.port.emit("clickSubmitButton",{original_index: submitButtonPool[i].result[j].original_index});
						shouldRemoveOldRegisterWorkers = true;
						clicked = true;				//this is just to tell outerloop to break.
						registerAttempts++;
						submitButtonPool = [];		//reset submitButtonPool after click.
						window.setTimeout(testRegisterSuccess,10000);			//click again after 10 secs.	
						break;
					}
					catch (ex){console.log("hidden frame error clicking candidates after first submit.");};
				}
			}
			if (clicked) break;
		}
		if (!clicked) {
			log("Submit button used to work for previous registration attempts, but failed for this attempt.");
			log("Submit button used to work for previous registration attempts, but failed for this attempt.",true);
			automatedTesting.finishedTesting(false);
		}
		return;
	}
	assume(capturingPhase <= 5, "assumption click submit button failure");
	if (registerAttempts >= SubmitButtonClickDepth) {
		indexToClickSubmitButton++;
		if (indexToClickSubmitButton >= Math.pow(SubmitButtonCandidateSize,SubmitButtonClickDepth)){
			failedToRegister();
		}
		else {
			//haven't searched through all combinations, we need to try other possibilities.
			loginClickAttempts = 0;
			registerAttempts = 0;
			loginButtonClicked = false;
			loginButtonPool = [];
			submitButtonPool = [];
			submitButtonClickHistory = [];
			redirectDomain = "";
			deleteCookies();
			FBSDKDetermined = false;
			sawDialogOAuth = false;
			capturingPhase = 1;
			var tempStr = "\nAttempting to click ";
			for (i = 0; i < SubmitButtonClickDepth; i++)
			{
				var temp = Math.floor(indexToClickSubmitButton/(Math.pow(SubmitButtonCandidateSize,SubmitButtonClickDepth - 1 - i))) % SubmitButtonCandidateSize + 1;
				tempStr += (temp.toString() + "th ranked node for " + (i + 1).toString() + "th click, ");
			}
			log(tempStr);
			try {testSuiteWorker.port.emit("action",{"action": "navigateTo", "site":siteToTest});} catch(ex){log("testSuiteWorker hidden frame error 14");}
		}
		closeAllOtherTabs();
		return;
	}
	if (indexToClickSubmitButton >= Math.pow(SubmitButtonCandidateSize, SubmitButtonClickDepth)) {
			failedToRegister();
		return;
	}
	var indexToClickThisAttempt = Math.floor(indexToClickSubmitButton/(Math.pow(SubmitButtonCandidateSize, SubmitButtonClickDepth - 1 - registerAttempts))) % SubmitButtonCandidateSize;
	//sort submitButtonPool and choose the indexToClickThisAttempt-th best candidate from all pool and issue this click command to that worker.
	var pointers = Array.apply(null, new Array(submitButtonPool.length)).map(Number.prototype.valueOf,0);
	var maxScore;
	var maxOriginal_Index;
	var maxStrategy;	
	var maxXPath;
	var maxOuterHTML;
	var maxWorker;
	var breakFlag;
	var pressedEarlier;
	var sortedCandidates = [];
	while (true){
		maxScore = -999;
		maxIndex = -1;
		breakFlag = 0;
		for (j = 0; j < submitButtonPool.length; j++)
		{
			if (pointers[j] >= submitButtonPool[j].result.length) {
				//this strategy already depleted and merged, go to the next strategy
				breakFlag++;
				continue;
			}
			//submitButtonPool results are already sorted, just do a merge here.
			//no duplicate guaranteed from pressLoginButton.  Different iframes ensures no duplicate across workers.
			if (maxScore < submitButtonPool[j].result[pointers[j]].score){
				maxIndex = j;
				maxScore = submitButtonPool[j].result[pointers[j]].score;
				maxOriginal_Index = submitButtonPool[j].result[pointers[j]].original_index;
				maxStrategy = submitButtonPool[j].result[pointers[j]].strategy;
				maxXPath = submitButtonPool[j].result[pointers[j]].XPath;
				maxOuterHTML = submitButtonPool[j].result[pointers[j]].outerHTML;
				maxWorker = submitButtonPool[j].worker;
			}
		}
		if (maxIndex != -1){
			//if this button was pressed earlier in this attempt, ignore this.
			pressedEarlier = false;
			for (i = 0; i < submitButtonClickHistory.length; i++)
			{
				if (submitButtonClickHistory[i].XPath == maxXPath && submitButtonClickHistory[i].outerHTML == maxOuterHTML) {
					pressedEarlier = true;
					break;
				}
			}
			if (!pressedEarlier) {
				sortedCandidates.push({
					score:maxScore,
					original_index:maxOriginal_Index,
					strategy:maxStrategy,
					XPath: maxXPath,
					outerHTML: maxOuterHTML,
					worker:maxWorker
				});
			}
			pointers[maxIndex]++;
		}
		if (breakFlag == submitButtonPool.length) break;
	}
	if (indexToClickThisAttempt >= sortedCandidates.length) {
		console.log("no (more) submit button found on this subpage, fast forwarding.");
		if (registerAttempts == 0) {
			//fast forwarded failure. (indexToClickSubmitButton exceeds maximum threshold)
			failedToRegister();
			return;
		}
		indexToClickSubmitButton += Math.pow(SubmitButtonCandidateSize,SubmitButtonClickDepth - registerAttempts);		//advance upper level selection by one
		indexToClickSubmitButton -= (indexToClickSubmitButton % Math.pow(SubmitButtonCandidateSize, SubmitButtonClickDepth - registerAttempts));		//the rest of selection should be cleared.
		loginClickAttempts = 0;
		registerAttempts = 0;
		loginButtonClicked = false;
		loginButtonPool = [];
		submitButtonPool = [];
		submitButtonClickHistory = [];
		redirectDomain = "";
		deleteCookies();
		FBSDKDetermined = false;
		sawDialogOAuth = false;
		capturingPhase = 1;
		var tempStr = "\nAttempting to click ";
		for (i = 0; i < SubmitButtonClickDepth; i++)
		{
			var temp = Math.floor(indexToClickSubmitButton/(Math.pow(SubmitButtonCandidateSize,SubmitButtonClickDepth - 1 - i))) % SubmitButtonCandidateSize + 1;
			tempStr += (temp.toString() + "th ranked node for " + (i + 1).toString() + "th click, ");
		}
		log(tempStr);
		try {testSuiteWorker.port.emit("action",{"action": "navigateTo", "site":siteToTest});} catch(ex){log("testSuiteWorker hidden frame error 15");}
		closeAllOtherTabs();
		return;
	}
	try {
		console.log("clicking on "+(indexToClickThisAttempt+1).toString()+"th ranked submit button in the pool:");
		console.log("XPATH: "+sortedCandidates[indexToClickThisAttempt].XPath);
		console.log("OuterHTML: "+sortedCandidates[indexToClickThisAttempt].outerHTML.substr(0,50));
		sortedCandidates[indexToClickThisAttempt].worker.port.emit("clickSubmitButton",{
			original_index:sortedCandidates[indexToClickThisAttempt].original_index
		});
		shouldRemoveOldRegisterWorkers = true;
		submitButtonClickHistory[registerAttempts] = {
			XPath: sortedCandidates[indexToClickThisAttempt].XPath,
			outerHTML: sortedCandidates[indexToClickThisAttempt].outerHTML
		}
		registerAttempts++;
		submitButtonPool = [];		//reset submitButtonPool after click.
		stallChecker(true);			//we made progress by clicking one element, tell stall Checker that.
	}
	catch(ex){
		log("pressSubmitButtonWorker hidden frame error 1, ex:" + ex.toString());
	}
	window.setTimeout(testRegisterSuccess,10000);			//check after 10 secs if a page nav has occured.
}

function testRegisterSuccess(){
	pressLoginButtonWorkers = [];			//delete existing pressLoginWorkers so that only newly created background tab is checked for user information
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
	if (pressLoginButtonWorkers.length == 0){
		log("Probably site still loading, wait for 10 secs and recall this function");
		window.clearTimeout(checkLoginButtonRemovedTimer);
		checkLoginButtonRemovedTimer = window.setTimeout(checkLoginButtonRemoved, 10000);	
	}
	var i = 0;
	for (i = 0; i < pressLoginButtonWorkers.length; i++)
	{
		try {
			pressLoginButtonWorkers[i].port.emit("reportCandidates",{"account":accountsInfo, "searchForSignUpForFB":searchForSignUpForFB, "loginClickAttempts":0});
		} catch(ex){	
			pressLoginButtonWorkers.splice(i,1);
			i--;
		}
	}
}

function checkLoginButtonExistenceAndReportToVulChecker(worker){
	//actually compare history with what candidates are reported now, to see if login button has been removed.
	var i;
	var j;
	var user_info_exists = false;
	var login_button_exists = false;
	for (i = 0; i < loginButtonPool.length; i++){
		for (j = 0; j < loginButtonPool[i].result.length; j++){
			if (loginButtonPool[i].result[j].XPath == "USER_INFO_EXISTS!"){
				//look for whether user_info_exists first.
				user_info_exists = true;
				break;
			};
			if (loginButtonPool[i].result[j].XPath == loginButtonClickHistory[0].XPath || loginButtonPool[i].result[j].outerHTML == loginButtonClickHistory[0].outerHTML){
				//check if login button is still there.
				login_button_exists = true;
				//don't break here. user_info_exists has priority over this.
			}
		}
		if (user_info_exists) break;
	}
	if (checkToken.shouldReturnLoginButtonInfoToVulChecker() && loginButtonClicked){
		checkToken.checkLoginButtonRemoved(login_button_exists && !user_info_exists);
	}
	else if (checkSR.shouldReturnLoginButtonInfoToVulChecker() && loginButtonClicked){
		checkSR.checkLoginButtonRemoved(login_button_exists && !user_info_exists);
	}
}

function compareLoginButtonHistory(){
	//actually compare history with what candidates are reported now, to see if login button has been removed.
	var i;
	var j;
	var user_info_exists = false;
	var login_button_exists = false;
	for (i = 0; i < loginButtonPool.length; i++){
		for (j = 0; j < loginButtonPool[i].result.length; j++){
			if (loginButtonPool[i].result[j].XPath == "USER_INFO_EXISTS!"){
				//look for whether user_info_exists first.
				user_info_exists = true;
				break;
			};
			if (loginButtonPool[i].result[j].XPath == loginButtonClickHistory[0].XPath || loginButtonPool[i].result[j].outerHTML == loginButtonClickHistory[0].outerHTML){
				//check if login button is still there.
				login_button_exists = true;
				//don't break here. user_info_exists has priority over this.
			}
		}
		if (user_info_exists) break;
	}
	if (user_info_exists) {
		if (conf.USENIX.experiments.testRegistrationNeeded){
			//Only test if registration is needed.
			log("USENIX test: reg not needed.",true);
			log("USENIX test: reg not needed.");
			automatedTesting.finishedTesting(true);
			return;
		}
		//login successful.
		log("login successful! After logging in the user information is present!");
		if (!registrationNeeded) {
			assume(capturingPhase == 5 || capturingPhase == 11, "sendLoginButtonInformation violation");
			if (!!extractContentTimer) window.clearTimeout(extractContentTimer);
			extractContent();
		}
		else {
			assume(capturingPhase == 4 || capturingPhase == 10, "sendLoginButtonInformation violation");
			closeAllOtherTabs();
			delayRefreshTestTabTimer = window.setTimeout(delayRefreshTestTab,2000)					//Now we can refresh main tab.
		}
		return;
	}
	log("User information doesn't exist.  Recorded login button xpath: "+loginButtonClickHistory[0].XPath);
	if (login_button_exists){
		log("login failed! After logging in the login button is still present!");
		if ((capturingPhase == 4 || capturingPhase == 10) && registrationNeeded){
			log("Trying to click the next combination of submit buttons.");
			closeAllOtherTabs();
			tryToRegisterTimer = window.setTimeout(collectCandidatesAndRegisterNext, 15000);
			return;
		}
		if (testedSearchForSignUp && !searchForSignUpForFB){
			//already tried to search for signup and register and did successfully, but afterwards again we cannot login successfully.  Make sure we don't go into the endless loop of trying to search for signup button and register again. Just fail the test here.
			log("Cannot login to this site after registered successfully, this is a corner case.",true);
			log("Cannot login to this site after registered successfully, this is a corner case.");
			automatedTesting.finishedTesting(false);
			return;
		}
		if (!registrationNeeded) {
			if (conf.USENIX.experiments.testRegistrationNeeded){
				//Only test if registration is needed.
				log("USENIX test: reg needed.",true);
				log("USENIX test: reg needed.");
				automatedTesting.finishedTesting(true);
				return;
			}
			//Need to return to phase - 4 and set registration flag.
			loginClickAttempts = 0;
			loginButtonClicked = false;
			deleteCookies();
			sawDialogOAuth = false;
			pressLoginWorkers = [];
			loginButtonPool = [];
			capturingPhase = capturingPhase - 4;
			registrationNeeded = true;
			closeAllOtherTabs();
			log("Site needs registration, returning to phase " + capturingPhase.toString() + " and set the flag");
			try {testSuiteWorker.port.emit("action",{"action": "navigateTo", "site":siteToTest});} catch(ex){log("testSuiteWorker hidden frame error 7");}
			return;
		}
	}
	else {
		log("login successful, but oracle failed.");
		if (conf.USENIX.experiments.testRegistrationNeeded){
			//Only test if registration is needed.
			log("USENIX test: reg not needed.",true);
			log("USENIX test: reg not needed.");
			automatedTesting.finishedTesting(true);
			return;
		}
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
}

function revisitSiteAnonymously(){	
	assume(capturingPhase == 5, "revisitSiteAnonymously violation");
	log('Phase 5 - deleting cookies and revisit the test site for a second time.\n');
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
			tryToRegisterTimer = window.setTimeout(collectCandidatesAndRegisterNext, 15000);				//if the site needs register, after 10 seconds, try register the user.
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
			tryToRegisterTimer = window.setTimeout(collectCandidatesAndRegisterNext, 15000);				//if the site needs register, after 10 seconds, try register the user.
		}
	}
}

function extractContent(){
	try{testSuiteWorker.port.emit("action",{"action":"extractContent"});} catch(ex){
		log("testSuiteworker hidden frame error 4, retrying in 10 secs...");
		if (!!extractContentTimer) window.clearTimeout(extractContentTimer);
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
	else if (capturingPhase != 10) {
		return;
	}
	assume(capturingPhase == 10, "Phase 10 violation");
	credentialsInserted = false;			//consume it.
	log('Phase 10 - recorded account B header data.\n');
	additionalRedirectInfo = "";			//reset for future usage.
	if (!searchForSignUpForFB){
		storageRecord[siteToTest].authenticatedSessionRequest2 = bufferedRequests[url];
		storageRecord[siteToTest].authenticatedSessionResponse2 = bufferedResponses[url];
		if (oldCapturingURLs.length != 0) capturingURLs = oldCapturingURLs;
		capturingPhase++;
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
		if (!conf.USENIX.experiments.testLoginButton) searchingForLoginButton = false;			//in login button experiments, we never stop searching for login button.
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
		try {
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
		}
		catch (ex) {this.originalListener.onStopRequest(request, context, statusCode);}
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
				var isHostRelatedDomain = true;
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
							if (newRedirectURI.indexOf('/')!=-1) newRedirectURI = newRedirectURI.substr(0,newRedirectURI.indexOf('/'));
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
								//if the first char is a slash, add URL's domain in front of it.
								if (newSiteToDetect.indexOf('/')==0) {
									var temp = url.substr(url.indexOf('/')+2,url.length);
									if (temp.indexOf('/')!=-1){
										var protocol = url.substr(0,url.indexOf('/')) + "//";
										newSiteToDetect = protocol + temp.substr(0,temp.indexOf('/')) + newSiteToDetect;
									}
									else {
										newSiteToDetect = url + newSiteToDetect;
									}
								}
								else {
									newSiteToDetect = url + newSiteToDetect;
								}
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
						if (temp.indexOf('&')!=-1)
						{
							temp = decodeURIComponent(temp.substr(13,temp.indexOf('&')-13));
						}
						else
						{
							temp = decodeURIComponent(temp.substr(13,temp.length));
						}
						if (temp.indexOf("http://www.facebook.com/dialog/return")!=0 && temp.indexOf("https://www.facebook.com/dialog/return")!=0) {
							if (temp.indexOf('http://apps.facebook.com') == 0 || temp.indexOf('https://apps.facebook.com') == 0)
							{
								notAppsFacebookComDomain = false;
							}
							//also test if the redirect domain is in any of the capturing URLs' root domains, if it's not http://www.facebook.com/dialog/return.
							temp = getRootDomain(temp);
							var i = 0;
							var flag = !conf.mustBeHostRelatedDomain;
							for (i = 0; i < capturingURLs.length; i++){
								if (temp == getRootDomain(capturingURLs[i])) {
									flag = true;
									break;
								}
							}
							isHostRelatedDomain = flag;
						}
					}
				}
				if ((url.startsWith("https://www.facebook.com/dialog/oauth") || url.startsWith("http://www.facebook.com/dialog/oauth")) && !FBSDKDetermined && notAppsFacebookComDomain && isHostRelatedDomain){
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
								if (redirectDomain.indexOf('/')!=-1) redirectDomain = redirectDomain.substr(0,redirectDomain.indexOf('/'));
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
				if ((url.startsWith("https://www.facebook.com/dialog/oauth") || url.startsWith("http://www.facebook.com/dialog/oauth")) && notAppsFacebookComDomain && isHostRelatedDomain)
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
		if (data.indexOf('This app is in sandbox mode.  Edit the app configuration at')!=-1 || data.indexOf('This+app+is+in+sandbox+mode.++Edit+the+app+configuration+at')!=-1 || data.indexOf('Error validating application. Application has been deleted.')!=-1 || data.indexOf('<div class="mal pam uiBoxRed">The parameter ')!=-1)
		{
			log('Site support FB but its configuration is in an error state.\n',true);
			automatedTesting.finishedTesting(true);
			return;
		}				
		//to modify response, modify the variable 'data' above. The next statement is going to write data into outputStream and then pass it to the next listener (and eventually the renderer).
        binaryOutputStream.writeBytes(data, count);
		try {
			this.originalListener.onDataAvailable(request, context,
				storageStream.newInputStream(0), offset, count);
		}
		catch(ex){};
		
    },

    onStartRequest: function(request, context) {
		try {
			this.originalListener.onStartRequest(request, context);
		}
		catch(ex){};
    },

    onStopRequest: function(request, context, statusCode)
    {
		try {
			this.originalListener.onStopRequest(request, context, statusCode);
		}
		catch(ex){};
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
	if (shouldRemoveOldLoginWorkers) {
		shouldRemoveOldLoginWorkers = false;
		pressLoginButtonWorkers = [];
	}
	pressLoginButtonWorker = worker;
	pressLoginButtonWorkers.push(pressLoginButtonWorker);
	//listen to events
	pressLoginButtonWorker.port.on("reportCandidates", function(response){
		pressLoginButtonWorker.candidatesWithPreviousCriteria = response.candidatesWithPreviousCriteria;		//for futile click detection
		pressLoginButtonWorker.candidatesWithCurrentCriteria = response.candidatesWithCurrentCriteria;			//for futile click detection
		pressLoginButtonWorker.urlReported = response.url;			//for futile click detection
		loginButtonPool.push({worker:pressLoginButtonWorker, result:response.result});
		if (capturingPhase == 2 || capturingPhase == 8 || checkToken.shouldClickLoginButton() || checkSR.shouldClickLoginButton()) {
			if (!!clickLoginButtonTimer) window.clearTimeout(clickLoginButtonTimer);
			clickLoginButtonTimer = window.setTimeout(clickLoginButton,2000);			//wait for iframes to finish.
		}
		if (((capturingPhase == 5 || capturingPhase == 11) && !registrationNeeded) || ((capturingPhase == 4 || capturingPhase == 10) && registrationNeeded)){
			//got response from workers about login button candidates.  Push them into the pool and wait for 2 secs (for iframes) to finish and call comparison function
			window.setTimeout(compareLoginButtonHistory,2000);
		}
		if (checkToken.shouldReturnLoginButtonInfoToVulChecker() || checkSR.shouldReturnLoginButtonInfoToVulChecker() && (!checkToken.shouldClickLoginButton()) && (!checkSR.shouldClickLoginButton())) {
			window.setTimeout(checkLoginButtonExistenceAndReportToVulChecker,2000);
		}
	});
	
	if (capturingPhase == 2 || capturingPhase == 8 || checkToken.shouldClickLoginButton() || checkSR.shouldClickLoginButton()) {
		if (!!collectCandidatesAndClickNextTimer) window.clearTimeout(collectCandidatesAndClickNextTimer);			//this happens when a new page loads. When this happens, we want to clear the old timer, and try to click the login button in this new page.
		collectCandidatesAndClickNextTimer = window.setTimeout(collectCandidatesAndClickNext, 5000);
	}
	if (capturingPhase == 5 || capturingPhase == 11){
		if (!registrationNeeded) {
			if (!!checkLoginButtonRemovedTimer) window.clearTimeout(checkLoginButtonRemovedTimer);
			checkLoginButtonRemovedTimer = window.setTimeout(checkLoginButtonRemoved, 5000);			//5000 for iframe loading
		}
		else {
			if (!!extractContentTimer) window.clearTimeout(extractContentTimer);
			extractContentTimer = window.setTimeout(extractContent,5000);
		}
	}
	if (checkToken.shouldReturnLoginButtonInfoToVulChecker() || checkSR.shouldReturnLoginButtonInfoToVulChecker() && (!checkToken.shouldClickLoginButton()) && (!checkSR.shouldClickLoginButton())){
		if (!!checkLoginButtonRemovedTimer) window.clearTimeout(checkLoginButtonRemovedTimer);
		checkLoginButtonRemovedTimer = window.setTimeout(checkLoginButtonRemoved,5000);
	}
};

exports.initIFramePressLoginButtonWorker = function(worker) {
	var thisIframeWorker = worker;
	pressLoginButtonWorkers.push(thisIframeWorker);
	worker.port.on("reportCandidates", function(response){
		thisIframeWorker.candidatesWithPreviousCriteria = response.candidatesWithPreviousCriteria;
		thisIframeWorker.candidatesWithCurrentCriteria = response.candidatesWithCurrentCriteria;
		thisIframeWorker.urlReported = response.url;
		//main worker reported, we should attempt to click one after a certain time (waiting for iframes to report as well, but we have a 2 seconds upper limit).
		//no need to distinguish capturing phase 2, 8, 5 and 11.
		loginButtonPool.push({worker:thisIframeWorker, result:response.result});
	});
	worker.port.on("writeToFileRequest",writeToFileRequest);
}

exports.initAutomateSSOWorker = function(worker){
	if (worker.tab.i == undefined)
	{
		worker.tab.i = tabs.length;
		if (worker.tab.i != 1) {
			//log("Tab " + worker.tab.i.toString()+" created.");
		}
		else if (!calledCheckAndRedoCredentials) {
			//only executes at the beginning of the tests, once.
			calledCheckAndRedoCredentials = true; window.setTimeout(check_and_redo_credentials,1000);
		}
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
	if (shouldRemoveOldRegisterWorkers) {
		shouldRemoveOldRegisterWorkers = false;
		registrationWorkers = [];
	}
	if (capturingPhase != 4 && capturingPhase != 10) return;		//don't bother if it is not time to register.
	registrationWorkers.push(worker);
	worker.port.on("writeToFileRequest",writeToFileRequest);
	worker.port.on("reportSubmitButtonCandidates", function(response){
		submitButtonPool.push({"worker":worker, "result":response});
	});
	if (typeof accountsInfo != "undefined"){
		try {worker.port.emit("init",{"accountsInfo":accountsInfo[FBAccount-1], "debug":debug});} catch (ex) {}
	}
}

exports.initIFrameRegistrationWorker = function(worker) {
	if (capturingPhase != 4 && capturingPhase != 10) return;		//don't bother if it is not time to register.
	registrationWorkers.push(worker);
	worker.port.on("writeToFileRequest",writeToFileRequest);
	worker.port.on("reportSubmitButtonCandidates", function(response){
		submitButtonPool.push({"worker":worker, "result":response});
	});
	if (typeof accountsInfo != "undefined"){
		try {worker.port.emit("init",{"accountsInfo":accountsInfo[FBAccount-1], "debug":debug});} catch (ex) {}
	}
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
exports.log = log;
exports.debug = function(){return debug;};
exports.siteToTest = function(){return siteToTest;};
exports.storageRecord = function(){return storageRecord;};
exports.accountsInfo = function(){return accountsInfo;};
exports.responseTextContent = function(){return responseTextContent;};
exports.testSuiteWorker = function(){return testSuiteWorker;};
exports.automateSSOWorker = function(){return automateSSOWorker;};
exports.pressLoginButtonWorker = function(){return pressLoginButtonWorker;};
exports.capturingPhase = function(){return capturingPhase;};
exports.capturingURLs = function(){return capturingURLs;};
exports.loginButtonXPath = function(){return loginButtonXPath;};
exports.loginButtonOuterHTML = function(){return loginButtonOuterHTML;};
exports.indexToClickLoginButton = function(){return indexToClickLoginButton;};
exports.credentialsInserted = function(){return credentialsInserted;};
exports.testOverallSuccess = function(){return testOverallSuccess;};
exports.credentialsForPersistentThreats = function(){return credentialsForPersistentThreats;};
exports.detectionMode = function(){return detectionMode};
exports.usedFBSDK = function(){return usedFBSDK;};
exports.redirectDomain = function(){return redirectDomain;};
exports.loginButtonClicked = function(){return loginButtonClicked;};
exports.setCapturingPhase = function(p){capturingPhase = p; return;};
exports.setFBAccount = function(p){FBAccount = p; return;};
exports.setRedirectDomain = function(p){redirectDomain = p; return;};
exports.setTestOverallSuccess = function(p){testOverallSuccess = p; return;};
exports.pushCapturingURLs = function(p){capturingURLs.push(p); return;};
exports.setClickLoginButtonTimer = function(t){
	if (!!collectCandidatesAndClickNextTimer) window.clearTimeout(collectCandidatesAndClickNextTimer);			//must clear this timer, otherwise phase 16 (checkSR) might have problem (executing search twice, the second time will ignore the first element).
	if (!!checkLoginButtonRemovedTimer) window.clearTimeout(checkLoginButtonRemovedTimer);
	collectCandidatesAndClickNextTimer = window.setTimeout(collectCandidatesAndClickNext, t);
};
exports.restoreCapturingURLs = function(){if (oldCapturingURLs.length!=0) capturingURLs = oldCapturingURLs; return;};
exports.startTest = startTest;
exports.automatedTestingFlag = automatedTestingFlag;
exports.startOver = startOver;
exports.inBetweenModule = inBetweenModule;
exports.resetTab = resetTab;
exports.collectCandidatesAndClickNext = collectCandidatesAndClickNext;

startOver();
initOutputDir();
PT.init();
if (!file.exists(file.join(profilePath, "testResults"))) file.mkpath(file.join(profilePath, "testResults"));
initTab();