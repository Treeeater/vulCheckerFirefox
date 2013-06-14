var Registration = function(){
	var that = this;
	this.inputs = [];
	this.selects = [];
	this.sortedSubmitButtons = [];
	this.account;
	
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
		if (inputWidth <= 0 || inputHeight <= 0) return false;			//impossible to look at invisible inputs.
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
		if (score >= 8) return true;
		else return false;
	}
	
	this.tryFindInputs = function(){
		var allInputs = document.getElementsByTagName('input');
		var i;
		for (i = 0; i < allInputs.length; i++)
		{
			if (that.onTopLayer(allInputs[i])) that.inputs.push(allInputs[i]);
		}
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
			if (inputEle.name.toLowerCase().indexOf('zip')!=-1 || inputEle.name.indexOf('postal')!=-1){
				inputEle.value = "20002";
				return;
			}
			inputEle.value = randomString(8, 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ');
			console.log("Random string inserted.");
		}
		else{
			console.log("Error: input without name!");
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
			default:
				console.log("cannot handle this input type...");
		}
	}
	
	this.processRadio = function(){
		//second pass, go through the radio inputs and give a value to those that don't have value.
		for (i = 0; i < that.inputs.length; i++)
		{
			if (that.inputs[i].type == "radio")
			{
				if (!that.inputs[i].checked && filledRadioButtonNames.indexOf(that.inputs[i].name) == -1)
				{
					//this entire class is not chosen, we need to choose one (this one).
					that.inputs[i].checked = true;
					filledRadioButtonNames.push(that.inputs[i].name);
				}
			}
		}
	}
	
	this.tryFillInInputs = function(){
		var i;
		for (i = 0; i < that.inputs.length; i++)
		{
			that.fill(that.inputs[i]);
		}
		that.processRadio();
		console.log("Fields populated. Ready to click submit button.");
	}
	
	this.tryFindSelects = function(){
		var allSelects = document.getElementsByTagName('select');
		var i;
		for (i = 0; i < allSelects.length; i++)
		{
			if (that.onTopLayer(allSelects[i])) that.selects.push(allSelects[i]);
		}
	}
	
	this.tryProcessSelects = function(selectEle){
		var i,j,k;
		for (i = 0; i < that.selects.length; i++)
		{
			//select a random one.
			//currently we only select the first level children, however, because the existence of optgroup element, option elements may appear in second level.
			//This is true for dailymail.co.uk.
			j = Math.floor(Math.random()*that.selects[i].children.length);
			k = 0;
			while ((typeof that.selects[i].children[j]=="undefined"||that.selects[i].children[j].disabled)&&k<10) {
				j = Math.floor(Math.random()*that.selects[i].children.length); 
				k++;
			}
			if (that.selects[i].children[j].disabled) {
				console.log("Error! All options are disabled.");
			}
			else {
				that.selects[i].children[j].selected = true;
			}
		}
	}
	
	this.tryFindSubmitButton = function(){
		var suspects = [];
		var submitButtons = [];
		var i = 0;
		var j = 0;
		var temp = document.getElementsByTagName('input');
		for (i = 0; i < temp.length; i++){
			if (that.onTopLayer(temp[i])) suspects.push(temp[i]);
		}
		temp = document.getElementsByTagName('button');
		for (i = 0; i < temp.length; i++){
			if (that.onTopLayer(temp[i])) suspects.push(temp[i]);
		}
		temp = document.getElementsByTagName('div');
		for (i = 0; i < temp.length; i++){
			if (that.onTopLayer(temp[i])) suspects.push(temp[i]);
		}
		temp = document.getElementsByTagName('a');
		for (i = 0; i < temp.length; i++){
			if (that.onTopLayer(temp[i])) suspects.push(temp[i]);
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
			}
			if (curScore >= 3){
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
		that.tryFindInputs();
		that.tryFillInInputs();
		that.tryFindSelects();
		that.tryProcessSelects();
		that.tryFindSubmitButton();
	}
}

var registration = new Registration();

if (self.port){
	self.port.emit("getUserInfo","");
	self.port.on("issueUserInfo",function(response){
		//console.log(JSON.stringify(response));
		registration.account = response;
	});
	self.port.on("startRegister",function(response){
		registration.tryCompleteRegistration();
		self.port.emit("submitted",{"elementsToClick":[],"buttonToClick":[]});
	});
}
else{
	registration.account = {firstName:"Syxvq",lastName:"Ldswpk",email:"syxvq_ldswpk@yahoo.com"};
	registration.tryCompleteRegistration();			//for debugging.
	console.log(registration.inputs);
	//console.log(registration.selects);
	//console.log(registration.sortedSubmitButtons[0]);
}