var debug = true;

var log = function (str){
	if (debug) console.log(str);
	if (self.port) self.port.emit("writeToFileRequest",str);
}

function VulCheckerHelper() {

	var that = this;
	this.clicked = 0;
	//options:
	this.tryFindInvisibleLoginButton = false;
	this.searchForSignUpForFB = false;
	this.indexToClick = 0;
	this.relaxedStringMatch = false;
	
	this.account = [];
	this.clickedButtons = [];
	this.userInfoFound = false;
	this.iframeClickedOuterHTML = [];
	this.loginClickAttempts = 0;
	this.results = {};	
	
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
		if (that.loginClickAttempts == 0) {
			output = (inputStr.match(/FB/gi)!=null) ? inputStr.match(/FB/gi).length : 0;
			output += (inputStr.match(/facebook/gi)!=null) ? inputStr.match(/facebook/gi).length : 0;
			that.stringSig[0] += (inputStr.match(/FB/gi)!=null) ? inputStr.match(/FB/gi).length : 0;
			that.stringSig[1] += (inputStr.match(/facebook/gi)!=null) ? inputStr.match(/facebook/gi).length : 0;
		}
		else if (that.loginClickAttempts > 0) {
			//after the first click, the page/iframe supposedly should nav to a sign-in heavy content, in this case we should emphasize on facebook string detection, instead of 'sign in' pattern.
			output = (inputStr.match(/FB/gi)!=null) ? 10 * inputStr.match(/FB/gi).length : 0;
			output += (inputStr.match(/facebook/gi)!=null) ? 10 * inputStr.match(/facebook/gi).length : 0;
			that.stringSig[0] += (inputStr.match(/FB/gi)!=null) ? inputStr.match(/FB/gi).length : 0;
			that.stringSig[1] += (inputStr.match(/facebook/gi)!=null) ? inputStr.match(/facebook/gi).length : 0;
		}
		//bonus to fb and login existing both.
		that.hasFB = that.hasFB || (inputStr.match(/FB/gi)!=null || inputStr.match(/facebook/gi)!=null);
		
		if (!that.searchForSignUpForFB)
		{
			var i = 0;
			var temp;
			var regexes = [/oauth/gi, /log[\s-_]?[io]n/gi, /sign[\s-_]?[io]n/gi, /connect$|connect[^a-zA-Z]/gi];	
			//"connect" is a more common word, we need to at least restrict its existence, for example, we want to rule out "Connecticut" and "connection".
			if (that.relaxedStringMatch) {
				regexes = regexes.concat([/account$|account[^a-zA-Z]/gi, /forum/gi]);		//so is 'account'
				for (i = 0; i < regexes.length; i++)
				{
					temp = inputStr.match(regexes[i]);
					output += (temp!=null) ? temp.length : 0;
					that.stringSig[i+2] += (temp!=null) ? temp.length : 0;
					that.hasLogin = that.hasLogin || temp!=null;
				}
			}
			else {
				for (i = 0; i < regexes.length; i++)
				{
					temp = inputStr.match(regexes[i]);
					output += (temp!=null) ? temp.length : 0;
					that.hasLogin = that.hasLogin || temp!=null;
				}
				regexes = regexes.concat([/account$|account[^a-zA-Z]/gi, /forum/gi]);
				for (i = 0; i < regexes.length; i++)
				{
					temp = inputStr.match(regexes[i]);
					that.stringSig[i+2] += (temp!=null) ? temp.length : 0;			//although we don't count them into score, still want to know the distribution.
				}
			}
			//More heuristics TODO: give more weight to inputStr if it contains the exact strings: 'login with Facebook', 'connect with Facebook', 'sign in with facebook', etc.
		}
		else {
			var regexes = [/oauth/gi, /sign[\s-_]?up/gi, /register/gi, /create/gi, /join/gi];	
			//"connect" is a more common word, we need to at least restrict its existence, for example, we want to rule out "Connecticut" and "connection".
			var i = 0;
			var temp;
			for (i = 0; i < regexes.length; i++)
			{
				temp = inputStr.match(regexes[i]);
				output += ((temp!=null) ? temp.length : 0);
				that.hasLogin = that.hasLogin || (temp!=null);
			}			
		}
		
		//penalty on share/like
		that.hasLikeOrShare = that.hasLikeOrShare || (inputStr.match(/share/gi)!=null || inputStr.match(/like/gi)!=null);
		
		return output;
	}

	function AttrInfoClass(thisNode, thisScore, thisStringSig) {
		this.node = thisNode;
		this.score = thisScore;
		this.stringSig = thisStringSig;
		this.strategy = -1;
		this.worker = null;
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
	
	this.tryAnotherStrategy = function(){
		if (!that.tryFindInvisibleLoginButton && !that.relaxedStringMatch){
			that.tryFindInvisibleLoginButton = true;
			return true;
		}
		if (that.tryFindInvisibleLoginButton && !that.relaxedStringMatch){
			that.tryFindInvisibleLoginButton = false;
			that.relaxedStringMatch = true;
			return true;
		}
		if (!that.tryFindInvisibleLoginButton && that.relaxedStringMatch){
			that.tryFindInvisibleLoginButton = true;
			that.relaxedStringMatch = true;
			return true;
		}
		return false;			//no other strategies available
	};
	
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
		if (curNode.nodeName == "A") {
			if (curNode.href.toLowerCase().indexOf('mailto:') == 0) return false;
		}
		if (that.clickedButtons.indexOf(that.getXPath(curNode)) != -1) {
			//avoiding clicking on the same button twice, now ignoring the duplicate button.
			return false;
		}
		if (that.iframeClickedOuterHTML.indexOf(curNode.outerHTML) != -1) {
			//avoiding clicking on the same button twice, now ignoring the duplicate button.
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
			that.stringSig = Array.apply(null, new Array(8)).map(Number.prototype.valueOf,0);
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
			var temp = new AttrInfoClass(curNode, curScore, that.stringSig.join("|"));
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
		for (i = 0; i < curNode.children.length; i++)
		{
			computeAsRoot(curNode.children[i]);
		}
	}
	
	function checkAccountInfoPresense(node){
		var fullContent = node.innerHTML.toLowerCase();
		var re = /_gig_llu=.*?;/
		var temp = document.cookie;
		fullContent = fullContent + temp.replace(re,'').toLowerCase();
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
			return;
		}
		if (document.URL.indexOf('http://www.facebook.com/') == 0 || document.URL.indexOf('https://www.facebook.com/') == 0) {
			//These are URLs that we must not try to find login button in.
			if (document.URL.indexOf('http://www.facebook.com/plugins/') == -1 && document.URL.indexOf('https://www.facebook.com/plugins/') == -1) return;
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
				that.sortedAttrInfoMap[i] = new AttrInfoClass(that.AttrInfoMap[maxindex].node, that.AttrInfoMap[maxindex].score, that.AttrInfoMap[maxindex].stringSig);
				that.AttrInfoMap[maxindex].score = -1;
			}
		}
	}
	
	this.reportCandidates = function(){
		that.flattenedResults = new Array();
		that.results = new Array();		//clean results in case this is a second click attempt and the first click did not navigate the page.
		that.tryFindInvisibleLoginButton = false;			//reset strategy
		that.relaxedStringMatch = false;
		var curStrategy = 0;
		while (true){
			that.searchForLoginButton(document.body);
			that.results[curStrategy] = that.sortedAttrInfoMap;
			curStrategy++;
			if (!that.tryAnotherStrategy() || that.userInfoFound) break;
		}
		if (that.userInfoFound){
			self.port.emit("reportCandidates",[{
				score: -999, 
				node: null, 
				strategy: null,
				XPath: "USER_INFO_EXISTS!",
				outerHTML: "USER_INFO_EXISTS!",
				original_index: 0
			}]);
			return;
		}
		//TODO:flatten the results, get rid of duplicates and populate strategy field.
		var pointers = Array.apply(null, new Array(curStrategy)).map(Number.prototype.valueOf,0);
		var i;
		var j;
		var maxScore;
		var maxNode;
		var maxStrategy;
		var maxXPath;
		var maxOuterHTML;
		var maxStringSig;
		var breakFlag;
		var dupFlag;
		while (true){
			maxScore = -999;
			maxStrategy = -1;
			breakFlag = 0;
			//merge all sorted arrays.
			for (j = 0; j < curStrategy; j++)
			{
				if (that.results[j].length == 0 || pointers[j] >= that.results[j].length) {
					//this strategy already depleted and merged, go to the next strategy
					breakFlag++;
					continue;
				}
				if (maxScore < that.results[j][pointers[j]].score){
					maxScore = that.results[j][pointers[j]].score;
					maxNode = that.results[j][pointers[j]].node;
					maxXPath = that.getXPath(that.results[j][pointers[j]].node);
					maxOuterHTML = that.results[j][pointers[j]].node.outerHTML;
					maxStringSig = that.results[j][pointers[j]].stringSig;
					maxStrategy = j;
				}
			}
			if (maxStrategy != -1){
				dupFlag = false;
				for (i = 0; i < that.flattenedResults.length; i++)
				{
					if (that.flattenedResults[i].node == maxNode) {
						that.flattenedResults[i].stats = that.flattenedResults[i].stats + maxStrategy.toString() + "/" + maxScore.toString() + "/" + pointers[maxStrategy].toString() + ";";
						dupFlag = true;
						break;
					}
				}
				if (!dupFlag){		
					//avoid duplicate candidate (another strategy is to boost duplicate's score, but we can worry about this later.
					that.flattenedResults.push({
						score: maxScore, 
						node: maxNode, 
						strategy: maxStrategy,
						stringSig: maxStringSig,
						XPath: maxXPath,
						outerHTML: maxOuterHTML,
						original_index: that.flattenedResults.length,
						stats: maxStrategy.toString() + "/" + maxScore.toString() + "/" + pointers[maxStrategy].toString() + ";"
					});
				}
				pointers[maxStrategy]++;
			}
			if (breakFlag == curStrategy) break;
		}
		if ((!!self.port) && that.flattenedResults.length != 0) self.port.emit("reportCandidates",that.flattenedResults);
		else return that.flattenedResults;			//for console debugging purposes.
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
		this.userInfoFound = false;
	}
	
	this.init();
	
	return this;
}

var vulCheckerHelper = new VulCheckerHelper();

if (self.port && (document.URL.indexOf('http://www.facebook.com/login.php') == -1 && document.URL.indexOf('https://www.facebook.com/login.php') == -1))
{
	//press login button worker has two duties:
	//1: report all candidates under all configurations (upon request).
	//2: click a specific candidate given a strategy.
	//duty 1: report candidates
	self.port.on("reportCandidates", function (response){
		//need three things from response: current account, if we are looking for sign up for FB, and what's the current click attempt number
		vulCheckerHelper.account = response.account;
		vulCheckerHelper.searchForSignUpForFB = response.searchForSignUpForFB;
		vulCheckerHelper.loginClickAttempts = response.loginClickAttempts;
		//two special cases, don't need to go through reportCandidates (iframe specific)
		if (response.searchForSignUpForFB && (document.URL.indexOf('http://www.facebook.com/plugins/registration')==0 || document.URL.indexOf('https://www.facebook.com/plugins/registration')==0) && document.documentElement.offSetHeight != 0 && document.documentElement.offSetWidth != 0){
			//make sure register plugin is visible.
			if (document.getElementById('fbRegistrationLogin')!=null) {
				//to handle registration plugins.
				vulCheckerHelper.flattenedResults = [];
				vulCheckerHelper.flattenedResults.push({
					score: 999, 
					node: document.getElementById('fbRegistrationLogin'), 
					strategy: 5,				//5 means widget
					XPath: vulCheckerHelper.getXPath(document.getElementById('fbRegistrationLogin')),
					outerHTML: document.getElementById('fbRegistrationLogin').outerHTML,
					original_index: vulCheckerHelper.flattenedResults.length,
					stats: "-1/999/0;",
					stringSig: "NA|NA|NA|NA|NA|NA|NA|NA"
				});
				self.port.emit("reportCandidates",vulCheckerHelper.flattenedResults);
			}
		}
		else if ((document.URL.indexOf('http://www.facebook.com/plugins/login_button.php')==0 || document.URL.indexOf('https://www.facebook.com/plugins/login_button.php')==0) && document.documentElement.offSetHeight != 0 && document.documentElement.offSetWidth != 0){
			if (document.getElementsByClassName('fwb').length>0) {
				vulCheckerHelper.flattenedResults = [];
				vulCheckerHelper.flattenedResults.push({
					score: 999, 
					node: document.getElementsByClassName('fwb')[0], 
					strategy: 5,				//5 means widget
					XPath: vulCheckerHelper.getXPath(document.getElementsByClassName('fwb')[0]),
					outerHTML: document.getElementsByClassName('fwb')[0].outerHTML,
					original_index: vulCheckerHelper.flattenedResults.length,
					stats: "-1/999/0;",
					stringSig: "NA|NA|NA|NA|NA|NA|NA|NA"
				});
				self.port.emit("reportCandidates",vulCheckerHelper.flattenedResults);
			}
		}
		else if (document.URL.indexOf('http://www.facebook.com/plugins/')==0 || document.URL.indexOf('https://www.facebook.com/plugins/')==0){
			//this gotta be like, comment, follow, facepile, or anything else that's unrelated to the site's functionality, ignore.
		}
		else {
			vulCheckerHelper.reportCandidates();		//Just report the candidates, don't click on anything yet.
		}
	});
	//duty 2: click candidate
	self.port.on("clickCandidate", function(response){
		//need 1 thing from response: which candidate (rank) are we clicking.
		vulCheckerHelper.flattenedResults[response.original_index].node.click();
		vulCheckerHelper.clickedButtons.push(vulCheckerHelper.getXPath(vulCheckerHelper.flattenedResults[response.original_index].node));		//record the clicked button, so that we don't click the same button next time if the page doesn't nav away.
	});
}
else
{
	console.log(vulCheckerHelper.reportCandidates());
}