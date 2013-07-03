var testList = require("./debugTestList");
var ccc = require("./ccc");

const {Cc,Ci} = require("chrome");
var window = Cc["@mozilla.org/appshell/appShellService;1"].getService(Ci.nsIAppShellService).hiddenDOMWindow;
var setTimeout = window.setTimeout;
var clearTimeout = window.clearTimeout;

var i = 0;
var testSucceed = false;
var timedOut = true;
var timer;

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
	ccc.startTest(testList.testList[i]);
	i++;
	timer = setTimeout(testNext, 300000);
}

exports.finishedTesting = function (succeed){
	//expedite the process if they tell me to continue
	testSucceed = succeed;
	timedOut = false;
	clearTimeout(timer);
	testNext();
}

exports.startTest = function(){
	if (ccc.automatedTestingFlag) setTimeout(testNext, 1000);
}