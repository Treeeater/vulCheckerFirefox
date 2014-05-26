// This is an active module of the test Add-on
// To use this tool effectively, turn off cache on Firefox by going to about:config and set network.http.use-cache to false.
// Otherwise the traffic recorder will get incomplete data.

const {Cc,Ci,Cr} = require("chrome");
var window = Cc["@mozilla.org/appshell/appShellService;1"].getService(Ci.nsIAppShellService).hiddenDOMWindow;

exports.main = function() {

    var data = require("sdk/self").data;
    var pageMod = require("sdk/page-mod");
	var ccc = require("./ccc");
	var PT = require("./persistentThreats");
	
    pageMod.PageMod({
		include: "*",
		contentScriptFile: [data.url("jquery-1.11.0-rc1.js"), data.url("pressLoginButton.js")],
		contentScriptWhen: 'end',
		onAttach: function(worker) {
			ccc.initPressLoginButton(worker);
		},
		attachTo: ["top"]
    });
	
	pageMod.PageMod({
		include: ["https://*", "http://www.facebook.com/plugins/login_button.php*"],
		contentScriptFile: [data.url("jquery-1.11.0-rc1.js"), data.url("pressLoginButtonIFrame.js")],
		contentScriptWhen: 'end',
		onAttach: function(worker) {
			ccc.initIFramePressLoginButtonWorker(worker);
		},
		attachTo: ["frame"]
    });
	
	pageMod.PageMod({
		include: ["*"],
		contentScriptFile: [data.url("persistentThreatsCS.js")],
		contentScriptWhen: 'end',
		onAttach: function(worker) {
			PT.initPTCSWorker(worker);
		},
		attachTo: ["top"]
    });
	
	pageMod.PageMod({
		include: "*",
		contentScriptFile: [data.url("accounts.js"), data.url("automateSSO.js")],
		contentScriptWhen: 'start',
		onAttach: function(worker) {
			ccc.initAutomateSSOWorker(worker);
		},
		attachTo: ["top"]
    });
	
	pageMod.PageMod({
		include: "*",
		contentScriptFile: [data.url("testSuite.js")],
		contentScriptWhen: 'end',
		onAttach: function(worker) {
			ccc.initTestSuiteWorker(worker);
		},
		attachTo: ["top"]
    });
	
	pageMod.PageMod({
		include: "*",
		contentScriptFile: [data.url("jquery-1.11.0-rc1.js"), data.url("finishRegistration.js")],
		contentScriptWhen: 'end',
		onAttach: function(worker) {
			ccc.initRegistrationWorker(worker);
		},
		attachTo: ["top"]
    });
	
	pageMod.PageMod({
		include: "https://*",
		contentScriptFile: [data.url("jquery-1.11.0-rc1.js"), data.url("finishRegistrationIFrame.js")],
		contentScriptWhen: 'end',
		onAttach: function(worker) {
			ccc.initIFrameRegistrationWorker(worker);
		},
		attachTo: ["frame"]
    });
	
    var popup = require("sdk/panel").Panel({
      width: 120,
      height: 230,
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
		switch(w)
		{
			case "clickLoginButton":
				ccc.pressLoginButtonWorker().port.emit("userClickedPressLoginButton","");
				break;
			case "deleteCookies":
				ccc.deleteCookies();
				break;
			case "finishRegistration":
				//ccc.registrationWorker().port.emit("startRegister",{"manualClick":true});
				break;
			case "check_and_redo_credentials":
				ccc.check_and_redo_credentials();
				break;
			case "testSuiteStart":
				ccc.testSuiteStart(ccc.testSuiteWorker());
				break;
			default:
				break;
		}
		popup.hide();
    });
};