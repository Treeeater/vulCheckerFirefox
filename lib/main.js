// This is an active module of the test Add-on
// To use this tool effectively, turn off cache on Firefox by going to about:config and set network.http.use-cache to false.
// Otherwise the traffic recorder will get incomplete data.

exports.main = function() {

    var data = require("sdk/self").data;
    var pageMod = require("sdk/page-mod");
	var ccc = require("./ccc");
    var pressLoginButtonWorker;
	var automateSSOWorker;
	var testSuiteWorker;
	var registrationWorker;
	
    pageMod.PageMod({
		include: "*",
		contentScriptFile: data.url("pressLoginButton.js"),
		contentScriptWhen: 'end',
		onAttach: function(worker) {
			if (ccc.old_token() == "") return;
			pressLoginButtonWorker = worker;
			ccc.initPressLoginButton(pressLoginButtonWorker);
		},
		attachTo: ["top"]
    });
	
	pageMod.PageMod({
		include: "https://*",
		contentScriptFile: [data.url("pressLoginButtonIFrame.js")],
		contentScriptWhen: 'end',
		onAttach: function(worker) {
			if (ccc.old_token() == "") return;
			ccc.initIFramePressLoginButtonWorker(worker);
		},
		attachTo: ["frame"]
    });
	
	pageMod.PageMod({
		include: "*",
		contentScriptFile: [data.url("accounts.js"), data.url("automateSSO.js")],
		contentScriptWhen: 'start',
		onAttach: function(worker) {
			automateSSOWorker = worker;
			ccc.initAutomateSSOWorker(automateSSOWorker);
		},
		attachTo: ["top"]
    });
	
	pageMod.PageMod({
		include: "*",
		contentScriptFile: [data.url("testSuite.js")],
		contentScriptWhen: 'end',
		onAttach: function(worker) {
			if (ccc.old_token() == "") return;
			testSuiteWorker = worker;
			ccc.initTestSuiteWorker(testSuiteWorker);
		},
		attachTo: ["top"]
    });
	
	pageMod.PageMod({
		include: "*",
		contentScriptFile: [data.url("jquery-2.0.2.min.js"), data.url("finishRegistration.js")],
		contentScriptWhen: 'end',
		onAttach: function(worker) {
			if (ccc.old_token() == "") return;
			registrationWorker = worker;
			ccc.initRegistrationWorker(registrationWorker);
		},
		attachTo: ["top"]
    });
	
	pageMod.PageMod({
		include: "https://*",
		contentScriptFile: [data.url("jquery-2.0.2.min.js"), data.url("finishRegistrationIFrame.js")],
		contentScriptWhen: 'end',
		onAttach: function(worker) {
			if (ccc.old_token() == "") return;
			ccc.initIFrameRegistrationWorker(worker);
		},
		attachTo: ["frame"]
    });
	
    var popup = require("sdk/panel").Panel({
      width: 100,
      height: 200,
      contentURL: data.url("popup.html"),
      contentScriptFile: data.url("popup.js"),
	  contentScriptWhen: "end"
    });
     
    // Create a widget, and attach the panel to it, so the panel is
    // shown when the user clicks the widget.
    require("sdk/widget").Widget({
      label: "Popup",
      id: "popup",
      contentURL: data.url("icon/icon.png"),
      panel: popup
    });
     
    // When the panel is displayed it generated an event called
    // "show": we will listen for that event and when it happens,
    // send our own "show" event to the panel's script, so the
    // script can prepare the panel for display.
    popup.port.on("panelActions", function(w) {
		console.log(w+" pressed");
		switch(w)
		{
			case "clickLoginButton":
				pressLoginButtonWorker.port.emit("userClickedPressLoginButton","");
				break;
			case "automateSSO":
				automateSSOWorker.port.emit("action","automateSSO");
				break;
			case "deleteCookies":
				ccc.deleteCookies();
				break;
			case "check_and_redo_credentials":
				ccc.check_and_redo_credentials();
				break;
			case "testSuiteStart":
				ccc.testSuiteStart(testSuiteWorker);
				break;
			default:
				break;
		}
		popup.hide();
    });
};