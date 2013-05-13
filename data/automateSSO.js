function AutomateSSO(){

	this.account = 1;				//indicate which account should be used when logging in.
	this.checked = false;
	var that = this;
	
	var checkDialogOAuth = function(){
		if (document.URL.indexOf("https://www.facebook.com/dialog/oauth")==-1) return false;
		//if (document.getElementById('u_0_0') == null) return false;
		//try to click it
		//document.getElementById('u_0_0').click();
		
		if (document.getElementsByClassName('selected')[0] == null) return false;
		//try to click it
		document.getElementsByClassName('selected')[0].click();
		return true;
	};
	
	var checkEnterPassword = function(){
		if (document.URL.indexOf("https://www.facebook.com/login.php")==-1) return false;
		
		if (document.getElementById('email') == null) return false;
		document.getElementById('email').value = (that.account == 1) ? "t-yuzhou@hotmail.com" : "t-yuzhou2@hotmail.com";	//another one is zhouyuchenking@hotmail.com
		
		if (document.getElementById('pass') == null) return false;
		document.getElementById('pass').value = "msr123456";
		
		if (document.getElementById('u_0_1') == null) return false;
		//try to click it
		document.getElementById('u_0_1').click();
		return true;
	};
	
	var checkPermissionRequest = function(){
		if (document.URL.indexOf("https://www.facebook.com/dialog/permissions.request")==-1) return false;
		//if (document.getElementById('u_0_0') == null) return false;
		//try to click it
		//document.getElementById('u_0_0').click();
		if (document.getElementsByClassName('selected')[0] == null) return false;
		//try to click it
		document.getElementsByClassName('selected')[0].click();
		return true;
	};
	
	this.checkEverything = function(){
		if (that.checked) return;
		that.checked = true;
		//init test account name
		self.port.emit("requestFBAccount",0);
		self.port.on("requestFBAccount", function (response){
			that.account = response;
			if (checkEnterPassword()) return;
			if (checkDialogOAuth()) return;
			if (checkPermissionRequest()) return;
		});
	};
	
	return this;
}

var automateSSO = new AutomateSSO();

function notifyOnbeforeunload() {
	self.port.emit("unloadedURL",document.URL);
}

window.addEventListener('beforeunload', notifyOnbeforeunload);
//trigger by the popup menu
self.port.on("action",function(action){
		if (action == "automateSSO"){
			automateSSO.checkEverything();
		}
	}
);
//auto-check every time.
//wait until test account name is inited.
window.addEventListener('load',function(){setTimeout(automateSSO.checkEverything,1000)});
setTimeout(automateSSO.checkEverything,2000);				//fallback if onload is not fired.	*Note*: This problem can probably be solved by writing 'run_at' : 'document.start' in manifest.json for all content scripts.
console.log("automateSSO.js loaded.");