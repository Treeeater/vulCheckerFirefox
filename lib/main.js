// This is an active module of the test Add-on
exports.main = function() {

    var data = require("sdk/self").data;
    var pageMod = require("sdk/page-mod");
	var ccc = require("./ccc");
    var pressLoginButtonWorker;
	var automateSSOWorker;
	var testSuiteWorker;
	
    pageMod.PageMod({
		include: "*",
		contentScriptFile: data.url("pressLoginButton.js"),
		onAttach: function(worker) {
			pressLoginButtonWorker = worker;
			ccc.initPressLoginButton(pressLoginButtonWorker);
		},
		attachTo: ["top"]
    });
	
	pageMod.PageMod({
		include: "*",
		contentScriptFile: data.url("automateSSO.js"),
		onAttach: function(worker) {
			automateSSOWorker = worker;
			ccc.initAutomateSSOWorker(automateSSOWorker);
		},
		attachTo: ["top"]
    });
	
	pageMod.PageMod({
		include: "*",
		contentScriptFile: data.url("testSuite.js"),
		onAttach: function(worker) {
			testSuiteWorker = worker;
			ccc.initTestSuiteWorker(testSuiteWorker);
		},
		attachTo: ["top"]
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
				pressLoginButtonWorker.port.emit("action","userClickedPressLoginButton");
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