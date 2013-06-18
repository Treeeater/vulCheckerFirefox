function VulCheckerHelper() {

	var that = this;
	this.clicked = 0;
	this.tryFindInvisibleLoginButton = false;
	this.indexToClick = 0;
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
		that.hasLogin = that.hasLogin || (inputStr.match(/login/gi)!=null || inputStr.match(/log\sin/gi)!=null || inputStr.match(/sign\sin/gi)!=null || inputStr.match(/signin/gi)!=null || (inputStr.match(/connect/gi)!=null && inputStr.match(/connect[a-zA-Z]/gi)==null));				
		//connect is a more common word, we need to at least restrict its existence, for example, we want to rule out "Connecticut" and "connection".
		//More heuristics TODO: give more weight to inputStr if it contains the exact strings: 'login with Facebook', 'connect with Facebook', 'sign in with facebook', etc.
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
		if (curNode.nodeName.toLowerCase().indexOf("fb:")!=-1) return;				//to indicate if this tag is fb: something, we want to rule out those.
		try {
			
			if (curNode.nodeName == "A" || curNode.nodeName == "DIV" || curNode.nodeName == "SPAN" || curNode.nodeName == "IMG" || curNode.nodeName == "INPUT") {
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
				if (!that.tryFindInvisibleLoginButton) {if (curNode.offsetWidth <= 0 || curNode.offsetHeight <= 0) curScore = -1;}		//ignore invisible element.
				var temp = new AttrInfoClass(curNode, curScore);
				that.AttrInfoMap[that.count] = temp;
				that.count++;
			}
			if (curNode.nodeName == "IFRAME"){
				//ignore iframe, but check its children, since it could have lots of fb/facebook in its url as false positive.
				try {curNode = curNode.contentDocument.body || curNode.contentWindow.document.body;} catch(ex){
					//console.log(ex.message);
					//Do nothing here. If it violates SOP we just ignores it.
					//If we do not catch anything, console is going to output [object object] for each violation.
				}
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
		that.init();
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
	
	this.pressLoginButton = function(){
		//the following two statements need to be called maybe more than 1 time until a popup is presented, because some sites alter dom tree/navigate to new page and does not first present fb login button.
		if (that.clicked > 2) {
			console.log("pressed Login button too many times... Give up.");				//This code is unnecessary (checking logic moved to ccc.js) after 6/5/2013
			return;
		}
		that.clicked++;
		that.searchForLoginButton(document.body);
		if (vulCheckerHelper.sortedAttrInfoMap.length <= vulCheckerHelper.indexToClick) return;			//no login button found.
		console.log("pressing Login button @ XPath in iframe: " + vulCheckerHelper.getXPath(vulCheckerHelper.sortedAttrInfoMap[vulCheckerHelper.indexToClick].node));
		vulCheckerHelper.sortedAttrInfoMap[vulCheckerHelper.indexToClick].node.click();
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

var delayedCall = function(){
	self.port.emit("checkTestingStatus","");
}
if (self.port)
{
	setTimeout(delayedCall,2000);
	self.port.on("checkTestingStatus",function(response){
		if (response.shouldClick) {
			console.log("https iframe detected while press login button should be clicked...");
			vulCheckerHelper.indexToClick = response.indexToClick;
			vulCheckerHelper.pressLoginButton();
		}
	});
}
else
{
	vulCheckerHelper.searchForLoginButton(document.body);
	console.log(vulCheckerHelper.sortedAttrInfoMap);
}