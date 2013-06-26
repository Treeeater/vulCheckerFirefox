var Registration = function(){
	var that = this;
	this.inputs = [];
	this.selects = [];
	this.sortedSubmitButtons = [];
	this.account;
	this.attempts = 0;
	var uniqueRadioButtons = [];
	var filledRadioButtonNames = [];
	/*this.getOffset = function(el) {
		var _x = 0;
		var _y = 0;
		while( el && !isNaN( el.offsetLeft ) && !isNaN( el.offsetTop ) ) {
			_x += el.offsetLeft - el.scrollLeft;
			_y += el.offsetTop - el.scrollTop;
			el = el.offsetParent;
		}
		return { top: _y, left: _x };
	}*/
	var randomString = function(length, chars) {
		var result = '';
		for (var i = length; i > 0; --i) result += chars[Math.round(Math.random() * (chars.length - 1))];
		return result;
	}
	
	this.getOffset = function(ele) {
		var top = 0;
		var left = 0;
		while(ele.tagName != "BODY") {
			top += ele.offsetTop;
			left += ele.offsetLeft;
			if (getComputedStyle(ele).position == "fixed") {
				break;
			}
			ele = ele.offsetParent;
		}
		return { top: top, left: left };
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
		var inputWidth = ele.offsetWidth;
		var inputHeight = ele.offsetHeight;
		//heuristics: any element with a too large dimension cannot be input/submit, it must be just a underlaying div/layer.
		if (inputWidth >= screen.availWidth/4 || inputHeight >= screen.availHeight/4) return false;
		if (inputWidth <= 0 || inputHeight <= 0) return false;			//Elements that are on top layer must be visible.
		var position = that.getOffset(ele);
		var j;
		var score = 0;
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
		if (inputEle.value != "") return;			//auto-filled by the application, presumbly by SSO process.  We don't do anything here.
		if (inputEle.name && inputEle.name!="")
		{
			if (inputEle.name.toLowerCase().indexOf('name')!=-1){
				inputEle.value = that.account.firstName;
				return;
			}
			if (inputEle.name.toLowerCase().indexOf('email')!=-1 || inputEle.name.indexOf('e-mail')!=-1){
				inputEle.value = that.account.email;
				return;
			}
			if (inputEle.name.toLowerCase().indexOf('pass')!=-1){
				inputEle.value = "msr123456";
				return;
			}
			if (inputEle.name.toLowerCase().indexOf('zip') !=-1 || inputEle.name.indexOf('postal')!=-1){
				inputEle.value = "20002";
				return;
			}
		}
		var inputLength = inputEle.maxLength;
		if (typeof inputLength == 'undefined') inputLength = inputEle.size;
		if (typeof inputLength == 'undefined') inputLength = 8;
		var numericalInput = false;
		var i = 0;
		for (i = 0; i < inputEle.attributes.length; i++)
		{
			if (inputEle.attributes[i].value.indexOf('number')>-1 || inputEle.attributes[i].value.indexOf('numeric')>-1 || inputEle.attributes[i].value.indexOf('phone')>-1 || inputEle.attributes[i].value.indexOf('number')>-1) {
				numericalInput = true;
				break;
			}
		}
		if (numericalInput){
			inputEle.value = randomString(inputLength, '1234567890');
			console.log("Random numbers inserted.");
		}
		else {
			inputEle.value = randomString(inputLength, 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ');
			console.log("Random alphabets inserted.");
		}
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
				inputEle.value = "msr123456";
				break;
			case "email":
				inputEle.value = that.account.email;
				break;
			case "checkbox":
				//check all checkboxes for now:
				inputEle.checked = true;
			case "submit":
				//don't do anything, wait for form to populate and then click submit.
				break;
			case "button":
				//ignore all buttons.
				break;
			default:
				console.log("cannot handle this input type: " + inputEle.type + "...");
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
			processedInputs.push(currentInput);
			i = 0;
		}
		if (i > 0)
		{
			console.log("Top: Fields populated. Ready to click submit button.");
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
			while ((typeof allOptions[j]=="undefined"||allOptions[j].disabled)&&k<10) {
				j = Math.floor(Math.random()*allOptions.length); 
				k++;
			}
			if (allOptions[j].disabled) {
				console.log("Error! All options are disabled.");
			}
			else {
				allOptions[j].selected = true;
			}
			processedSelects.push(currentSelectElement);
			i = 0;
		}
	}
	
	this.tryFindSubmitButton = function(){
		var suspects = [];
		var submitButtons = [];
		var i = 0;
		var j = 0;
		var temp = document.getElementsByTagName('input');
		var lowerThanAnyInput = false;
		for (i = 0; i < temp.length; i++){
			//Heuristics: eliminate those suspects whose position is not lower than all input elements:
			if (!that.onTopLayer(temp[i])) continue;
			lowerThanAnyInput = false;
			TLtop = that.getOffset(temp[i]).top;
			for (j = 0; j < that.inputs.length; j++)
			{
				if (TLtop < that.getOffset(that.inputs[j]).top) {
					lowerThanAnyInput = true;
					break;
				}
			}
			if (lowerThanAnyInput) continue;
			suspects.push(temp[i]);
		}
		temp = document.getElementsByTagName('button');
		for (i = 0; i < temp.length; i++){
			//Heuristics: eliminate those suspects whose position is not lower than all input elements:
			if (!that.onTopLayer(temp[i])) continue;
			lowerThanAnyInput = false;
			TLtop = that.getOffset(temp[i]).top;
			for (j = 0; j < that.inputs.length; j++)
			{
				if (TLtop < that.getOffset(that.inputs[j]).top) {
					lowerThanAnyInput = true;
					break;
				}
			}
			if (lowerThanAnyInput) continue;
			suspects.push(temp[i]);
		}
		temp = document.getElementsByTagName('div');
		for (i = 0; i < temp.length; i++){
			//Heuristics: eliminate those suspects whose position is not lower than all input elements:
			if (!that.onTopLayer(temp[i])) continue;
			lowerThanAnyInput = false;
			TLtop = that.getOffset(temp[i]).top;
			for (j = 0; j < that.inputs.length; j++)
			{
				if (TLtop < that.getOffset(that.inputs[j]).top) {
					lowerThanAnyInput = true;
					break;
				}
			}
			if (lowerThanAnyInput) continue;
			suspects.push(temp[i]);
		}
		temp = document.getElementsByTagName('a');
		for (i = 0; i < temp.length; i++){
			//Heuristics: eliminate those suspects whose position is not lower than all input elements:
			if (!that.onTopLayer(temp[i])) continue;
			lowerThanAnyInput = false;
			TLtop = that.getOffset(temp[i]).top;
			for (j = 0; j < that.inputs.length; j++)
			{
				if (TLtop < that.getOffset(that.inputs[j]).top) {
					lowerThanAnyInput = true;
					break;
				}
			}
			if (lowerThanAnyInput) continue;
			suspects.push(temp[i]);
		}
		for (i = 0; i < suspects.length; i++){
			var curScore = 0;
			for (j = 0; j < suspects[i].attributes.length; j++)
			{
				var temp = suspects[i].attributes[j].name + "=" + suspects[i].attributes[j].value;
				temp = temp.toLowerCase();
				curScore += (temp.indexOf('submit')>-1?10:0);			//submit is a really strong one as an attribute.
				curScore += (temp.indexOf('confirm')>-1?2:0);			//confirm is a bad one, because a lot of registration forms have 'confirm password' in it.
				curScore += (temp.indexOf('regist')>-1?3:0);			//include registration and register
				curScore += (temp.indexOf('sign up')>-1?3:0);
				curScore += (temp.indexOf('signup')>-1?3:0);
				curScore += (temp.indexOf('create')>-1?3:0);
			}
			if (curScore >= 1){
				submitButtons.push({node:suspects[i],score:curScore});
			}
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
	
	this.tryCompleteRegistration = function(){
		if (that.sortedSubmitButtons.length > 0) return;
		that.tryProcessRadio();
		that.tryProcessSelects();
		that.tryFillInInputs();
		that.tryFindSubmitButton();
		that.attempts++;
		if (that.sortedSubmitButtons.length == 0 && that.attempts <= 2) setTimeout(that.tryCompleteRegistration,2000);		//tackle situations where page is first created but are blank, and contents are filled in afterwards.
	}
}

var registration = new Registration();

var delayedCall = function(){
	if (window.innerHeight < 100 || window.innerWidth < 200) return;	//shouldn't cope with iframe that's too small, this eliminate some FPs.
	self.port.emit("shouldRegisterIframe","");							//iframe finish registration worker start automatically, don't need ccc to issue a command; However, they only work if capturingPhase is 4 or 10.
}

if (self.port){
	setTimeout(delayedCall,1000);
	self.port.on("shouldRegisterIframe",function (response){
		if (response) {
			console.log("https iframe detected while capturing phase is 4 or 10 and the site needs registration.");
			self.port.emit("getUserInfo","");
		}
	});
	self.port.on("issueUserInfo",function(response){
		registration.account = response;
		registration.tryCompleteRegistration();
		if (registration.sortedSubmitButtons.length>0) {
			console.log("Clicking on submit button from IFrame: " + registration.sortedSubmitButtons[0].node.outerHTML);
			registration.sortedSubmitButtons[0].node.click();
			self.port.emit("registrationSubmitted",{"elementsToClick":[],"buttonToClick":[]});			//10 sec delay to refresh homepage, or if refresh traffic is seen, just go to next phase.
		}
	});
}
else{
	registration.account = {firstName:"Syxvq",lastName:"Ldswpk",email:"syxvq_ldswpk@yahoo.com"};
	registration.tryCompleteRegistration();			//for debugging.
	//console.log(registration.inputs);
	//console.log(registration.selects);
	if (registration.sortedSubmitButtons.length>0) console.log(registration.sortedSubmitButtons[0].node.outerHTML);
}