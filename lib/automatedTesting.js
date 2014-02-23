var PT = require("./persistentThreats.js");
var ccc = require("./ccc");
var file = require("sdk/io/file");
var CONST = require("./const");
var profilePath = require("sdk/system").pathFor("ProfD");
const {Cc,Ci} = require("chrome");
var window = Cc["@mozilla.org/appshell/appShellService;1"].getService(Ci.nsIAppShellService).hiddenDOMWindow;

var firstTimeStart = true;
var testSucceed = false;
var timedOut = true;
//var timer;
var started = false;
var allTestDone = false;
var retry = false;
var stalledSites = [];

//reset profilePath
var profilePath = require("sdk/system").pathFor("ProfD");

i = 0;
var readyToProceedAfterTabReset = function (){
	ccc.startTest(ccc.testList()[i]);
	i++;
	//timer = window.setTimeout(testNext, 600000);
}

var testNext = function(){
	if (!testSucceed && !firstTimeStart) {
		if (timedOut) {
			if (stalledSites.indexOf(ccc.testList()[i-1])==-1) {
				stalledSites.push(ccc.testList()[i-1]);
				ccc.log("Test timed out, retrying (2nd time)...", true);
				i--;
				retry = true;
			}
			else {
				ccc.log("Test failed a second time due to timeout, skipping this...\n",true);
			}
		}
		else {
			ccc.log("Test failed on " + ccc.testList()[i-1], true);
		}
	}
	if (!firstTimeStart && ccc.supportFBLogin() && !retry) {
		//handle persistent threat, check if they are vul, if not, report they are safe.
		if ((!PT.vulStatus().code_vul) && ((ccc.detectionMode() & CONST.dm.code_vul) != 0)) {
			ccc.log(ccc.testList()[i-1] + " is not vulnerable to [2].");
			ccc.log(ccc.testList()[i-1] + " is not vulnerable to [2].", true);
		}
		if ((!PT.vulStatus().referrer_vul) && ((ccc.detectionMode() & CONST.dm.referrer_vul) != 0)) {
			ccc.log(ccc.testList()[i-1] + " is not vulnerable to [4].");
			ccc.log(ccc.testList()[i-1] + " is not vulnerable to [4].", true);
		}
		if ((!PT.vulStatus().secret_in_body_vul) && ((ccc.detectionMode() & CONST.dm.secret_in_body_vul) != 0)) {
			ccc.log(ccc.testList()[i-1] + " is not vulnerable to [5].");
			ccc.log(ccc.testList()[i-1] + " is not vulnerable to [5].", true);
		}
		ccc.log("",true);			//seperator ('\n' automatically added in ccc.log().
	}
	PT.newTest();					//reset vul flags.
	if (i >= ccc.testList().length) {
		ccc.log("All Test done!",true);
		ccc.saveToFile("finished","");
		ccc.startOver();
		console.log("All Test done!");
		allTestDone = true;
		return;
	}
	//ignore previously tested sites.
	if (!retry) {
		var filePath = file.join(profilePath, "testResults", ccc.fileNameSanitize(ccc.testList()[i]));
		while (file.exists(filePath)){
			i++;
			if (i >= ccc.testList().length){
				ccc.log("All Test done!",true);
				ccc.saveToFile("finished","");
				ccc.startOver();
				ccc.log("All Test done!");
				allTestDone = true;
				return;
			}
			filePath = file.join(profilePath, "testResults", ccc.fileNameSanitize(ccc.testList()[i]));
		}
	}
	testSucceed = false;
	timedOut = true;
	firstTimeStart = false;
	retry = false;
	ccc.resetTab();
	window.setTimeout(readyToProceedAfterTabReset,2000);
}

exports.finishedTesting = function (succeed){
	//expedite the process if they tell me to continue
	if (arguments.length == 0) {timedOut = true; testSucceed = false;}
	else {
		testSucceed = succeed;
		timedOut = false;
	}
	//window.clearTimeout(timer);
	testNext();
}

exports.startTestIfHaventStarted = function(){
	if (ccc.automatedTestingFlag && !started) {
		started = true;
		window.setTimeout(testNext, 1000);
	}
}

exports.allTestDone = function(){return allTestDone;};