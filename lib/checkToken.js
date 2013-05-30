var ccc = require("./ccc");

var checkToken = function(storageRecord)
{
	if (!storageRecord.facebookDialogOAuthResponse) return false;
	var res = storageRecord.facebookDialogOAuthResponse.body;
	if (typeof res == "undefined") res = storageRecord.facebookDialogOAuthResponse.url;		//means the app didn't use the SDK, which means the acutal redirect url is in the 302 url, as opposed to javascript content.
	if (typeof res == "undefined") return false;
	console.log(res);
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

exports.processLoaded = function(url)
{
	var capturingPhase = ccc.capturingPhase();
	var siteToTest = ccc.siteToTest();
	if (capturingPhase == 11 && url == siteToTest){
		//This is executed first (entry point) of this file. Init should happen here.
		console.log("Phase 11: Done loading authenticated session B, ready to evaluate for access_token vulnerability");
		var storageRecord = ccc.storageRecord();
		var tokenVul = checkToken(storageRecord[siteToTest]);
		if (tokenVul)
		{
			verifyThreat(ccc.testSuiteWorker());
		}
		return capturingPhase + 1;
	}
	if (capturingPhase == 12 && url == siteToTest){
		console.log("Phase 12: cleared cookies, revisited the site. Now ready to send exploit request.");
		return capturingPhase + 1;
	}
	else return capturingPhase;
}