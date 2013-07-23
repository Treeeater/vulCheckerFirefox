var testList = require("./debugTestList");
var ccc = require("./ccc");

const {Cc,Ci} = require("chrome");
var window = Cc["@mozilla.org/appshell/appShellService;1"].getService(Ci.nsIAppShellService).hiddenDOMWindow;

var i = 0;
var testSucceed = false;
var timedOut = true;
//var timer;
var started = false;
var allTestDone = false;
var stalledSites = [];

var readyToProceedAfterTabReset = function (){
	ccc.startTest(testList.testList[i]);
	i++;
	//timer = window.setTimeout(testNext, 600000);
}

var testNext = function(){
	if (!testSucceed && i != 0) {
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
			ccc.log("Test failed on" + testList.testList[i-1], true);
		}
	}
	if (i!=0) ccc.log("",true);			//seperator ('\n' automatically added in ccc.log().
	if (i >= testList.testList.length) {
		ccc.log("All Test done!",true);
		console.log("All Test done!");
		allTestDone = true;
		return;
	}
	testSucceed = false;
	timedOut = true;
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