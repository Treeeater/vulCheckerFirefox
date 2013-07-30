var testList = require("./debugTestList");
var ccc = require("./ccc");
var file = require("file");
var profilePath = require("system").pathFor("ProfD");

const {Cc,Ci} = require("chrome");
var window = Cc["@mozilla.org/appshell/appShellService;1"].getService(Ci.nsIAppShellService).hiddenDOMWindow;

var i = 0;
var firstTimeStart = true;
var testSucceed = false;
var timedOut = true;
//var timer;
var started = false;
var allTestDone = false;
var stalledSites = [];
var file = require("file");
var readyToProceedAfterTabReset = function (){
	ccc.startTest(testList.testList[i]);
	i++;
	//timer = window.setTimeout(testNext, 600000);
}

var testNext = function(){
	if (!testSucceed && !firstTimeStart) {
		if (timedOut) {
			if (stalledSites.indexOf(testList.testList[i-1])==-1) {
				stalledSites.push(testList.testList[i-1]);
				ccc.log("Test failed due to timeout on " + testList.testList[i-1], true);
				ccc.log("Retrying (2nd time)...", true);
				i--;
			}
			else {
				ccc.log("Test failed a second time due to timeout, skipping this...",true);
			}
		}
		else {
			ccc.log("Test failed on " + testList.testList[i-1], true);
		}
	}
	if (!firstTimeStart) ccc.log("",true);			//seperator ('\n' automatically added in ccc.log().
	if (i >= testList.testList.length) {
		ccc.log("All Test done!",true);
		ccc.saveToFile("finished","");
		console.log("All Test done!");
		allTestDone = true;
		return;
	}
	//ignore previously tested sites.
	var filePath = file.join(profilePath, "testResults", ccc.fileNameSanitize(testList.testList[i]));
	while (file.exists(filePath)){
		i++;
		if (i >= testList.testList.length){
			ccc.log("All Test done!",true);
			ccc.saveToFile("finished","");
			console.log("All Test done!");
			allTestDone = true;
			return;
		}
		filePath = file.join(profilePath, "testResults", ccc.fileNameSanitize(testList.testList[i]));
	}
	testSucceed = false;
	timedOut = true;
	firstTimeStart = false;
	ccc.resetTab();
	window.setTimeout(readyToProceedAfterTabReset,1000);
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

exports.allTestDone = function(){return allTestDone};