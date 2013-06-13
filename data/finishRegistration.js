var Registration = function(){
	var that = this;
	this.inputs = [];
	this.sortedSubmitButtons = [];
	
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
	
	this.tryFindSubmitButton = function(){
		var suspects = [];
		var submitButtons = [];
		var temp = document.getElementsByTagName('input');
		var i = 0;
		var j = 0;
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
		that.tryFindSubmitButton();
	}
}

var registration = new Registration();

if (self.port){
	self.port.on("startRegister",function(response){
		registration.tryCompleteRegistration();
		self.port.emit("submitted",{"elementsToClick":[],"buttonToClick":[]});
	});
}
else{
	registration.tryCompleteRegistration();			//for debugging.
	console.log(registration.sortedSubmitButtons);
	console.log(registration.sortedSubmitButtons[0]);
}