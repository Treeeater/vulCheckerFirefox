notified = false;

function notifyOnload() {
	if (!notified) {
		self.port.emit("loadedURL",document.URL);
		notified = true;
	}
}

function notifyOnbeforeunload() {
	self.port.emit("unloadedURL",document.URL);
}

function extractContentFromNode(node){
	//When called, (recursively) extract the content of this page.
}

function extractContent(){
	return document.body.textContent.replace(/[\r\n]/g,'');
}

self.port.on("action",function(request){
	if (request.action == "testSuiteStart"){
		var url = prompt("Enter the URL you want to test","http://www.ehow.com/");
		if (url) self.port.emit("siteToTest",url);
	}
	if (request.action == "navigateTo"){
		document.location = request.site;
	}
	if (request.action == "extractContent"){
		self.port.emit("extractedContent", extractContent());
	}
	if (request.action == "after_modification_extractContent"){
		self.port.emit("after_modification_extractedContent", extractContent());
	}
});

//window.addEventListener('load',notifyOnload);

window.setTimeout(notifyOnload, 1000);				//fall back to setTimeout if page doesn't finish loading after 10 sec.

console.log("testSuite.js loaded");