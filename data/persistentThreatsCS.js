//To distinguish from persistentThreats.js in lib dir, this file name is appended with CS to denote 'content script'.
function initDetection(credentials){

	if (!credentials || !document) return;			//sanity check

	//check if there's any third-party content on this page:
	var hasThirdPartyContent = false;
	var thirdPartyContentSRC = "";

	var findThirdPartyContent = function(node){
		if (hasThirdPartyContent) return;
		if (!node) return;
		if (!!(node.src) && typeof node.src == "string") {
			if (node.src.indexOf(document.domain)==-1) {
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

	findThirdPartyContent(document.documentElement);

	//If no third party content is on this page, no need to report them.
	if (!hasThirdPartyContent) return;

	//Confirmed there is third party content on this page.

	var url = document.URL;
	var html = document.documentElement.innerHTML;

	if (typeof credentials.access_token == "string" && url.indexOf('access_token=')!=-1 && url.indexOf(credentials.access_token)!=-1) {
		self.port.emit('access_token_seen',url);
	}

	if (typeof credentials.code == "string" && url.indexOf('code=')!=-1 && url.indexOf(credentials.code)!=-1) {
		self.port.emit('code_seen',url);
	}

	if (typeof credentials.signed_request == "string" && url.indexOf('signed_request=')!=-1 && url.indexOf(credentials.signed_request)!=-1) {
		self.port.emit('signed_request_seen',url);
	}

	if (typeof credentials.access_token == "string" && html.indexOf(credentials.access_token)!=-1) {
		self.port.emit('access_token_seen',"HTML");
	}

	if (typeof credentials.code == "string" && html.indexOf(credentials.code)!=-1) {
		self.port.emit('code_seen',"HTML");
	}

	if (typeof credentials.signed_request == "string" && html.indexOf(credentials.signed_request)!=-1) {
		self.port.emit('signed_request_seen',"HTML");
	}

};

self.port.on("detect",function(response){
	initDetection(response);
});