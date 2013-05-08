function VulCheckerHelper() {

	var that = this;
	this.clicked = false;
	function createCookie(name,value,days) {
		if (days) {
			var date = new Date();
			date.setTime(date.getTime()+(days*24*60*60*1000));
			var expires = "; expires="+date.toGMTString();
		}
		else var expires = "";
		document.cookie = name+"="+value+expires+"; domain=.huffingtonpost.com; path=/";
	}

	function eraseCookie(name) {
		createCookie(name,"",-1);
	}

	function eraseAllCookies() {
		var cookies = document.cookie.split(";");
		for (var i = 0; i < cookies.length; i++) eraseCookie(cookies[i].split("=")[0]); localStorage.clear();
	}

	function calculateScore(inputStr)
	{
		return calculateFBScore(inputStr);
	}

	function calculateFBScore(inputStr)
	{
		var output = (inputStr.match(/FB/gi)!=null) ? 1 : 0;
		output += (inputStr.match(/facebook/gi)!=null) ? 1 : 0;
		output += (inputStr.match(/login/gi)!=null) ? 1 : 0;
		output += (inputStr.match(/log\sin/gi)!=null) ? 1 : 0;
		output += (inputStr.match(/sign\sin/gi)!=null) ? 1 : 0;
		output += (inputStr.match(/signin/gi)!=null) ? 1 : 0;
		output += (inputStr.match(/connect/gi)!=null) ? 1 : 0;
		
		//penalty on share/like
		that.hasLikeOrShare = that.hasLikeOrShare || (inputStr.match(/share/gi)!=null || inputStr.match(/like/gi)!=null);
		
		//bonus to fb and login existing both.
		that.hasFB = that.hasFB || (inputStr.match(/FB/gi)!=null || inputStr.match(/facebook/gi)!=null);
		that.hasLogin = that.hasLogin || (inputStr.match(/login/gi)!=null || inputStr.match(/log\sin/gi)!=null || inputStr.match(/sign\sin/gi)!=null || inputStr.match(/signin/gi)!=null || inputStr.match(/connect/gi)!=null);
		
		return output;
	}

	function AttrInfoClass(thisNode, thisScore) {
		this.node = thisNode;
		this.score = thisScore;
		return this;
	}

	function computeAsRoot(curNode)
	{
		if (curNode == null || curNode.attributes == null || curNode.nodeName == "SCRIPT" || curNode.nodeName == "EMBED" ) return;		//ignore all script and embed elements
		try {
			if (curNode.nodeName != "IFRAME") {			//ignore iframe, but check its children, since it could have lots of fb/facebook in its url as false positive.
				var i = 0;
				var curScore = 0;
				that.hasFB = false;									//to indicate if this element has facebook-meaning term.
				that.hasLogin = false;								//to indicate if this element has login-meaning term.
				that.hasLikeOrShare = false;							//to indicate if this element has share/like word.
				for (i = 0; i < curNode.attributes.length; i++)
				{
					var temp = curNode.attributes[i].name + "=" + curNode.attributes[i].value + ";"
					curScore += calculateScore(temp);
				}
				if (curNode.children != undefined && curNode.firstChild != null && curNode.children.length == 0 && curNode.firstChild.nodeType == 3)
				{
					curScore = curScore + calculateScore(curNode.firstChild.data);
				}
				if (that.hasFB && that.hasLogin) curScore += 4;									//extra score if both terms are found.
				if (that.hasLikeOrShare && !that.hasLogin) curScore = -1;						//ignore like or share button without login.
				if (curNode.offsetWidth <= 0 || curNode.offsetHeight <= 0) curScore = -1;		//ignore invisible element.
				var temp = new AttrInfoClass(curNode, curScore);
				that.AttrInfoMap[that.count] = temp;
				that.count++;
			}
			for (i = 0; i <curNode.children.length; i++)
			{
				computeAsRoot(curNode.children[i]);
			}
		}
		catch(e){
			console.log(e);
		}
	}

	this.searchForLoginButton = function(rootNode) {
		computeAsRoot(rootNode);
		var i = 0;
		var j = 0;
		for (i = 0; i < that.count; i++)
		{
			max = 0;
			maxindex = -1;
			for (j = 0; j < that.count; j++)
			{
				if (that.AttrInfoMap[j].score > max) {
					max = that.AttrInfoMap[j].score;
					maxindex = j;
				}
			}
			if (max == 0) {return;}
			else {
				that.sortedAttrInfoMap[i] = new AttrInfoClass(that.AttrInfoMap[maxindex].node, that.AttrInfoMap[maxindex].score);
				that.AttrInfoMap[maxindex].score = -1;
			}
		}
	}
	
	this.sendLoginButtonInformation = function(){
		//the following two statements need to be called maybe more than 1 time until a popup is presented, because some sites alter dom tree/navigate to new page and does not first present fb login button.
		that.searchForLoginButton(document.body);
		//alert(that.sortedAttrInfoMap[0].score);
		return {"loginButtonXPath":vulCheckerHelper.getXPath(vulCheckerHelper.sortedAttrInfoMap[0].node), "loginButtonOuterHTML":vulCheckerHelper.sortedAttrInfoMap[0].node.outerHTML};
	}
	
	this.pressLoginButton = function(){
		//the following two statements need to be called maybe more than 1 time until a popup is presented, because some sites alter dom tree/navigate to new page and does not first present fb login button.
		that.searchForLoginButton(document.body);
		//alert(that.sortedAttrInfoMap[0].score);
		self.port.emit("loginInfo",{"loginButtonXPath":vulCheckerHelper.getXPath(vulCheckerHelper.sortedAttrInfoMap[0].node), "loginButtonOuterHTML":vulCheckerHelper.sortedAttrInfoMap[0].node.outerHTML});
		self.port.on("readyToClick", function(){vulCheckerHelper.sortedAttrInfoMap[0].node.click();});
	}
	
	this.automaticPressLoginButton = function(){
		self.port.emit("pressedLoginButton",0);
		self.port.on("pressedLoginButton", function (response){
			//tell background we are about to press the login button.
			//response should contain whether background page has detected that FB has been visited.
			if (response.capturingPhase == 2 || response.capturingPhase == 8) vulCheckerHelper.pressLoginButton();			//this condition ensures that once FB traffic is seen, we do not want to press login button again.
			else clearInterval(vulCheckerHelper.automaticPressIntervalHandler);
		});
	}
	
	this.delayedPressLoginButton = function(){
		if (that.clicked) return;
		that.clicked = true;
		self.port.emit("checkTestingStatus",0);
		self.port.on("checkTestingStatus", function (response){
			//check if background is in active checking.
			if (response.capturingPhase == 2 || response.capturingPhase == 8) vulCheckerHelper.automaticPressIntervalHandler = setInterval(vulCheckerHelper.automaticPressLoginButton, 3000);
		});
	}
	
	this.getXPath = function(element) {
		if (element.id!=='' && typeof element.id != 'undefined')
			return "//"+element.tagName+"[@id='"+element.id+"']";
		if (element===document.body)
			return '/HTML/' + element.tagName;

		var ix = 0;
		if (typeof element.parentNode != 'undefined')
		{
			var siblings = element.parentNode.childNodes;
			for (var i= 0; i<siblings.length; i++) {
				var sibling= siblings[i];
				if (sibling===element)
					return that.getXPath(element.parentNode)+'/'+element.tagName+'['+(ix+1)+']';
				if (sibling.nodeType===1 && sibling.tagName===element.tagName)
					ix++;
			}
		}
	}
	
	this.sortedAttrInfoMap = [];
	this.AttrInfoMap = [];
	this.count = 0;
	this.hasFB = false;									
	this.hasLogin = false;								
	this.hasLikeOrShare = false;
	this.automaticPressIntervalHandler;
	
	return this;
}

var vulCheckerHelper = new VulCheckerHelper();

self.port.on("action",function(action){
		if (action == "userClickedPressLoginButton"){
			vulCheckerHelper.pressLoginButton();
		}
		if (action == "sendLoginButtonInformation") {
			self.port.emit("sendLoginButtonInformation",vulCheckerHelper.sendLoginButtonInformation());
		}
	}
);
//window.addEventListener('load',vulCheckerHelper.delayedPressLoginButton);				//must not do this. FF's gonna give u stupid hidden window error.
setTimeout(vulCheckerHelper.delayedPressLoginButton,2000);
console.log("pressLoginButton.js loaded.");