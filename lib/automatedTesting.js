var testList = require("./debugTestList");
var ccc = require("./ccc");

const {Cc,Ci} = require("chrome");
var window = Cc["@mozilla.org/appshell/appShellService;1"].getService(Ci.nsIAppShellService).hiddenDOMWindow;

var i = 0;
var testSucceed = false;
var timedOut = true;
var timer;
var started = false;

var readyToProceedAfterTabReset = function (){
	ccc.startTest(testList.testList[i]);
	i++;
	timer = window.setTimeout(testNext, 600000);
}

var testNext = function(){
	if (!testSucceed && i != 0) {
		ccc.log("Test failed " + (timedOut?"due to timeout ":"")+ "on " + testList.testList[i-1], true);
	}
	if (i!=0) ccc.log("",true);			//seperator ('\n' automatically added in ccc.log().
	if (i >= testList.testList.length) {
		ccc.log("All Test done!",true);
		return;
	}
	testSucceed = false;
	timedOut = true;
	ccc.resetTab();
	window.setTimeout(readyToProceedAfterTabReset,1000);
}

exports.finishedTesting = function (succeed){
	//expedite the process if they tell me to continue
	testSucceed = succeed;
	timedOut = false;
	window.clearTimeout(timer);
	testNext();
}

exports.startTestIfHaventStarted = function(){
	if (ccc.automatedTestingFlag && !started) {
		started = true;
		window.setTimeout(testNext, 1000);
	}
}