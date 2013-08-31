function AutomateSSO(){

	this.account = 1;				//indicate which account should be used when logging in.
	this.checked = false;
	var that = this;
	
	this.accountA = accounts[0];
	this.accountB = accounts[1];
	
	this.checkDialogOAuth = function(){
		if (document.URL.indexOf("https://www.facebook.com/dialog/oauth")==-1) return false;
		if (document.getElementById('u_0_0') != null && document.getElementById('u_0_0').nodeName == "INPUT") document.getElementById('u_0_0').click();	//gamezone.com customize the SSO experience. I don't know if this is common but let us deal with this first.
		if (document.getElementsByClassName('selected')[0] == null) return false;
		//try to click it
		document.getElementsByClassName('selected')[0].click();
		return true;
	};
	
	this.checkEnterPassword = function(){
		if (document.URL.indexOf("https://www.facebook.com/login.php")==-1) return false;
		
		if (document.getElementById('email') == null) return false;
		
		document.getElementById('email').value = (that.account == 1) ? accounts[0].email : accounts[1].email;	//another one is zhouyuchenking@hotmail.com
		
		if (document.getElementById('pass') == null) return false;
		document.getElementById('pass').value = (that.account == 1) ? accounts[0].passwd : accounts[1].passwd;
		
		if (document.getElementById('u_0_1') == null) return false;
		self.port.emit("credentialsInserted","");			//everything ready, tell ccc we are ready to click.
		return true;
	};
	
	this.checkPermissionRequest = function(){
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
	};
	
	return this;
}

var automateSSO = new AutomateSSO();
window.moveTo(0, 0);
window.resizeTo(screen.availWidth, screen.availHeight);
//disable the following APIs for the website.
unsafeWindow.moveTo = function(){};
unsafeWindow.moveBy = function(){};
unsafeWindow.resizeTo = function(){};
unsafeWindow.resizeBy = function(){};
unsafeWindow.alert = function(){};
unsafeWindow.confirm = function(){};
//trigger by the popup menu
self.port.on("action",function(action){
		if (action == "automateSSO"){
			automateSSO.checkEverything();
		}
	}
);
self.port.on("requestFBAccount", function (response){
	if (!response.shouldAutomateSSO) return;
	automateSSO.account = response.FBAccount;
	if (automateSSO.checkEnterPassword()) return;
	if (automateSSO.checkDialogOAuth()) return;
	if (automateSSO.checkPermissionRequest()) return;
});

self.port.on("requestAccountInfo",function(resp){
	self.port.emit("requestAccountInfo",accounts);
});

self.port.on("goAheadAndClick",function(){
	//try to click it
	document.getElementById('u_0_1').click();
});

//auto-check every time.
//wait until test account name is inited.
window.addEventListener('load',function(){window.setTimeout(automateSSO.checkEverything,2000);});
//window.setTimeout(automateSSO.checkEverything,2000);				//fallback if onload is not fired.	*Note*: This problem can probably be solved by writing 'run_at' : 'document.start' in manifest.json for all content scripts.