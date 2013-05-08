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

self.port.on("action",function(request){
	if (request.action == "testSuiteStart"){
		var url = prompt("Enter the URL you want to test","http://www.squidoo.com/");
		if (url) self.port.emit("siteToTest",url);
	}
	if (request.action == "navigateTo"){
		document.location = request.site;
	}
});

window.addEventListener('load',notifyOnload);

window.addEventListener('beforeunload', notifyOnbeforeunload);

window.setTimeout(notifyOnload, 10000);				//fall back to setTimeout if page doesn't finish loading after 10 sec.

console.log("testSuite.js loaded");