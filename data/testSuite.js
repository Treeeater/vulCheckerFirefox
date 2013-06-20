notified = false;
function notifyOnload() {
	if (!notified) {
		self.port.emit("loadedURL",document.URL);
		notified = true;
	}
}

function getURL() {
	return document.URL;
}

function extractContent(){
	/*var str = $("body").children("script").remove().end().text();
	str = str.replace(/[\r\n\s\t]/g,'');
	$("img[src]").each(function(i){
		if ($(this).attr && $(this).attr('src')!="") str+=($(this).attr('src')+" ");
	})*/
	var str = document.documentElement.innerHTML;
	return str;
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
	if (request.action == "getURL"){
		self.port.emit("getURL",getURL());
	}
});

//window.addEventListener('load',notifyOnload);

window.setTimeout(notifyOnload, 1000);				//fall back to setTimeout if page doesn't finish loading after 10 sec.

//console.log("testSuite.js loaded");