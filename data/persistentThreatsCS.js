//To distinguish from persistentThreats.js in lib dir, this file name is appended with CS to denote 'content script'.
function initDetection(credentials){

	if (!credentials || !document) return;			//sanity check

	//check if there's any third-party content on this page:
	var hasThirdPartyContent = false;
	var hasThirdPartyScript = false;
	var thirdPartyContentSRC = "";
	var thirdPartyScriptSRC = "";

	var getDomain = function(url){
		if (!url || typeof url != 'string') return "";				//sanity check.
		if (url.indexOf('http://')!=0 && url.indexOf('https://')!=0) return document.domain;		//relative path?
		url = url.substr(url.indexOf('/')+2,url.length);
		if (url.indexOf('/')==-1) return url;			//root path, just return.
		url = url.substr(0,url.indexOf('/'));
		return url;
	};
	
	var findThirdPartyScript = function(node){
		if (hasThirdPartyScript) return;
		if (!node) return;
		if (!!(node.src) && typeof node.src == "string") {
			var srcDomain = getDomain(node.src);
			if (node.nodeName == 'SCRIPT' && srcDomain.indexOf(document.domain)==-1 && srcDomain.indexOf('facebook.com')==-1) {
				hasThirdPartyContent = true;
				hasThirdPartyScript = true;
				thirdPartyScriptSRC = node.src;
				thirdPartyContentSRC = node.src;
				return;
			}
		}
		if (!node.children) return;
		var i;
		for (i = 0; i < node.children.length; i++)
		{
			findThirdPartyScript(node.children[i]);
		}
	}
	
	var findThirdPartyContent = function(node){
		if (hasThirdPartyContent) return;
		if (!node) return;
		if (!!(node.src) && typeof node.src == "string") {
			var srcDomain = getDomain(node.src);
			if (srcDomain.indexOf(document.domain)==-1 && srcDomain.indexOf('facebook.com')==-1 && srcDomain.indexOf('facebook.net')==-1) {
				hasThirdPartyContent = true;
				thirdPartyContentSRC = node.src;
				return;
			}
		}
		if (!node.children) return;
		var i;
		for (i = 0; i < node.children.length; i++)
		{
			findThirdPartyContent(node.children[i]);
		}
	}

	findThirdPartyScript(document.documentElement);
	findThirdPartyContent(document.documentElement);

	var url = document.URL;
	if (url.indexOf('#')!=-1) url = url.substr(0,document.URL.indexOf('#'));			//fragments are not visible in referer header! Thanks Eugene!
	var html = document.documentElement.innerHTML;
	
	if (hasThirdPartyContent){
		if (typeof credentials.access_token == "string" && url.indexOf(credentials.access_token)!=-1) {
			self.port.emit('access_token_seen',{"where":"URL","thirdPartyURL":thirdPartyContentSRC});
		}

		if (typeof credentials.code == "string" && url.indexOf(credentials.code)!=-1) {
			self.port.emit('code_seen',{"where":"URL","thirdPartyURL":thirdPartyContentSRC});
		}

		if (typeof credentials.signed_request == "string" && url.indexOf(credentials.signed_request)!=-1) {
			self.port.emit('signed_request_seen',{"where":"URL","thirdPartyURL":thirdPartyContentSRC});
		}
	}

	if (hasThirdPartyScript){
		if (typeof credentials.access_token == "string" && html.indexOf(credentials.access_token)!=-1) {
			self.port.emit('access_token_seen',{"where":"HTML","thirdPartyURL":thirdPartyScriptSRC});
		}

		if (typeof credentials.code == "string" && html.indexOf(credentials.code)!=-1) {
			self.port.emit('code_seen',{"where":"HTML","thirdPartyURL":thirdPartyScriptSRC});
		}

		if (typeof credentials.signed_request == "string" && html.indexOf(credentials.signed_request)!=-1) {
			self.port.emit('signed_request_seen',{"where":"HTML","thirdPartyURL":thirdPartyScriptSRC});
		}
	}

};

self.port.on("detect",function(response){
	initDetection(response);
});