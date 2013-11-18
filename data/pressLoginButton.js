function VulCheckerHelper() {

	var that = this;
	this.tryFindInvisibleLoginButton = false;
	this.indexToClick = 0;
	this.account = [];
	this.clickedButtons = [];
	this.userInfoFound = false;
	this.loginClickAttempts = 1;
	this.searchForSignUpForFB = false;
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
		var output = 0;
		if (that.loginClickAttempts == 1) {
			output = (inputStr.match(/FB/gi)!=null) ? 1 : 0;
			output += (inputStr.match(/facebook/gi)!=null) ? 1 : 0;
		}
		else if (that.loginClickAttempts > 1) {
			//after the first click, the page/iframe supposedly should nav to a sign-in heavy content, in this case we should emphasize on facebook string detection, instead of 'sign in' pattern.
			output = (inputStr.match(/FB/gi)!=null) ? 10 : 0;
			output += (inputStr.match(/facebook/gi)!=null) ? 10 : 0;
		}
		if (!that.searchForSignUpForFB)
		{
			output += (inputStr.match(/login/gi)!=null) ? 1 : 0;
			output += (inputStr.match(/log\sin/gi)!=null) ? 1 : 0;
			output += (inputStr.match(/sign\sin/gi)!=null) ? 1 : 0;
			output += (inputStr.match(/signin/gi)!=null) ? 1 : 0;
			output += (inputStr.match(/sign-in/gi)!=null) ? 1 : 0;
			output += (inputStr.match(/sign_in/gi)!=null) ? 1 : 0;
			output += (inputStr.match(/connect/gi)!=null) ? 1 : 0;
			
			that.hasLogin = that.hasLogin || (inputStr.match(/login/gi)!=null || inputStr.match(/log\sin/gi)!=null || inputStr.match(/sign\sin/gi)!=null || inputStr.match(/signin/gi)!=null || inputStr.match(/sign-in/gi)!=null || inputStr.match(/sign_in/gi)!=null || (inputStr.match(/connect/gi)!=null && inputStr.match(/connect[a-zA-Z]/gi)==null));
			//connect is a more common word, we need to at least restrict its existence, for example, we want to rule out "Connecticut" and "connection".
			//More heuristics TODO: give more weight to inputStr if it contains the exact strings: 'login with Facebook', 'connect with Facebook', 'sign in with facebook', etc.
		}
		else {
			//search for sign up with facebook, etc.
			output += (inputStr.match(/signup/gi)!=null) ? 1 : 0;
			output += (inputStr.match(/sign\sup/gi)!=null) ? 1 : 0;
			output += (inputStr.match(/sign_up/gi)!=null) ? 1 : 0;
			output += (inputStr.match(/sign-up/gi)!=null) ? 1 : 0;
			output += (inputStr.match(/register/gi)!=null) ? 1 : 0;
			output += (inputStr.match(/create/gi)!=null) ? 1 : 0;
			output += (inputStr.match(/join/gi)!=null) ? 1 : 0;
			that.hasLogin = that.hasLogin || (inputStr.match(/signup/gi)!=null || inputStr.match(/sign\sup/gi)!=null || inputStr.match(/sign_up/gi)!=null || inputStr.match(/sign-up/gi)!=null || inputStr.match(/create/gi)!=null || inputStr.match(/join/gi)!=null);				//semantically this should be that.hasSignUp, but we just put hasLogin here for simplicity.	
			
		}
			
		//bonus to fb and login existing both.
		that.hasFB = that.hasFB || (inputStr.match(/FB/gi)!=null || inputStr.match(/facebook/gi)!=null);
		
		//penalty on share/like
		that.hasLikeOrShare = that.hasLikeOrShare || (inputStr.match(/share/gi)!=null || inputStr.match(/like/gi)!=null);
		
		return output;
	}

	function AttrInfoClass(thisNode, thisScore) {
		this.node = thisNode;
		this.score = thisScore;
		return this;
	}
	
	this.isChildElement = function(parent, child){
		if (child == null) return false;
		if (parent == child) return true;
		if (parent == null || typeof parent == "undefined") return false;
		if (parent.children.length == 0) return false;
		var i = 0;
		for (i = 0; i < parent.children.length; i++)
		{
			if (that.isChildElement(parent.children[i],child)) return true;
		}
		return false;
	}
	
	this.onTopLayer = function(ele){
		//This doesn't really work on section/canvas HTML5 element. TODO:Fix this.
		//given an element, returns true if it's likely to be on the topmost layer, false if otherwise.
		if (!ele) return false;
		var document = ele.ownerDocument;
		var inputWidth = ele.offsetWidth;
		var inputHeight = ele.offsetHeight;
		//heuristics: any element with a too large dimension cannot be input/submit, it must be just a underlaying div/layer.
		if (inputWidth >= screen.availWidth/4 || inputHeight >= screen.availHeight/4) return false;
		if (inputWidth <= 0 || inputHeight <= 0) return false;			//Elements that are on top layer must be visible.
		var position = $(ele).offset();
		var j;
		var score = 0;
		//The following three lines of code is commented out because we assume the login button is on the active display (initial scroll position)
		// ele.scrollIntoView();
		// position.top = position.top - window.pageYOffset;
		// position.left = position.left - window.pageXOffset;
		//Don't judge the input unfairly because of the screen/browser window size.
		var maxHeight = (document.documentElement.clientHeight - position.top > inputHeight)? inputHeight : document.documentElement.clientHeight - position.top;
		var maxWidth = (document.documentElement.clientWidth > inputWidth)? inputWidth : document.documentElement.clientWidth - position.left;
		//Instead of deciding it on one try, deciding it on 10 tries.  This tackles some weird problems.
		for (j = 0; j < 10; j++)
		{
			score = that.isChildElement(ele,document.elementFromPoint(position.left+1+j*maxWidth/10, position.top+1+j*maxHeight/10)) ? score + 1 : score;
		}
		if (score >= 5) return true;
		else return false;
	}
	
	function preFilter(curNode) {
		if (curNode.nodeName != "A" && curNode.nodeName != "DIV" && curNode.nodeName != "SPAN" && curNode.nodeName != "IMG" && curNode.nodeName != "INPUT" && curNode.nodeName != "BUTTON") return false;
		if (curNode.nodeName == "INPUT") {
			if (curNode.type != "button" && curNode.type != "image" && curNode.type != "submit") return false;
		}
		if (that.clickedButtons.indexOf(that.getXPath(curNode)) != -1) {
			//avoiding clicking on the same button twice, now ignoring the duplicate button...
			return false;
		}
		return (that.tryFindInvisibleLoginButton || that.onTopLayer(curNode));
	}
	
	function computeAsRoot(curNode)
	{
		if (curNode == null || curNode.attributes == null || curNode.nodeName == "SCRIPT" || curNode.nodeName == "EMBED" ) return;		//ignore all script and embed elements
		if (curNode.nodeName.toLowerCase().indexOf("fb:")!=-1) return;				//to indicate if this tag is fb: something, we want to rule out those.
		//pre filter out buttons that are in the background, input whose type is not submit
		if (preFilter(curNode)) {
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
			var curChild = curNode.firstChild;
			while (curChild != null && typeof curChild != "undefined")
			{
				if (curChild.nodeType == 3) curScore = curScore + calculateScore(curChild.data);
				curChild = curChild.nextSibling;
			}
			if (that.hasLogin) curScore += 4;												//this is used to offset a lot of 'follow us on facebook' buttons.
			if (that.hasFB && that.hasLogin) curScore += 4;									//extra score if both terms are found.
			if (that.hasLikeOrShare && !that.hasLogin) curScore = -1;						//ignore like or share button without login.
			if ((curNode.offsetHeight > 150 || curNode.offsetWidth > 400) && curNode.nodeName != "BUTTON" && curNode.nodeName != "A" ) curScore = -1;		//ignore non-A and non-Button type login buttons that are too large, they may just be overlays.
			if (!that.tryFindInvisibleLoginButton) {if (curNode.offsetWidth <= 0 || curNode.offsetHeight <= 0) curScore = -1;}		//ignore invisible element.
			var temp = new AttrInfoClass(curNode, curScore);
			that.AttrInfoMap[that.count] = temp;
			that.count++;
		}
		if (curNode.nodeName == "IFRAME"){
			//ignore iframe, but check its children, since it could have lots of fb/facebook in its url as false positive.
			try {curNode = curNode.contentDocument.body || curNode.contentWindow.document.body;} catch(ex){
				//Do nothing here. If it violates SOP we just ignores it.
				//If we do not catch anything, console is going to output [object object] for each violation.
			}
		}
		for (i = 0; i <curNode.children.length; i++)
		{
			computeAsRoot(curNode.children[i]);
		}
	}

	function checkAccountInfoPresense(node){
		var fullContent = node.innerHTML.toLowerCase();
		fullContent = fullContent + document.cookie.toLowerCase();
		var i = 0;
		for (i = 0; i < that.account.length; i++){
			if (fullContent.indexOf(that.account[i].fbid)!=-1) return true;
			if (fullContent.indexOf(that.account[i].firstName)!=-1) return true;
			if (fullContent.indexOf(that.account[i].lastName)!=-1) return true;
			if (fullContent.indexOf(that.account[i].email)!=-1) return true;
			if (fullContent.indexOf(that.account[i].picSRC)!=-1) return true;
			if (fullContent.indexOf(that.account[i].picSRC2)!=-1) return true;
			if (fullContent.indexOf(that.account[i].picSRC3)!=-1) return true;
			if (fullContent.indexOf(that.account[i].picSRC4)!=-1) return true;
		}
		return false;
	}
	
	this.searchForLoginButton = function(rootNode) {
		that.init();
		if (checkAccountInfoPresense(rootNode)) {
			that.userInfoFound = true;
			return;
		}
		if (document.URL.indexOf('http://www.facebook.com/') == 0 || document.URL.indexOf('https://www.facebook.com/') == 0) {
			if (document.URL.indexOf('http://www.facebook.com/plugins/') == -1 && document.URL.indexOf('https://www.facebook.com/plugins/') == -1) {
				//These are URLs that we must not try to find login button in.
				return;
			}
		}
		if (document.URL.indexOf('http://www.facebook.com/login.php') == 0 || document.URL.indexOf('https://www.facebook.com/login.php') == 0){
			return;
		}
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
	
	this.sendLoginButtonInformation = function(response){
		//only send the first click, second click shall be ignored.
		that.tryFindInvisibleLoginButton = response.tryFindInvisibleLoginButton;
		that.searchForLoginButton(document.body);			//this doesn't necessarily mean a login button is found. sortedAttrInfoMap could be empty.
		if (that.userInfoFound) return {"loginButtonXPath":"USER_INFO_EXISTS!", "loginButtonOuterHTML":"USER_INFO_EXISTS!"};
		if (vulCheckerHelper.sortedAttrInfoMap.length <= response.indexToClick) return {"loginButtonXPath":"", "loginButtonOuterHTML":""};			//no login button found.
		return {"loginButtonXPath":vulCheckerHelper.getXPath(vulCheckerHelper.sortedAttrInfoMap[response.indexToClick].node), "loginButtonOuterHTML":vulCheckerHelper.sortedAttrInfoMap[response.indexToClick].node.outerHTML};
	}
	
	this.pressLoginButton = function(){
		that.searchForLoginButton(document.body);
		if (vulCheckerHelper.sortedAttrInfoMap.length <= vulCheckerHelper.indexToClick) {
			self.port.emit("noLoginButtonFound","");
			return;			//no login button found, tell ccc that.
		}
		self.port.emit("loginInfo",{"loginButtonXPath":vulCheckerHelper.getXPath(vulCheckerHelper.sortedAttrInfoMap[vulCheckerHelper.indexToClick].node), "loginButtonOuterHTML":vulCheckerHelper.sortedAttrInfoMap[vulCheckerHelper.indexToClick].node.outerHTML});
	}
	
	this.automaticPressLoginButton = function(){
		self.port.emit("getIndexOfLoginButtonToPress",0);
	}
	
	this.delayedPressLoginButton = function(){
		self.port.emit("checkTestingStatus",0);
	}
	
	this.getXPath = function(element) {
		var document = element.ownerDocument;
		if (element.id!=='' && typeof element.id != 'undefined')
			return "//"+element.tagName+"[@id='"+element.id+"']";
		if (element===document.body)
			return '/HTML/' + element.tagName;

		var ix = 0;
		if (typeof element.parentNode != 'undefined' && element.parentNode != null)
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
	
	this.init = function(){
	
		this.sortedAttrInfoMap = [];
		this.AttrInfoMap = [];
		this.count = 0;
		this.hasFB = false;									
		this.hasLogin = false;								
		this.hasLikeOrShare = false;
	}
	
	this.init();
	
	return this;
}

var vulCheckerHelper = new VulCheckerHelper();

//**** Below is a possible configuration ****//
/*
y = 0;
function scroll(y)
//this function scrolls quickly down the document to trigger some potential event handlers. (msn.com)
{
	if (y >= document.body.offsetHeight) {
		window.scrollTo(0, document.body.offsetHeight);
		window.scrollTo(0, 0);
		return;
	}
	window.scrollTo(0,y);
	y += screen.availHeight;
	setTimeout(scroll.bind(window,y),10);
}

scroll(y);
*/
//**** Above is a possible configuration ****//

if (self.port)
{
	//Doublecheck that the application didn't run into a confused state - phase 2 not updated promptly.
	self.port.on("userClickedPressLoginButton",function(action){
		vulCheckerHelper.account = [];
		vulCheckerHelper.pressLoginButton();
	});
	self.port.on("sendLoginButtonInformation",function(response){
		vulCheckerHelper.account = response.account;
		vulCheckerHelper.searchForSignUpForFB = response.searchForSignUpForFB;
		self.port.emit("sendLoginButtonInformation",vulCheckerHelper.sendLoginButtonInformation(response));
	});
	self.port.on("after_modification_sendLoginButtonInformation",function(response){
		vulCheckerHelper.account = response.account;
		self.port.emit("after_modification_sendLoginButtonInformation",vulCheckerHelper.sendLoginButtonInformation(response));
	});
	self.port.on("indexOfLoginButtonToPress", function (response){
		//tell background we are about to press the login button.
		//response should contain whether background page has detected that FB has been visited.
		vulCheckerHelper.tryFindInvisibleLoginButton = response.tryFindInvisibleLoginButton;
		vulCheckerHelper.indexToClick = response.indexToClick;
		vulCheckerHelper.loginClickAttempts = response.loginClickAttempts;
		if (response.shouldClick) vulCheckerHelper.pressLoginButton();			//this condition ensures that once FB traffic is seen, we do not want to press login button again.
	});
	self.port.on("checkTestingStatus", function (response){
		//check if background is in active checking.
		vulCheckerHelper.account = response.account;
		vulCheckerHelper.searchForSignUpForFB = response.searchForSignUpForFB;
		if (response.shouldClick) vulCheckerHelper.automaticPressLoginButton();		//need to set a lenient timer, since if the fb traffic is not seen in this time, it's going to click the login button again, which resets the connection - this may create an infinite loop. Current setting is that if the login button is pressed more than twice, it gives up.
	});
	self.port.on("readyToClick", function(){
		if (vulCheckerHelper.sortedAttrInfoMap.length > vulCheckerHelper.indexToClick) {
			vulCheckerHelper.sortedAttrInfoMap[vulCheckerHelper.indexToClick].node.click();
			vulCheckerHelper.clickedButtons.push(vulCheckerHelper.getXPath(vulCheckerHelper.sortedAttrInfoMap[vulCheckerHelper.indexToClick].node));		//record the clicked button, so that we don't click the same button next time if the page doesn't nav away.
		}
	});
	//window.addEventListener('load',vulCheckerHelper.delayedPressLoginButton);				//must not do this. FF's gonna give u stupid hidden window error.
	self.port.emit("clearPressLoginButtonTimer",0);
	setTimeout(vulCheckerHelper.delayedPressLoginButton,5000);
}
else
{
	vulCheckerHelper.searchForLoginButton(document.body);
	console.log(vulCheckerHelper.sortedAttrInfoMap);
}