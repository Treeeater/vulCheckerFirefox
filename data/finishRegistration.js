var Registration = function(){
	var that = this;
	var forms;
	
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
	
	this.tryFindInputForm = function(){
		that.forms = document.getElementsByTagName('input');
		var i;
		for (i = 0; i < that.forms.length; i++)
		{
			var formWidth = that.forms[i].offsetWidth;
			var formHeight = that.forms[i].offsetHeight;
			if (formWidth <= 0 || formHeight <= 0) continue;			//impossible to look at invisible forms.
			var position = that.getOffset(that.forms[i]);
			var j;
			var score = 0;
			//Don't judge the form unfairly because of the screen/browser window size.
			var maxHeight = (document.documentElement.clientHeight - position.top > formHeight)? formHeight : document.documentElement.clientHeight - position.top;
			var maxWidth = (document.documentElement.clientWidth > formWidth)? formWidth : document.documentElement.clientWidth - position.left;
			//Instead of deciding it on one try, deciding it on 10 tries.  This tackles some weird problems.
			for (j = 0; j < 10; j++)
			{
				score = that.isChildElement(that.forms[i],document.elementFromPoint(position.left+1+j*maxWidth/10, position.top+1+j*maxHeight/10)) ? score + 1 : score;
			}
			if (score > 8)
			{
				console.log(that.forms[i]);
				console.log(document.elementFromPoint(position.left+1, position.top+1));
				console.log(" is" + score.toString());
			}
		}
	}
}

var registration = new Registration();

//registration.tryFindInputForm();