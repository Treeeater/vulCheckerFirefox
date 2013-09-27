var debug = true;

var log = function (str){
	if (debug) console.log(str);
	if (self.port) self.port.emit("writeToFileRequest",str);
}

var Registration = function(){
	var that = this;
	this.sortedSubmitButtons = [];
	this.account;
	this.attempts = 0;
	this.submitButtonClicked = false;
	this.allTopTextInputs = [];		//stores all text inputs that are on top layer.
	this.allTopTextInputBottomEdges = [];		//stores bottom edges of all inputs.
	this.inputBotEdge = 0;			//stores the bottommost edge of all inputs
	this.disableRestrictionOnLinking = false;		//relax restriction on linking.
	var uniqueRadioButtons = [];
	var filledRadioButtonNames = [];
	var randomString = function(length, chars) {
		var result = '';
		for (var i = length; i > 0; --i) result += chars[Math.round(Math.random() * (chars.length - 1))];
		return result;
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
		//given an element, returns true if it's likely to be on the topmost layer, false if otherwise.
		if (!ele) return false;
		var document = ele.ownerDocument;
		var inputWidth = ele.offsetWidth;
		var inputHeight = ele.offsetHeight;
		//heuristics: any element with a too large dimension cannot be input/submit, it must be just a underlaying div/layer.
		if (inputWidth >= screen.availWidth/3 || inputHeight >= screen.availHeight/4) return false;
		if (inputWidth <= 0 || inputHeight <= 0) return false;			//Elements that are on top layer must be visible.
		var position = $(ele).offset();
		var j;
		var score = 0;
		ele.scrollIntoView();
		position.top = position.top - window.pageYOffset;
		position.left = position.left - window.pageXOffset;
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
	
	this.fillText = function(inputEle){
		if (inputEle == null || typeof inputEle == "undefined") return;
		var inputName = "";
		var inputValue = "";
		if (inputEle.name && inputEle.name != "") inputName = inputEle.name.toLowerCase();
		if (inputEle.value && inputEle.value != "") inputValue = inputEle.value.toLowerCase();
		//clear pre-populated fields that shows something like 'your name here' or 'choose a screen name'.
		if (inputEle.name && inputEle.name!="")
		{
			if (inputValue.indexOf('required')!=-1) inputEle.value = "";
			if (inputName.indexOf('email')!=-1 || inputName.indexOf('e-mail')!=-1){
				if (inputValue.indexOf('email') != -1 || inputValue.indexOf('e-mail') != -1) inputEle.value = "";
			}
			if (inputName.indexOf('zip') !=-1 || inputName.indexOf('postal')!=-1){
				if (inputValue.indexOf('zip') != -1 || inputValue.indexOf('postal') != -1) inputEle.value = "";
			}
			if (inputName.indexOf('name')!=-1){
				if (inputValue.indexOf('name') != -1) inputEle.value = "";
			}
			if (inputName.indexOf('year') !=-1 && (inputEle.value == "YYYY" || inputValue.indexOf('year') != -1)) inputEle.value = "";
			if (inputName.indexOf('month') !=-1 && (inputEle.value == "MM" || inputValue.indexOf('month') != -1)) inputEle.value = "";
			if (inputName.indexOf('day') !=-1 && (inputEle.value == "DD" || inputValue.indexOf('day') != -1)) inputEle.value = "";
			if ((inputEle.value.indexOf("DD") != -1 && inputEle.value.indexOf("YY") != -1 && inputEle.value.indexOf("MM") != -1) || (inputEle.placeholder.indexOf("DD") != -1 && inputEle.placeholder.indexOf("YY") != -1 && inputEle.placeholder.indexOf("MM") != -1)) inputEle.value = "10/10/1980";
		}
		if (inputEle.value != "") return;			//auto-filled by the application, presumbly by SSO process.  We don't do anything here.
		if (inputEle.name && inputEle.name!="")
		{
			if (inputName.indexOf('email')!=-1 || inputName.indexOf('e-mail')!=-1){
				inputEle.value = that.account.email;
				return;
			}
			if (inputName.indexOf('pass')!=-1){
				inputEle.value = "Zlixoh2a";
				return;
			}
			if (inputName.indexOf('zip') !=-1 || inputName.indexOf('postal')!=-1){
				inputEle.value = "20002";
				return;
			}
			if (inputName.indexOf('year') !=-1){
				inputEle.value = "1980";
				return;
			}
			if (inputName.indexOf('cell') !=-1 || inputName.indexOf('phone') !=-1 || inputName.indexOf('mobile') !=-1){
				inputEle.value = "202" + randomString(7, '1234567890');
				return;
			}
			if (inputName.indexOf('name')!=-1 && inputName.indexOf('last')!=-1){
				inputEle.value = that.account.lastName;
				return;
			}
			if (inputName.indexOf('name')!=-1 || inputName.indexOf('user')!=-1){
				inputEle.value = that.account.firstName;
				return;
			}
		}
		var inputLength;
		if (inputEle.maxLength <= 50 && inputEle.maxLength > 0) inputLength = inputEle.maxLength;
		if (typeof inputLength == 'undefined' && inputEle.size > 0 && inputEle.size <= 50) inputLength = inputEle.size;
		if (typeof inputLength == 'undefined') inputLength = 8;
		var numericalInput = false;
		var i = 0;
		for (i = 0; i < inputEle.attributes.length; i++)
		{
			if (inputEle.attributes[i].value.indexOf('number')>-1 || inputEle.attributes[i].value.indexOf('numeric')>-1 || inputEle.attributes[i].value.indexOf('phone')>-1 || inputEle.attributes[i].value.indexOf('number')>-1 || inputEle.attributes[i].value.indexOf('year')>-1 || inputEle.attributes[i].value.indexOf('month')>-1 || inputEle.attributes[i].value.indexOf('day')>-1) {
				numericalInput = true;
				break;
			}
		}
		if (numericalInput){
			var rn = randomString(inputLength-1, '1234567890');
			inputEle.value = "2"+rn;
			log("Random numbers 2" + rn + " inserted into iframe");
		}
		else {
			var rs = randomString(inputLength, 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ');
			inputEle.value = rs;
			log("Random alphabets " + rs + " inserted into iframe");
		}
	}
	
	this.fillNumber = function(inputEle){
		var inputLength;
		if (inputEle.maxLength <= 50 && inputEle.maxLength > 0) inputLength = inputEle.maxLength;
		if (typeof inputLength == 'undefined' && inputEle.size > 0 && inputEle.size <= 50) inputLength = inputEle.size;
		if (typeof inputLength == 'undefined') inputLength = 8;
		var rn = randomString(inputLength-1, '1234567890');
		inputEle.value = "2"+rn;
		log("Random numbers 2" + rn + " inserted into iframe");
	}
	
	this.unknownInputType = function(t){
		return (t!='color' && t!='date' && t!='datetime' && t!='datetime-local' && t!='file' && t!='hidden' && t!='image' && t!='month' && t!='range' && t!='reset' && t!='search' && t!='time' && t!='url' && t!='week');
	}
	
	this.fill = function(inputEle){
		if (inputEle == null || typeof inputEle == "undefined") return;
		switch (inputEle.type)
		{
			case "radio":
				if (inputEle.checked) filledRadioButtonNames.push(inputEle.name);
				break;
			case "text":
				that.fillText(inputEle);
				break;
			case "password":
				inputEle.value = "Zlixoh2a";
				break;
			case "email":
				inputEle.value = that.account.email;
				break;
			case "checkbox":
				//check all checkboxes for now:
				if (!inputEle.checked) inputEle.click();				//This is to tackle pogo.com, wierd event handler stuff.
				if (!inputEle.checked) inputEle.checked = true;			//Fail safe.
			case "submit":
				//don't do anything, wait for form to populate and then click submit.
				break;
			case "button":
				//ignore all buttons.
				break;
			case "tel":
				//numbers only
				that.fillNumber(inputEle);
				break;
			case "number":
				//numbers only
				that.fillNumber(inputEle);
				break;
			default:
				if (that.unknownInputType(inputEle.type)){
					//according to HTML standards, unknown types are treated as texts.
					log("Unknown input type - converting type " + inputEle.type + " to text in iframe...");
					that.fillText(inputEle);
				}
				else {
					log("cannot handle this input type in iframe: " + inputEle.type + "...");
				}
		}
	}
	
	this.tryFillInInputs = function(){
		var i = 0;
		var processedInputs = [];
		while ( i < document.getElementsByTagName('input').length ){
			var currentInput = document.getElementsByTagName('input')[i];
			if (processedInputs.indexOf(currentInput) > -1 || currentInput.type == "radio"){
				i++;
				continue;
			}
			if (!that.onTopLayer(currentInput)) {
				//ignore elements that are not on top.
				i++;
				continue;
			}
			that.fill(currentInput);
			var trigger = document.createEvent('HTMLEvents');
			trigger.initEvent('change', true, true);
			currentInput.dispatchEvent(trigger);
			processedInputs.push(currentInput);
			i = 0;
		}
		if (i > 0)
		{
			log(inputFilledMessage);
		}
	}
	
	this.tryProcessRadio = function(){
		//second pass, go through the radio inputs and give a value to those that don't have value.
		var i = 0;
		var processedRadioNames = [];
		while ( i < document.getElementsByTagName('input').length ){
			//process selects one by one, and rescan them after processing, make sure no new selects show up after selecting one previously.
			var currentRadioElement = document.getElementsByTagName('input')[i];
			if (processedRadioNames.indexOf(currentRadioElement.name) > -1 || currentRadioElement.type != "radio") {
				//ignore elements that are already processed
				//also ignore all non-radio inputs.
				i++;
				continue;
			}
			if (!that.onTopLayer(currentRadioElement)) {
				//ignore elements that are not on top.
				i++;
				continue;
			}
			currentRadioElement.checked = true;
			var trigger = document.createEvent('HTMLEvents');
			trigger.initEvent('change', true, true);
			currentRadioElement.dispatchEvent(trigger);
			processedRadioNames.push(currentRadioElement.name);
			i = 0;
		}
	}
	
	this.tryProcessSelects = function(){
		var i,j,k;
		i = 0;
		var processedSelects = [];
		while ( i < document.getElementsByTagName('select').length ){
			//process selects one by one, and rescan them after processing, make sure no new selects show up after selecting one previously.
			var currentSelectElement = document.getElementsByTagName('select')[i];
			if (processedSelects.indexOf(currentSelectElement)>-1) {
				//ignore elements that are already processed
				i++;
				continue;
			}
			if (!that.onTopLayer(currentSelectElement)) {
				//ignore elements that are not on top.
				i++;
				continue;
			}
			//process this element.
			var allOptions = $(currentSelectElement).find('option');
			j = Math.floor(Math.random()*allOptions.length);
			k = 0;
			while ((typeof allOptions[j]=="undefined" ||			//safe guard
			allOptions[j].disabled||								//disabled option
			allOptions[j].value==""||								//option w/o value
			typeof allOptions[j].value=="undefined"||				//option w/o value
			allOptions[j].innerHTML.toLowerCase().indexOf('select')>-1||		//option w/ innerHTML which has select
			allOptions[j].innerHTML.toLowerCase().indexOf('choose')>-1)&&		//option w/ innerHTML which has choose
			k<10) {
				j = Math.floor(Math.random()*allOptions.length); 
				k++;
			}
			if (allOptions[j].disabled) {
				log("Error! All options are disabled/illegal in iframe.");
			}
			else {
				allOptions[j].selected = "selected";
				var trigger = document.createEvent('HTMLEvents');
				trigger.initEvent('change', true, true);
				currentSelectElement.dispatchEvent(trigger);
			}
			processedSelects.push(currentSelectElement);
			i = 0;
		}
	}
	
	this.commonParentDistance = function(nodeA, nodeB){
		if (nodeA == null || nodeB == null || typeof nodeA == "undefined" || typeof nodeB == "undefined") return 9999;
		var aList = [];
		var bList = [];
		var rootNode = nodeA.parentNode;
		while (rootNode != null && typeof rootNode != "undefined") {
			aList.push(rootNode);
			rootNode = rootNode.parentNode;
		}
		var rootNode = nodeB.parentNode;
		while (rootNode != null && typeof rootNode != "undefined") {
			bList.push(rootNode);
			rootNode = rootNode.parentNode;
		}
		var i = 0;
		while (i < aList.length){
			if (bList.indexOf(aList[i]) != -1) {
				return (i >= bList.indexOf(aList[i]) ? i + 1 : bList.indexOf(aList[i]) + 1);
			}
			i++;
		}
		return 9999;
	}
	
	this.isLinkingForm = function(submitButton){
		if (that.disableRestrictionOnLinking) return false;
		var curNode = submitButton;
		var parentFormNode = null;
		while (curNode != null && typeof curNode != "undefined")
		{
			if (curNode.nodeName == "FORM") {
				parentFormNode = curNode;
				break;
			}
			curNode = curNode.parentNode;
		}
		if (!parentFormNode) return false;
		var textInputs = $(parentFormNode).find("input[type='text'],input[type='email']");
		var passwordInputs = $(parentFormNode).find("input[type='password']");
		var visibleTextInputs = 0;
		var visiblePasswordInputs = 0;
		var i = 0;
		for (i = 0; i < textInputs.length; i++){
			if (that.onTopLayer(textInputs[i])) visibleTextInputs++;
		}
		for (i = 0; i < passwordInputs.length; i++){
			if (that.onTopLayer(passwordInputs[i])) visiblePasswordInputs++;
		}
		if (visibleTextInputs == 1 && visiblePasswordInputs == 1)
		{
			//console.log("Ignored submit button that's probably in a linking form.");
			return true;
		}
		return false;
	}
	
	this.computeSubmitButtonTextScore = function(lowerCasedInput){
		if (typeof lowerCasedInput != "string") return 0;
		if (lowerCasedInput.indexOf('search') != -1) return -999;				//Heuristics: search should not be present there.
		var curScore = (lowerCasedInput.indexOf('submit')>-1?10:0);			//submit is a really strong one as an attribute.
		curScore += (lowerCasedInput.indexOf('regist')>-1?5:0);			//include registration and register
		curScore += (lowerCasedInput.indexOf('sign up')>-1?5:0);
		curScore += (lowerCasedInput.indexOf('sign-up')>-1?5:0);
		curScore += (lowerCasedInput.indexOf('signup')>-1?5:0);
		curScore += (lowerCasedInput.indexOf('create')>-1?3:0);			//this is less used.
		curScore += (lowerCasedInput.indexOf('finish')>-1?3:0);			//this is less used.
		curScore += (lowerCasedInput.indexOf('confirm')>-1?2:0);			//confirm is a bad one, because a lot of registration forms have 'confirm password' in it.
		curScore += (lowerCasedInput.indexOf('continue')>-1?2:0);			
		curScore += (lowerCasedInput.indexOf('start')>-1?2:0);				//start is a bad one.
		return curScore;
	}
	
	this.tryFindSubmitButton = function(){
		var suspects = [];
		var submitButtons = [];
		var i = 0;
		var j = 0;
		var temp = document.getElementsByTagName('input');
		for (i = 0; i < temp.length; i++){
			//Warning: This part will be different than finishRegistration.js: in an iframe setting, requiring the submit button to be at least 200px lower is unreasonable.
			//Heuristic: If it's input element, must be one of the three types for us to consider.
			if (temp[i].type != "submit" && temp[i].type != "button" && temp[i].type != "radio" && temp[i].type != "image") continue;
			if (!that.onTopLayer(temp[i])) continue;
			//Heuristic: Ignore input submit buttons whose form only has 2 text inputs, one of which is of password type.
			//This is used to battle linking accounts situation.
			if (that.isLinkingForm(temp[i])) continue;
			suspects.push(temp[i]);
		}
		temp = document.getElementsByTagName('button');
		for (i = 0; i < temp.length; i++){
			if (temp[i].innerHTML.indexOf('accessible_elem')!=-1 && temp[i].innerHTML.indexOf('pluginButtonIcon')!=-1) continue;		//eliminate like buttons.
			if (!that.onTopLayer(temp[i])) continue;
			if (that.isLinkingForm(temp[i])) continue;
			suspects.push(temp[i]);
		}
		temp = document.getElementsByTagName('div');
		for (i = 0; i < temp.length; i++){
			if (!that.onTopLayer(temp[i])) continue;
			if (that.isLinkingForm(temp[i])) continue;
			suspects.push(temp[i]);
		}
		temp = document.getElementsByTagName('a');
		for (i = 0; i < temp.length; i++){
			if (!that.onTopLayer(temp[i])) continue;
			if (that.isLinkingForm(temp[i])) continue;
			suspects.push(temp[i]);
		}
		temp = document.getElementsByTagName('img');
		for (i = 0; i < temp.length; i++){
			if (!that.onTopLayer(temp[i])) continue;
			if (that.isLinkingForm(temp[i])) continue;
			suspects.push(temp[i]);
		}
		for (i = 0; i < suspects.length; i++){
			//Heuristic: eliminate those suspects whose position is not lower than all input text elements:
			var TLtop = $(suspects[i]).offset().top;
			if (TLtop < that.inputBotEdge) continue;
			//Heuristic: submit button cannot be too large:
			if (suspects[i].offsetHeight > 150 || suspects[i].offsetWidth > 800) continue;
			var curScore = 0;
			for (j = 0; j < suspects[i].attributes.length; j++)
			{
				//if (suspects[i].attributes[j].name.indexOf('on') == 0) continue;		//Heuristics: event handlers doesn't count.
				var temp = suspects[i].attributes[j].name + "=" + suspects[i].attributes[j].value;
				curScore += that.computeSubmitButtonTextScore(temp.toLowerCase());
			}
			var directChildrenTextContent = $(suspects[i]).contents().filter(function() {
				if (this.nodeType == 3) return true;
				if (this.nodeName == "EM") return true;
				if (this.nodeName == "B") return true;
				if (this.nodeName == "I") return true;
				if (this.nodeName == "U") return true;
				return false;
			}).text().toLowerCase();
			curScore += that.computeSubmitButtonTextScore(directChildrenTextContent);
			if (curScore >= 1){
				submitButtons.push({node:suspects[i],score:curScore});
			}
		}
		if (submitButtons.length == 0){
			//Cannot find submit button after eliminating all buttons that are above all inputs, relax this a bit now.
			log("Cannot find submit button when eliminating all buttons that are above text inputs, now relaxing this...");
			for (i = 0; i < suspects.length; i++){
				//Heuristic: eliminate those suspects whose position is not lower than all input text elements that have a close common parent with this suspect:
				var TLtop = $(suspects[i]).offset().top;
				var eliminated = false;
				var j = 0;
				for (j = 0; j < that.allTopTextInputs.length; j++){
					if (that.commonParentDistance(suspects[i],that.allTopTextInputs[j]) < 2 && TLtop < that.allTopTextInputBottomEdges[j] - that.allTopTextInputs[j].offsetHeight/2) eliminated = true;
				}
				if (eliminated) continue;
				//Heuristic: submit button cannot be too large:
				if (suspects[i].offsetHeight > 150 || suspects[i].offsetWidth > 800) continue;
				var curScore = 0;
				for (j = 0; j < suspects[i].attributes.length; j++)
				{
					//if (suspects[i].attributes[j].name.indexOf('on') == 0) continue;		//Heuristics: event handlers doesn't count.
					var temp = suspects[i].attributes[j].name + "=" + suspects[i].attributes[j].value;
					curScore += that.computeSubmitButtonTextScore(temp.toLowerCase());
				}
				var directChildrenTextContent = $(suspects[i]).contents().filter(function() {
					if (this.nodeType == 3) return true;
					if (this.nodeName == "EM") return true;
					if (this.nodeName == "B") return true;
					if (this.nodeName == "I") return true;
					if (this.nodeName == "U") return true;
					return false;
				}).text().toLowerCase();
				curScore += that.computeSubmitButtonTextScore(directChildrenTextContent);
				if (curScore >= 1){
					submitButtons.push({node:suspects[i],score:curScore});
				}
			}
		}
		//relax linking form restriction:
		if (submitButtons.length == 0 && !that.disableRestrictionOnLinking){
			that.disableRestrictionOnLinking = true;
			log('Cannot find submit button when eliminating linking-like forms, now relaxing this...')
			that.tryFindSubmitButton();
			that.disableRestrictionOnLinking = false;
			return;
		}
		for (i = 0; i < submitButtons.length; i++)
		{
			//sort the submitButtons.
			var max = 0;
			var maxindex = -1;
			for (j = 0; j < submitButtons.length; j++)
			{
				if (submitButtons[j].score > max) {
					max = submitButtons[j].score;
					maxindex = j;
				}
			}
			if (max == 0) {return;}
			else {
				that.sortedSubmitButtons[i] = {node:submitButtons[maxindex].node, score:max};
				submitButtons[maxindex].score = -1;
			}
		}
	}
	
	this.findInputBottomEdge = function(){
		//used for submit button elimination.
		var allInputs = document.getElementsByTagName('input');
		var allTextInputs = [];
		var i;
		var isSearchRelated;
		for (i = 0; i < allInputs.length; i++)
		{
			if (allInputs[i].type == 'text') allTextInputs.push(allInputs[i]);
		}
		for (i = 0; i < allTextInputs.length; i++)
		{
			if (that.onTopLayer(allTextInputs[i])) {
				var j;
				isSearchRelated = false;
				for (j = 0; j < allTextInputs[i].attributes.length; j++)
				{
					var temp = allTextInputs[i].attributes[j].name + "=" + allTextInputs[i].attributes[j].value;
					if (temp.toLowerCase().indexOf('search') != -1) {
						isSearchRelated = true;
						break;
					}
				}
				if (isSearchRelated) continue;
				that.allTopTextInputs.push(allTextInputs[i]);
				that.allTopTextInputBottomEdges.push($(allTextInputs[i]).offset().top);
			}
		}
		//find the bot edge for those inputs
		for (i = 0; i < that.allTopTextInputs.length; i++)
		{
			var offSetY = $(that.allTopTextInputs[i]).offset().top - that.allTopTextInputs[i].offsetHeight/2;		//some submit button is parallel to the input, this leaves some margin for it, if the submit button is bigger than the input textbox.
			if (offSetY > that.inputBotEdge) that.inputBotEdge = offSetY;
		}
	}

	var clickSubmitButton = function(){
		log("Clicking on submit button from IFrame: " + that.sortedSubmitButtons[0].node.outerHTML);
		that.submitButtonClicked = true;
		that.sortedSubmitButtons[0].node.click();
		self.port.emit("registrationSubmitted",{"elementsToClick":[],"buttonToClick":[]});
	}
	
	this.tryCompleteRegistration = function(){
		//need to confirm that this iframe is on top layer in the first place before searching for all the inputs/buttons.
		//This is however hard to do because of SOP restriction and also possible redirection at iframe src. We cannot simply compare src attribute and worker.url to get the iframe handle from host page.
		//if (that.sortedSubmitButtons.length > 0) return;
		if (that.submitButtonClicked) return;
		that.tryProcessRadio();
		that.tryProcessSelects();
		that.tryFillInInputs();
		that.findInputBottomEdge();
		that.tryFindSubmitButton();
		that.attempts++;
		if (typeof self.port != "undefined" && registration.sortedSubmitButtons.length>0) {
			setTimeout(clickSubmitButton,500);			//give some time for all the shenanigans to settle
		}
		if (that.sortedSubmitButtons.length == 0 && that.attempts <= 2) setTimeout(that.tryCompleteRegistration,2000);		//tackle situations where page is first created but are blank, and contents are filled in afterwards.
	}
}

var registration = new Registration();
var inputFilledMessage = "Iframe: All fields populated. Ready to click submit button.";
var delayedCall = function(){
	if (window.innerHeight < 100 || window.innerWidth < 200) return;	//shouldn't cope with iframe that's too small, this eliminate some FPs.
	self.port.emit("shouldRegisterIframe","");							//iframe finish registration worker start automatically, don't need ccc to issue a command; However, they only work if capturingPhase is 4 or 10.
}

if (self.port){
	if (document.documentElement.offSetHeight != 0 && document.documentElement.offSetWidth != 0 && document.URL.indexOf('plugins/likebox.php')==-1) {
		//why bother trying an invisible iframe?
		//Ignore plugin likeboxes.
		setTimeout(delayedCall,1000);
		self.port.on("shouldRegisterIframe",function (response){
			debug = response.debug;
			if (response.shouldRegisterIframe) {
				log("https iframe detected while capturing phase is 4 or 10 and the site needs registration.");
				self.port.emit("getUserInfo","");
			}
		});
		self.port.on("issueUserInfo",function(response){
			registration.account = response;
			registration.tryCompleteRegistration();
		});
	}
}
else{
	registration.account = {firstName:"chadadarnya",lastName:"isackaldon",email:"chadadarnyaisackaldon@outlook.com"};
	registration.tryCompleteRegistration();			//for debugging.
	if (registration.sortedSubmitButtons.length>0) log(registration.sortedSubmitButtons);
}