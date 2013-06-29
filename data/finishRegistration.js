var Registration = function(){
	var that = this;
	this.sortedSubmitButtons = [];
	this.account;
	this.shouldClickSubmitButton = false;
	this.inputBotEdge = 0;
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
		if (ele!=null && typeof ele != "undefined"){
			var top = 0;
			var left = 0;
			while( ele!=null && typeof ele != "undefined" && ele.tagName != "BODY") {
				top += ele.offsetTop;
				left += ele.offsetLeft;
				if (getComputedStyle(ele).position == "fixed") {
					break;
				}
				ele = ele.offsetParent;
			}
			return { top: top, left: left };
		}
		return {top:0, left:0};
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
		var inputName = "";
		var inputValue = "";
		if (inputEle.name && inputEle.name != "") inputName = inputEle.name.toLowerCase();
		if (inputEle.value && inputEle.value != "") inputValue = inputEle.value.toLowerCase();
		//clear pre-populated fields that shows something like 'your name here' or 'choose a screen name'.
		if (inputEle.name && inputEle.name!="")
		{
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
		}
		if (inputEle.value != "") return;			//auto-filled by the application, presumbly by SSO process.  We don't do anything here.
		if (inputEle.name && inputEle.name!="")
		{
			if (inputName.indexOf('email')!=-1 || inputName.indexOf('e-mail')!=-1){
				inputEle.value = that.account.email;
				return;
			}
			if (inputName.indexOf('pass')!=-1){
				inputEle.value = "msr123456";
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
			if (inputName.indexOf('name')!=-1){
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
			var rn = randomString(inputLength, '1234567890');
			inputEle.value = rn;
			console.log("Random numbers " + rn + " inserted into "+inputEle.outerHTML);
		}
		else {
			var rs = randomString(inputLength, 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ');
			inputEle.value = rs;
			console.log("Random alphabets " + rs + " inserted into "+inputEle.outerHTML);
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
				if (!inputEle.checked) inputEle.click();				//This is to tackle pogo.com, wierd event handler stuff.
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
			var trigger = document.createEvent('HTMLEvents');
			trigger.initEvent('change', true, true);
			currentInput.dispatchEvent(trigger);
			processedInputs.push(currentInput);
			i = 0;
		}
		if (i > 0)
		{
			console.log(inputFilledMessage);
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
				console.log("Error! All options are disabled/illegal.");
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
	
	this.tryFindSubmitButton = function(){
		var suspects = [];
		var submitButtons = [];
		var i = 0;
		var j = 0;
		var temp = document.getElementsByTagName('input');
		for (i = 0; i < temp.length; i++){
			suspects.push(temp[i]);
		}
		temp = document.getElementsByTagName('button');
		for (i = 0; i < temp.length; i++){
			suspects.push(temp[i]);
		}
		temp = document.getElementsByTagName('div');
		for (i = 0; i < temp.length; i++){
			suspects.push(temp[i]);
		}
		temp = document.getElementsByTagName('a');
		for (i = 0; i < temp.length; i++){
			suspects.push(temp[i]);
		}
		for (i = 0; i < suspects.length; i++){
			//Heuristics: eliminate those suspects whose position is not lower than all input text elements:
			var TLtop = that.getOffset(suspects[i]).top;
			if (TLtop < that.inputBotEdge) continue;
			var curScore = 0;
			for (j = 0; j < suspects[i].attributes.length; j++)
			{
				var temp = suspects[i].attributes[j].name + "=" + suspects[i].attributes[j].value;
				temp = temp.toLowerCase();
				curScore += (temp.indexOf('submit')>-1?10:0);			//submit is a really strong one as an attribute.
				curScore += (temp.indexOf('regist')>-1?5:0);			//include registration and register
				curScore += (temp.indexOf('sign up')>-1?5:0);
				curScore += (temp.indexOf('signup')>-1?5:0);
				curScore += (temp.indexOf('create')>-1?3:0);			//this is less used.
				curScore += (temp.indexOf('confirm')>-1?2:0);			//confirm is a bad one, because a lot of registration forms have 'confirm password' in it.
				curScore += (temp.indexOf('start')>-1?2:0);				//start is a bad one.
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
	
	this.resetStatus = function()
	{
		that.sortedSubmitButtons = [];
		uniqueRadioButtons = [];
		filledRadioButtonNames = [];
	}
	
	this.clickSubmitButton = function(){
		console.log("Clicking on submit button from Top: " + that.sortedSubmitButtons[0].node.outerHTML);
		that.sortedSubmitButtons[0].node.click();
		self.port.emit("registrationSubmitted",{"elementsToClick":[],"buttonToClick":[]});
	}
	
	this.findInputBottomEdge = function(){
		var allInputs = document.getElementsByTagName('input');
		var allTextInputs = [];
		var i;
		for (i = 0; i < allInputs.length; i++)
		{
			if (allInputs[i].type == 'text') allTextInputs.push(allInputs[i]);
		}
		var allTopTextInputs = [];		//stores all text inputs that are on top layer.
		for (i = 0; i < allTextInputs.length; i++)
		{
			if (that.onTopLayer(allTextInputs[i])) allTopTextInputs.push(allTextInputs[i]);
		}
		//find the bot edge for those inputs
		for (i = 0; i < allTopTextInputs.length; i++)
		{
			var offSetY = that.getOffset(allTopTextInputs[i]).top;
			if (offSetY > that.inputBotEdge) that.inputBotEdge = offSetY;
		}
	}
	
	this.tryCompleteRegistration = function(){
		that.resetStatus();
		that.tryProcessRadio();
		that.tryProcessSelects();
		that.tryFillInInputs();
		that.findInputBottomEdge();
		that.tryFindSubmitButton();
		if (that.sortedSubmitButtons.length == 0) {
			self.port.emit("registrationFailed",{"errorMsg":"Failed to find submit button, registration failed."});		//iframe worker shouldn't have this, they can fail because they are not necessarily the login iframe.
			return;
		}
		if (that.shouldClickSubmitButton) {
			setTimeout(registration.clickSubmitButton,500);			//give some time for all the shenanigans to settle
		}
	}
}

var registration = new Registration();
var inputFilledMessage = "Top: All fields populated. Ready to click submit button.";


if (self.port){
	self.port.emit("getUserInfo","");
	self.port.on("issueUserInfo",function(response){
		registration.account = response;
	});
	self.port.on("startRegister",function(response){
		if (response.manualClick){
			console.log('manual clicked from popup.html to finish registration...');
			registration.tryCompleteRegistration();
		}
		else{
			console.log("Yet to see submit button clicked from iframes, starting to register from Top...");
			registration.shouldClickSubmitButton = true;
			setTimeout(registration.tryCompleteRegistration,2000);			//wait for extra js to load.
		}
	});
}
else{
	registration.account = {firstName:"Syxvq",lastName:"Ldswpk",email:"syxvq_ldswpk@yahoo.com"};
	registration.tryCompleteRegistration();			//for debugging.
	if (registration.sortedSubmitButtons.length>0) console.log(registration.sortedSubmitButtons);
}